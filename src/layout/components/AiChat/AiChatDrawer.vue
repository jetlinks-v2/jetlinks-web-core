<template>
  <Teleport to="body">
    <section
      ref="panelRef"
      v-show="open"
      class="ai-chat-bubble-panel"
      :class="{
        'ai-chat-bubble-panel--ready': isPositionReady,
        'ai-chat-bubble-panel--dragging': isDragging,
        'ai-chat-bubble-panel--resizing': isResizing,
      }"
      :style="panelStyle"
      role="dialog"
      aria-modal="false"
      :aria-hidden="!open"
    >
      <div class="ai-chat-bubble-panel__content" @pointerdown="handlePanelDragStart">
        <div class="ai-iframe-container">
          <component
            v-if="conversationComponent && activeAgent.agentId && activeAgent.clientType"
            :is="conversationComponent"
            :key="conversationKey"
            :agent-id="activeAgent.agentId"
            :agent-name="activeAgentName"
            :client-type="activeAgent.clientType || ''"
            :client-id="activeAgent.clientId || ''"
            :parameters="conversationParameters"
            :init-expands="conversationExpands"
            :subject-type="conversationSubject?.type || ''"
            :subject-id="conversationSubject?.id || ''"
            :client-tool-handler="conversationClientToolHandler"
            :client-tools="conversationClientTools"
            :client-tools-name="conversationClientToolsName"
            :client-tools-description="conversationClientToolsDescription"
            :workflow-guides="conversationWorkflowGuides"
            :markdown-link-handler="conversationMarkdownLinkHandler"
            :system-prompt="conversationSystemPrompt"
            :opening-statement="conversationOpeningStatement"
            :welcome-text="conversationWelcomeText"
            :prompt-examples="conversationPromptExamples"
            :suggested-prompts="conversationSuggestedPrompts"
          >
            <template #header-extra>
              <a-dropdown
                v-if="availableAgents.length > 1"
                :get-popup-container="getDropdownContainer"
                :trigger="['click']"
              >
                <button
                  aria-label="切换智能体"
                  title="切换智能体"
                  class="ai-chat-bubble-panel__icon-action"
                  type="button"
                  @click.prevent
                  @pointerdown.stop
                >
                  <AIcon type="DownOutlined" />
                </button>
                <template #overlay>
                  <a-menu @click="handleAgentClick">
                    <a-menu-item v-for="item in availableAgents" :key="item.agentId">
                      {{ item?.agentName || item.agentId }}
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
              <button
                aria-label="收起对话"
                title="收起对话"
                class="ai-chat-bubble-panel__icon-action"
                type="button"
                @click="emits('close')"
                @pointerdown.stop
              >
                <AIcon type="CloseOutlined" />
              </button>
            </template>
          </component>
          <CloudEmpty v-else class="ai-chat-drawer__empty" />
        </div>
        <span
          class="ai-chat-bubble-panel__resize ai-chat-bubble-panel__resize--right"
          @pointerdown="handleResizeStart('right', $event)"
        />
        <span
          class="ai-chat-bubble-panel__resize ai-chat-bubble-panel__resize--bottom"
          @pointerdown="handleResizeStart('bottom', $event)"
        />
        <span
          class="ai-chat-bubble-panel__resize ai-chat-bubble-panel__resize--corner"
          @pointerdown="handleResizeStart('corner', $event)"
        />
      </div>
    </section>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, onMounted, ref, shallowRef, watch, type PropType } from 'vue';
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry';
import { buildAgentSubjectPayload, normalizeAgentSubject } from './subject';
import type { AiClientToolCall } from './clientTools';
import { useFloatingPanel } from './useFloatingPanel';

interface AgentDeployRecord {
  agentId?: string;
  agentName?: string;
  clientId?: string;
  clientType?: string;
  others?: {
    client?: {
      name?: string;
    };
  };
  [key: string]: any;
}

