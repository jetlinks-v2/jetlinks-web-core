<template>
  <div
    ref="bubbleRef"
    v-if="showAiButton"
    class="ai-float-btn-wrapper"
    :class="{
      'ai-float-btn-wrapper--active': showAiDrawer,
      'ai-float-btn-wrapper--ready': isBubbleReady,
      'ai-float-btn-wrapper--dragging': isBubbleDragging,
      [`ai-float-btn-wrapper--dock-${bubbleDockSide}`]: bubbleDockSide !== 'free',
    }"
    :style="bubbleStyle"
    @pointerdown="handleBubbleDragStart"
    @click="handleBubbleClick"
  >
    <span class="ai-float-btn__halo" />
    <button
      type="button"
      aria-label="智能体对话"
      class="ai-float-btn"
    >
      <span class="ai-float-btn__core">
        <span class="ai-float-btn__robot" aria-hidden="true">
          <RobotOutlined class="ai-float-btn__robot-icon" />
          <span class="ai-float-btn__robot-scan" />
        </span>
      </span>
      <span class="ai-float-btn__status" />
    </button>
  </div>
  <!-- 全局浮动对话框 -->
  <AiChatDrawer
    ref="drawerRef"
    @close="onClose"
    @anchor-drag="handlePanelAnchorDrag"
    @panel-size-change="handlePanelSizeChange"
    v-if="drawerMounted && showAiButton"
    :open="showAiDrawer"
    :agentList="agentList"
    :parameters="parameters"
    :anchorRect="bubbleAnchorRect"
    :anchorDragging="isBubbleDragging"
    :initialPanelSize="manualPanelSize"
  />
</template>

<script setup>
import { ref, watch } from 'vue'
import AiChatDrawer from './AiChatDrawer.vue'
import { useAIStore } from '@jetlinks-web-core/store'
import { storeToRefs } from 'pinia'
import { useFloatingBubble } from './useFloatingBubble'
import { RobotOutlined } from '@ant-design/icons-vue'
import './AiChatLauncher.less'

const aiStore = useAIStore()
const { showAiDrawer, showAiButton, agentList, parameters } = storeToRefs(aiStore)
const drawerRef = ref()
const manualPanelSize = ref()
const drawerMounted = ref(false)
const {
  bubbleRef,
  bubbleStyle,
  bubbleAnchorRect,
  bubbleDockSide,
  isBubbleReady,
  isBubbleDragging,
  handleBubbleDragStart,
  consumeBubbleDragClick,
  moveBubbleBy,
} = useFloatingBubble({
  onDragMove: (delta) => {
    if (showAiDrawer.value) {
      drawerRef.value?.movePanelBy?.(delta)
    }
  },
})

const onClose = () => {
  aiStore.setDrawer(false)
}

const onToggle = () => {
  aiStore.setDrawer(!showAiDrawer.value)
}

const handleBubbleClick = (event) => {
  if (consumeBubbleDragClick()) {
    event.preventDefault()
    event.stopPropagation()
    return
  }
  onToggle()
}

const handlePanelAnchorDrag = (delta) => {
  moveBubbleBy(delta)
}

const handlePanelSizeChange = (size) => {
  manualPanelSize.value = size
}

watch(showAiDrawer, (value) => {
  if (value) {
    drawerMounted.value = true
  }
}, { immediate: true })

watch(showAiButton, (value) => {
  if (!value) {
    drawerMounted.value = false
  }
})
</script>
