<template>
  <div
    ref="bubbleRef"
    v-if="showAiButton"
    class="ai-float-btn-wrapper"
    :class="[
      bubbleConfig.className,
      {
        'ai-float-btn-wrapper--active': showAiDrawer,
        'ai-float-btn-wrapper--ready': isBubbleReady,
        'ai-float-btn-wrapper--dragging': isBubbleDragging,
        [`ai-float-btn-wrapper--dock-${bubbleDockSide}`]: bubbleDockSide !== 'free',
      },
    ]"
    :style="bubbleStyle"
    @pointerdown="handleBubbleDragStart"
    @click="handleBubbleClick"
  >
    <span class="ai-float-btn__halo" />
    <a-badge
      class="ai-float-btn__badge"
      :count="bubbleUnreadCount"
      :overflow-count="99"
    >
      <button
        type="button"
        :aria-label="bubbleAriaLabel"
        :title="bubbleAriaLabel"
        class="ai-float-btn"
      >
        <span class="ai-float-btn__core">
          <span class="ai-float-btn__robot" aria-hidden="true">
            <AIcon
              v-if="bubbleConfig.icon"
              :type="bubbleConfig.icon"
              class="ai-float-btn__robot-icon"
            />
            <RobotOutlined v-else class="ai-float-btn__robot-icon" />
            <span
              v-if="bubbleConfig.iconBadge"
              class="ai-float-btn__robot-badge"
              aria-hidden="true"
            >
              <AIcon
                :type="bubbleConfig.iconBadge"
                class="ai-float-btn__robot-badge-icon"
              />
            </span>
            <span class="ai-float-btn__robot-scan" />
          </span>
        </span>
        <span class="ai-float-btn__status" />
      </button>
    </a-badge>
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
    @background-message="handleBackgroundMessage"
  />
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AiChatDrawer from './AiChatDrawer.vue'
import { useAIStore } from '@jetlinks-web-core/store'
import { storeToRefs } from 'pinia'
import { useFloatingBubble } from './useFloatingBubble'
import { RobotOutlined } from '@ant-design/icons-vue'
import './AiChatLauncher.less'

const { t: $t } = useI18n()
const aiStore = useAIStore()
const {
  showAiDrawer,
  showAiButton,
  agentList,
  parameters,
  bubbleConfig,
  bubbleUnreadCount,
} = storeToRefs(aiStore)
const drawerRef = ref()
const manualPanelSize = ref()
const drawerMounted = ref(false)
const bubbleAriaLabel = computed(() => bubbleConfig.value.tooltip || $t('components.AiChat.open'))
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

const handleBackgroundMessage = () => {
  aiStore.incrementBubbleUnread()
}

watch(showAiDrawer, (value) => {
  if (value) {
    drawerMounted.value = true
    aiStore.clearBubbleUnread()
  }
}, { immediate: true })

watch(showAiButton, (value) => {
  if (!value) {
    drawerMounted.value = false
  }
})
</script>
