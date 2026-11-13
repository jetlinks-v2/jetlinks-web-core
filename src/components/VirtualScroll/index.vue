<template>
  <div
    class="viewport"
    ref="viewport"
    @scroll="handleScroll"
  >
    <!-- 占位容器，高度为所有项总高度 -->
    <div
      class="phantom"
      :style="{ height: totalHeight + 'px' }"
    ></div>
    <!-- 实际渲染的可见项 -->
    <div
      class="list"
      :style="{ transform: `translateY(${offset}px)` }"
    >
      <div
        v-for="item in visibleData"
        :key="keyOf(item)"
        class="list-item"
        :style="{ height: itemHeight + (isExpanded(item) ? expandedHeight : 0) + 'px' }"
      >
        <slot
          name="renderItem"
          v-bind="item"
        ></slot>
        <div
          v-if="isExpanded(item)"
          :ref="setExpansionElement"
          class="list-expansion"
        >
          <slot
            name="expandedItem"
            v-bind="item"
          ></slot>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, shallowRef, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import { virtualRange, virtualRowOffset } from './range'

const props = defineProps({
  data: { type: Array, required: true },
  itemHeight: { type: Number, default: 50 },
  expandedKey: { type: [String, Number], default: undefined }
})
const emit = defineEmits(['reachBottom', 'horizontalScroll'])

const viewport = ref(null)
const scrollTop = ref(0)
const expandedKey = ref(props.expandedKey)
const expandedHeight = ref(0)
const expansion = shallowRef()
const keyOf = (item) => item.id ?? item.key
const expandedIndex = computed(() =>
  expandedKey.value == null ? -1 : props.data.findIndex((item) => keyOf(item) === expandedKey.value)
)
const isExpanded = (item) => expandedKey.value != null && keyOf(item) === expandedKey.value
const setExpansionElement = (element) => {
  expansion.value = element || undefined
}
const hasEmittedBottom = ref(false)
const bottomThreshold = 20
const viewportHeight = ref(0)
const previousScrollLeft = ref(0) // 记录上一次的横向滚动位置

// 计算总高度
const range = computed(() =>
  virtualRange(
    props.data.length,
    props.itemHeight,
    scrollTop.value,
    viewportHeight.value,
    expandedIndex.value,
    expandedHeight.value
  )
)
const totalHeight = computed(() => range.value.total)
const offset = computed(() => range.value.offset)

// 计算可见数据
const visibleData = computed(() => props.data.slice(range.value.start, range.value.end))

// 更新视口高度
const updateViewportHeight = () => {
  if (viewport.value) {
    viewportHeight.value = viewport.value.clientHeight
  }
}

// 滚动事件处理
const handleScroll = () => {
  const element = viewport.value
  if (!element) return

  // 纵向滚动处理
  scrollTop.value = element.scrollTop

  const reachedBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - bottomThreshold
  if (reachedBottom && !hasEmittedBottom.value) {
    hasEmittedBottom.value = true
    emit('reachBottom')
  } else if (!reachedBottom) {
    hasEmittedBottom.value = false
  }

  // 横向滚动处理
  const scrollLeft = element.scrollLeft
  if (scrollLeft !== previousScrollLeft.value) {
    emit('horizontalScroll', scrollLeft)
    previousScrollLeft.value = scrollLeft
  }
}

// Hosts can retain the reading position across detail views without accessing the internal viewport.
function scrollTo(top) {
  if (!viewport.value) return
  viewport.value.scrollTop = top
  handleScroll()
}
defineExpose({
  getScrollTop: () => viewport.value?.scrollTop ?? 0,
  scrollTo
})

// Keep the first visible summary anchored when an expansion above it changes size or closes.
function preserveAnchor(change) {
  const { start, offset: before } = range.value
  const within = scrollTop.value - before
  change()
  nextTick(() =>
    scrollTo(
      virtualRowOffset(start, props.itemHeight, expandedIndex.value, expandedHeight.value) +
        (start === expandedIndex.value ? within : Math.min(within, props.itemHeight - 1))
    )
  )
}
watch(
  () => props.expandedKey,
  (key) =>
    preserveAnchor(() => {
      expandedKey.value = key
      expandedHeight.value = 0
    })
)
useResizeObserver(expansion, (entries) => {
  if (entries[0]?.target !== expansion.value) return
  const height = Math.ceil(entries[0]?.contentRect.height || 0)
  if (height > 0 && height !== expandedHeight.value)
    preserveAnchor(() => {
      expandedHeight.value = height
    })
})
useResizeObserver(viewport, updateViewportHeight)

// 窗口大小变化处理（使用防抖优化性能）
let resizeTimer = null
const handleResize = () => {
  if (resizeTimer) {
    clearTimeout(resizeTimer)
  }
  resizeTimer = setTimeout(() => {
    updateViewportHeight()
  }, 100)
}

watch(
  () => props.data.length,
  () => {
    // 数据列表变化时允许再次触发底部事件
    hasEmittedBottom.value = false
  }
)

onMounted(() => {
  // 初始化容器高度
  if (!viewport.value.style.height) {
    viewport.value.style.height = '100%'
  }
  // 初始化视口高度
  updateViewportHeight()
  // 监听窗口大小变化
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  // 清理定时器和事件监听
  if (resizeTimer) {
    clearTimeout(resizeTimer)
  }
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.viewport {
  width: 100%;
  position: relative;
  overflow-y: auto;
  &:not(:last-child) {
    border-bottom: 1px solid var(--bg-hover);
  }
}
.phantom {
  position: absolute;
  width: 100%;
}
.list {
  position: absolute;
  width: 100%;
}
.list-item {
  box-sizing: border-box;
  width: 100%;
}
</style>
