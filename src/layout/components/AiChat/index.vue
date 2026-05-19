<template>
  <div
    v-if="showAiButton"
    class="ai-float-btn-wrapper"
    @click="onOpen"
  >
    <div class="ai-sparkle ai-sparkle-1">✦</div>
    <div class="ai-sparkle ai-sparkle-2">✦</div>
    <div class="ai-sparkle ai-sparkle-3">✦</div>
    <a-button
      type="primary"
      shape="circle"
      class="ai-float-btn"
    >
      <svg
        class="ai-icon"
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
        ></path>
        <path d="M20 3v4"></path>
        <path d="M22 5h-4"></path>
        <path d="M4 17v2"></path>
        <path d="M5 18H3"></path>
      </svg>
    </a-button>
  </div>
  <!-- 全局抽屉 -->
  <AiChatDrawer
    @close="onClose"
    v-if="showAiDrawer"
    :agentList="agentList"
    :parameters="parameters"
  />
</template>

<script setup>
import AiChatDrawer from './AiChatDrawer.vue'
import { useAIStore } from '@jetlinks-web-core/store'
import { storeToRefs } from 'pinia'

const aiStore = useAIStore()
const { showAiDrawer, showAiButton, agentList, parameters } = storeToRefs(aiStore)

const onClose = () => {
  aiStore.setDrawer(false)
}

const onOpen = () => {
  aiStore.setDrawer(true)
}
</script>

<style lang="less" scoped>
.ai-float-btn-wrapper {
  position: fixed;
  bottom: 1.375rem;
  right: 1.375rem;
  z-index: 999;
  width: 4.375rem;
  height: 4.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:hover {
    .ai-float-btn {
      transform: scale(1.1);
      box-shadow: 0 0 1.875rem rgba(22, 119, 255, 0.6);
    }
    .ai-icon {
      animation: icon-wiggle 0.5s ease-in-out;
    }
    .ai-sparkle {
      opacity: 1;
      animation-duration: 0.8s;
    }
  }

  &:active .ai-float-btn {
    transform: scale(0.95);
  }
}

.ai-float-btn {
  width: 3.25rem;
  height: 3.25rem;
  font-size: var(--fs-24);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 10;
  transition: all 0.3s ease;
  box-shadow: 0 0 1.25rem rgba(22, 119, 255, 0.35);
}

.ai-icon {
  animation: icon-pulse 2.5s ease-in-out infinite;
}

.ai-sparkle {
  position: absolute;
  color: var(--jet-theme-primary);
  font-size: var(--fs-12);
  opacity: 0;
  z-index: 1;
  text-shadow: 0 0 0.25rem #1677ff;
  pointer-events: none;
}

.ai-sparkle-1 {
  top: 0.375rem;
  right: 0.5rem;
  animation: sparkle-blink 2s ease-in-out infinite;
}

.ai-sparkle-2 {
  bottom: 0.625rem;
  left: 0.375rem;
  font-size: var(--fs-12);
  animation: sparkle-blink 2.5s ease-in-out infinite 0.8s;
}

.ai-sparkle-3 {
  top: 0.875rem;
  left: 0.625rem;
  font-size: var(--fs-12);
  animation: sparkle-blink 3s ease-in-out infinite 1.5s;
}

@keyframes icon-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.9;
    transform: scale(0.96);
  }
}

@keyframes icon-wiggle {
  0% {
    transform: scale(1);
    filter: drop-shadow(0 0 0 rgba(22, 119, 255, 0));
  }
  50% {
    transform: scale(1.15);
    filter: drop-shadow(0 0 0.5rem rgba(22, 119, 255, 0.8));
  }
  100% {
    transform: scale(1);
    filter: drop-shadow(0 0 0 rgba(22, 119, 255, 0));
  }
}

@keyframes sparkle-blink {
  0%,
  100% {
    opacity: 0;
    transform: scale(0.5);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
}</style>
