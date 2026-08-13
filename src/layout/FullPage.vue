<template>
  <div
    ref="fullPage"
    :style="styles"
    :class="{
      'full-page-warp': true,
      'full-page-warp--flex': flex,
      scroll: showScroll
    }"
  >
    <slot></slot>
  </div>
</template>

<script setup name="FullPage">
const props = defineProps({
  extraHeight: {
    type: Number,
    default: 0
  },
  showScroll: {
    type: Boolean,
    default: false
  },
  padding: {
    type: Number,
    default: 24
  },
  fixed: {
    type: Boolean,
    default: true
  },
  margin: {
    type: String,
    default: undefined
  },
  transparentBackground: {
    type: Boolean,
    default: false
  },
  flex: {
    type: Boolean,
    default: false
  }
})

const fullPage = ref(null)
const MinHeight = ref(`0`)

const styles = computed(() => {
  let sizeStyle
  if (props.fixed !== false) {
    sizeStyle = {
      height: MinHeight.value || '100%'
    }
  } else {
    sizeStyle = {
      minHeight: MinHeight.value,
      margin: props.margin || '0 0 1.5rem 0'
    }
  }

  return {
    ...sizeStyle,
    background: props.transparentBackground ? 'transparent' : '#fff'
  }
})

let mountTimer
let layoutFrame
let resizeFrame

const updateHeight = () => {
  if (!fullPage.value) return

  const top = fullPage.value.getBoundingClientRect().top
  const _y = top < 0 ? 0 : top
  const height = _y + props.extraHeight + props.padding

  MinHeight.value = `calc(100vh - ${height}px)`

  if (props.flex && props.fixed !== false) {
    window.cancelAnimationFrame(layoutFrame)
    layoutFrame = window.requestAnimationFrame(() => {
      const documentElement = document.documentElement
      const overflowHeight = Math.max(documentElement.scrollHeight - documentElement.clientHeight, 0)

      // flex 页面由自身或后代承接滚动；扣除祖先尾部间距，避免根节点出现第二条滚动条。
      if (overflowHeight > 0) {
        MinHeight.value = `calc(100vh - ${height + overflowHeight}px)`
      }
    })
  }
}

const handleResize = () => {
  window.cancelAnimationFrame(resizeFrame)
  resizeFrame = window.requestAnimationFrame(updateHeight)
}

onMounted(() => {
  mountTimer = window.setTimeout(updateHeight, 10)
  if (props.flex) {
    window.addEventListener('resize', handleResize)
  }
})

onBeforeUnmount(() => {
  window.clearTimeout(mountTimer)
  window.cancelAnimationFrame(layoutFrame)
  window.cancelAnimationFrame(resizeFrame)
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped lang="less">
.full-page-warp {
  &--flex {
    display: flex;
    min-height: 0;
    flex: 1 1 auto;
    flex-direction: column;
    overflow-y: auto;
  }
  &.scroll {
    overflow-y: auto;
  }
}
</style>