type AiChatClientToolHandler = (payload: AiClientToolCall) => Promise<any> | any;
type AiChatMarkdownLinkHandler = (payload: Record<string, any>) => boolean | void;
const CLOSE_TRANSIENT_OVERLAYS_EVENT = 'ai-chat-close-transient-overlays';
const PANEL_TRANSIENT_OVERLAY_SELECTOR = [
  '.agent-access-history-popover',
  '.agent-conversation__composer-action-panel',
  '.agent-conversation__reference-panel',
  '.container-file-manager-popover',
].join(',');
const MODAL_TRANSIENT_OVERLAY_SELECTOR = [
  '.container-file-preview-modal',
  '.container-file-create-modal',
  '.ant-modal-confirm',
].join(',');

const props = defineProps({
  agentList: {
    type: Array as PropType<AgentDeployRecord[]>,
    default: () => [],
  },
  parameters: {
    type: Object as PropType<Record<string, any>>,
    default: () => ({}),
  },
  anchorRect: {
    type: Object as PropType<{ x: number; y: number; width: number; height: number } | undefined>,
    default: undefined,
  },
  anchorDragging: {
    type: Boolean,
    default: false,
  },
  initialPanelSize: {
    type: Object as PropType<{ width: number; height: number } | undefined>,
    default: undefined,
  },
  open: {
    type: Boolean,
    default: true,
  },
});

const emits = defineEmits<{
  (e: 'close'): void;
  (e: 'anchor-drag', delta: { x: number; y: number }): void;
  (e: 'panel-size-change', size: { width: number; height: number }): void;
}>();

const activeAgent = ref<AgentDeployRecord>({});
const conversationComponent = shallowRef<any>();
const {
  panelRef,
  panelStyle,
  isDragging,
  isResizing,
  isPositionReady,
  initPanelPosition,
  handleWindowResize,
  handleDragStart,
  handleResizeStart,
  movePanelBy,
  cleanupFloatingPanel,
} = useFloatingPanel({
  widthRatio: 0.44,
  heightRatio: 0.78,
  minWidth: 520,
  minHeight: 520,
  maxWidth: 720,
  maxHeight: 760,
  anchorOverlap: 30,
  initialSize: props.initialPanelSize,
  getAnchorRect: () => props.anchorRect,
  onDragMove: (delta) => emits('anchor-drag', delta),
  onSizeChange: (size) => emits('panel-size-change', size),
});

const availableAgents = computed(() => props.agentList || []);
const conversationSubject = computed(() => normalizeAgentSubject(props.parameters || {}));
const conversationBaseParameters = computed(() => {
  const {
    clientTools,
    clientToolHandler,
    clientToolsName,
    clientToolsDescription,
    markdownLinkHandler,
    onMarkdownLinkClick,
    systemPrompt,
    agentSystemPrompt,
    sceneSystemPrompt,
    openingStatement,
    welcomeText,
    promptExamples,
    suggestedPrompts,
    ...rest
  } = props.parameters || {};
  return rest;
});

// 页面功能点传入的 subject 需要同时进入会话参数和 expands，确保首条消息建会话与历史过滤口径一致。
const conversationParameters = computed(() => ({
  ...conversationBaseParameters.value,
  ...buildAgentSubjectPayload(conversationSubject.value),
}));

const conversationExpands = computed(() => ({
  clientId: activeAgent.value?.clientId,
  clientType: activeAgent.value?.clientType,
  ...buildAgentSubjectPayload(conversationSubject.value),
}));

const activeAgentName = computed(() => activeAgent.value?.agentName || activeAgent.value?.agentId || '--');
const conversationClientTools = computed(() => (
  Array.isArray(props.parameters?.clientTools) ? props.parameters.clientTools : []
));
const conversationClientToolHandler = computed<AiChatClientToolHandler | undefined>(() => (
  typeof props.parameters?.clientToolHandler === 'function'
    ? props.parameters.clientToolHandler
    : undefined
));
const conversationClientToolsName = computed(() => String(props.parameters?.clientToolsName || ''));
const conversationClientToolsDescription = computed(() => String(props.parameters?.clientToolsDescription || ''));
const conversationWorkflowGuides = computed(() => (
  Array.isArray(props.parameters?.workflowGuides) ? props.parameters.workflowGuides : []
));
const conversationMarkdownLinkHandler = computed<AiChatMarkdownLinkHandler | undefined>(() => {
  const handler = props.parameters?.markdownLinkHandler || props.parameters?.onMarkdownLinkClick;
  return typeof handler === 'function' ? handler : undefined;
});
const conversationSystemPrompt = computed(() => String(
  props.parameters?.systemPrompt
  || props.parameters?.agentSystemPrompt
  || props.parameters?.sceneSystemPrompt
  || '',
));
const conversationOpeningStatement = computed(() => String(
  props.parameters?.openingStatement || '',
).trim());
const conversationWelcomeText = computed(() => String(props.parameters?.welcomeText || '').trim());
const conversationPromptExamples = computed(() => {
  const source = props.parameters?.promptExamples;
  return Array.isArray(source) ? source : [];
});
const conversationSuggestedPrompts = computed(() => {
  const source = props.parameters?.suggestedPrompts;
  return Array.isArray(source) ? source : [];
});

const conversationKey = computed(() => [
  activeAgent.value?.agentId || '',
  activeAgent.value?.clientType || '',
  activeAgent.value?.clientId || '',
  conversationSubject.value?.type || '',
  conversationSubject.value?.id || '',
  conversationClientToolsName.value,
  JSON.stringify(conversationWorkflowGuides.value || []),
  conversationSystemPrompt.value,
].join('|'));

const handleKeydown = (event: KeyboardEvent) => {
  if (!props.open) {
    return;
  }
  if (event.defaultPrevented) {
    return;
  }
  if (event.key === 'Escape') {
    if (panelRef.value?.querySelector(PANEL_TRANSIENT_OVERLAY_SELECTOR)) {
      window.dispatchEvent(new CustomEvent(CLOSE_TRANSIENT_OVERLAYS_EVENT));
      event.preventDefault();
      return;
    }
    if (document.querySelector(MODAL_TRANSIENT_OVERLAY_SELECTOR)) {
      return;
    }
    emits('close');
  }
};

const getDropdownContainer = (triggerNode: HTMLElement) => (
  panelRef.value || triggerNode.parentElement || document.body
);

const handlePanelDragStart = (event: PointerEvent) => {
  const target = event.target;
  if (target instanceof Element && target.closest('.agent-access__conversation-header')) {
    handleDragStart(event);
  }
};

const syncActiveAgent = (nextList: AgentDeployRecord[] = []) => {
  if (!nextList.length) {
    activeAgent.value = {};
    return;
  }

  const current = nextList.find((item) => item.agentId === activeAgent.value?.agentId);
  activeAgent.value = current || nextList[0];
};

const handleAgentClick = (event: { key: unknown }) => {
  const item = availableAgents.value.find((agent) => agent.agentId === String(event.key));
  if (item) {
    activeAgent.value = item;
  }
};

watch(
  () => props.agentList,
  (nextList) => syncActiveAgent(nextList || []),
  { immediate: true },
);

watch(
  () => props.anchorRect,
  () => {
    if (props.open && isPositionReady.value && !isDragging.value && !isResizing.value && !props.anchorDragging) {
      void initPanelPosition();
    }
  },
  { deep: true },
);

watch(
  () => props.open,
  (value) => {
    if (value) {
      void initPanelPosition();
    }
  },
);

defineExpose({
  movePanelBy,
});

onMounted(() => {
  const component = moduleRegistry.getResourceItem(
    'jetlinks-ai-agent-ui',
    'components',
    'AgentAccessConversation',
  );
  conversationComponent.value = component ? markRaw(component) : undefined;
  void initPanelPosition();
  window.addEventListener('resize', handleWindowResize);
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  cleanupFloatingPanel();
  window.removeEventListener('resize', handleWindowResize);
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<style src="./AiChatDrawer.less" lang="less" scoped />
