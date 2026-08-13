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
            ref="conversationRef"
            v-if="conversationComponent && activeAgent.agentId && activeAgent.clientType"
            :is="conversationComponent"
            :key="conversationKey"
            :agent-id="activeAgent.agentId"
            :agent-name="conversationTitle"
            :client-type="activeAgent.clientType || ''"
            :client-id="conversationClientId"
            :parameters="conversationParameters"
            :init-expands="conversationExpands"
            :subject-type="conversationSubject?.type || ''"
            :subject-id="conversationSubject?.id || ''"
            :client-tool-handler="conversationClientToolHandler"
            :client-tools="conversationClientTools"
            :client-tools-version="conversationClientToolsVersion"
            :client-tools-name="conversationClientToolsName"
            :client-tools-description="conversationClientToolsDescription"
            :workflow-guides="conversationWorkflowGuides"
            :reference-providers="conversationReferenceProviders"
            :composer-add-actions="conversationComposerAddActions"
            :session-files-enabled="conversationSessionFilesEnabled"
            :markdown-link-handler="conversationMarkdownLinkHandler"
            :system-prompt="conversationSystemPrompt"
            :opening-statement="conversationOpeningStatement"
            :welcome-text="conversationWelcomeText"
            :prompt-examples="conversationPromptExamples"
            :suggested-prompts="conversationSuggestedPrompts"
            :prefill-input-key="conversationHandoffPrompt?.id || ''"
            :prefill-input-value="conversationHandoffPrompt?.value || ''"
            :before-send-chat="handleConversationBeforeSend"
            :visible="open"
            @message="handleConversationMessage"
            @background-message="handleBackgroundMessage"
            @restored-messages="handleRestoredMessages"
            @socket-payload="handleConversationSocketPayload"
          >
            <template #header-extra>
              <a-dropdown
                v-if="availableAgents.length > 1"
                :get-popup-container="getDropdownContainer"
                :trigger="['click']"
              >
                <button
                  :aria-label="$t('components.AiChat.switchAgent')"
                  :title="$t('components.AiChat.switchAgent')"
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
                :aria-label="$t('components.AiChat.collapse')"
                :title="$t('components.AiChat.collapse')"
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
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch, type PropType } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry';
import { buildAgentSubjectPayload, normalizeAgentSubject } from './subject';
import type { AiClientToolCall } from './clientTools';
import type {
  GeneralAgentConversationChatPayload,
  GeneralAgentConversationMessage,
} from './generalAgentExtensions';
import { useFloatingPanel } from './useFloatingPanel';
import { useGeneralAgentConversationBridges } from './useGeneralAgentConversationBridges';
import {
  buildAiAgentHandoffKey,
  clearAiAgentHandoff,
  readAiAgentHandoff,
  resolveAiAgentConversationHandoffKey,
  resolveAiAgentHandoffTarget,
  type AiAgentHandoffRecord,
} from './agentHandoff';

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
  activeClientId: {
    type: String,
    default: '',
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
  (e: 'background-message', payload: any): void;
}>();

const { t: $t } = useI18n();
const route = useRoute();
const activeAgent = ref<AgentDeployRecord>({});
const conversationComponent = shallowRef<any>();
const conversationRef = ref<any>();
const restoredConversationMessages = ref<GeneralAgentConversationMessage[]>([]);
const activeHandoffRecord = ref<AiAgentHandoffRecord>();
const consumedHandoffId = ref('');
const appliedHandoffPromptId = ref('');
let handoffPrefillTimer: number | undefined;
let handoffPrefillCheckTimers: number[] = [];
let handoffPrefillRetryCount = 0;
const MAX_HANDOFF_PREFILL_RETRY = 20;
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
const normalizeDisplayText = (value: unknown) => String(value || '').trim();
const conversationClientId = computed(() => (
  normalizeDisplayText(props.parameters?.sessionClientId)
  || normalizeDisplayText(activeAgent.value?.clientId)
));
const conversationBaseParameters = computed(() => {
  const {
    clientTools,
    clientToolsVersion,
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
    workflowGuides,
    referenceProviders,
    composerAddActions,
    sessionFilesEnabled,
    sessionClientId,
    conversationTitle,
    headerTitle,
    clientTitle,
    onConversationMessage,
    ...rest
  } = props.parameters || {};
  return rest;
});

// 页面功能点传入的 subject 需要同时进入会话参数和 expands，确保首条消息建会话与历史过滤口径一致。
const conversationParameters = computed(() => ({
  ...conversationBaseParameters.value,
  ...(conversationHandoffContext.value ? { handoffContext: conversationHandoffContext.value } : {}),
  ...buildAgentSubjectPayload(conversationSubject.value),
}));

const conversationExpands = computed(() => ({
  clientId: conversationClientId.value,
  clientType: activeAgent.value?.clientType,
  ...buildAgentSubjectPayload(conversationSubject.value),
}));

const conversationTitle = computed(() => (
  normalizeDisplayText(props.parameters?.conversationTitle)
  || normalizeDisplayText(props.parameters?.headerTitle)
  || normalizeDisplayText(props.parameters?.clientTitle)
  || normalizeDisplayText(activeAgent.value?.others?.client?.name)
  || normalizeDisplayText(activeAgent.value?.clientName)
  || normalizeDisplayText(activeAgent.value?.clientId)
  || normalizeDisplayText(activeAgent.value?.agentName)
  || normalizeDisplayText(activeAgent.value?.agentId)
  || '--'
));
const conversationClientTools = computed(() => (
  Array.isArray(props.parameters?.clientTools) ? props.parameters.clientTools : []
));
const conversationClientToolsVersion = computed(() => props.parameters?.clientToolsVersion);
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
const conversationReferenceProviders = computed(() => (
  Array.isArray(props.parameters?.referenceProviders) ? props.parameters.referenceProviders : []
));
const conversationComposerAddActions = computed(() => (
  Array.isArray(props.parameters?.composerAddActions) ? props.parameters.composerAddActions : []
));
const conversationSessionFilesEnabled = computed(() => props.parameters?.sessionFilesEnabled !== false);
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
const conversationHandoffKey = computed(() => normalizeDisplayText(props.parameters?.handoffKey));
const conversationScopeKey = computed(() => normalizeDisplayText(
  props.parameters?.scopeKey
  || props.parameters?.scopeId
  || props.parameters?.projectId
  || props.parameters?.draftId
  || props.parameters?.editorId
  || props.parameters?.id,
));
const handoffTarget = computed(() => {
  const target = resolveAiAgentHandoffTarget({
    handoffKey: conversationHandoffKey.value,
    clientId: props.parameters?.sessionClientId
      || props.activeClientId
      || activeAgent.value?.clientId
      || props.parameters?.clientId,
    subjectType: conversationSubject.value?.type || props.parameters?.subjectType,
    subjectId: conversationSubject.value?.id || props.parameters?.subjectId,
    scopeType: props.parameters?.scopeType || props.parameters?.projectType,
    scopeKey: conversationScopeKey.value,
    routeName: props.parameters?.routeName,
    menuCode: props.parameters?.menuCode,
    path: props.parameters?.path,
  }, route);
  return {
    ...target,
    handoffKey: resolveAiAgentConversationHandoffKey(target),
  };
});
const handoffTargetKey = computed(() => buildAiAgentHandoffKey(handoffTarget.value));
const syncHandoffRecord = () => {
  const record = readAiAgentHandoff(handoffTarget.value);
  if (record) {
    activeHandoffRecord.value = record;
  }
};
const truncateHandoffPrompt = (value: string) => {
  const text = normalizeDisplayText(value);
  return text.length > 36 ? `${text.slice(0, 36)}...` : text;
};
const visibleHandoffRecord = computed(() => {
  const record = activeHandoffRecord.value;
  return record && record.id !== consumedHandoffId.value ? record : undefined;
});
const conversationHandoffContext = computed(() => {
  const record = activeHandoffRecord.value;
  if (!record) return undefined;
  const target = { ...(record.target || {}) };
  delete target.handoffKey;
  return {
    prompt: record.prompt,
    label: record.label,
    source: record.source,
    target,
    context: record.context,
    createdAt: record.createdAt,
  };
});
const conversationHandoffPrompt = computed(() => {
  const record = visibleHandoffRecord.value;
  if (!record?.prompt) return undefined;
  return {
    id: record.id,
    label: normalizeDisplayText(record.label)
      || $t('components.AiChat.agentHandoff.continue', [truncateHandoffPrompt(record.prompt)]),
    value: record.prompt,
  };
});
const conversationPromptExamples = computed(() => {
  const source = props.parameters?.promptExamples;
  const prompts = Array.isArray(source) ? [...source] : [];
  const handoffPrompt = conversationHandoffPrompt.value;
  if (!handoffPrompt) {
    return prompts;
  }
  const handoffValue = normalizeDisplayText(handoffPrompt.value);
  return [
    handoffPrompt,
    ...prompts.filter((item: any) => {
      const value = typeof item === 'string'
        ? normalizeDisplayText(item)
        : normalizeDisplayText(item?.value || item?.text || item?.label || item?.prompt);
      return value && value !== handoffValue;
    }),
  ];
});
const conversationSuggestedPrompts = computed(() => {
  const source = props.parameters?.suggestedPrompts;
  return Array.isArray(source) ? source : [];
});
const conversationIdentityKey = computed(() => (
  handoffTarget.value.handoffKey
  || handoffTargetKey.value
));

const clearHandoffPrefillCheckTimers = () => {
  handoffPrefillCheckTimers.forEach((timer) => window.clearTimeout(timer));
  handoffPrefillCheckTimers = [];
};

const scheduleHandoffPrefillStabilityCheck = (handoffId: string) => {
  clearHandoffPrefillCheckTimers();
  handoffPrefillCheckTimers = [240, 800, 1600, 3200, 6400].map((delay) => window.setTimeout(() => {
    if (!props.open || appliedHandoffPromptId.value !== handoffId) {
      return;
    }
    const state = conversationRef.value?.getConversationState?.();
    if (state && !state.hasDraftInput) {
      appliedHandoffPromptId.value = '';
      prefillHandoffPrompt();
    }
  }, delay));
};

const prefillHandoffPrompt = () => {
  const handoffPrompt = conversationHandoffPrompt.value;
  if (!props.open || !handoffPrompt?.value || appliedHandoffPromptId.value === handoffPrompt.id) {
    handoffPrefillRetryCount = 0;
    return;
  }
  void nextTick(() => {
    if (!conversationRef.value?.prefillInput || appliedHandoffPromptId.value === handoffPrompt.id) {
      if (!handoffPrefillTimer && handoffPrefillRetryCount < MAX_HANDOFF_PREFILL_RETRY) {
        handoffPrefillRetryCount += 1;
        handoffPrefillTimer = window.setTimeout(() => {
          handoffPrefillTimer = undefined;
          prefillHandoffPrompt();
        }, 120);
      }
      return;
    }
    if (handoffPrefillTimer) {
      window.clearTimeout(handoffPrefillTimer);
      handoffPrefillTimer = undefined;
    }
    handoffPrefillRetryCount = 0;
    appliedHandoffPromptId.value = handoffPrompt.id;
    conversationRef.value.prefillInput(handoffPrompt.value);
    // Session initialization can reset the composer after the child exposes its API.
    // Re-apply only while the draft is still empty, so user edits are never overwritten.
    scheduleHandoffPrefillStabilityCheck(handoffPrompt.id);
  });
};

const conversationKey = computed(() => [
  activeAgent.value?.agentId || '',
  activeAgent.value?.clientType || '',
  conversationClientId.value,
  conversationSubject.value?.type || '',
  conversationSubject.value?.id || '',
  conversationIdentityKey.value,
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
  const clientAgent = nextList.find((item) => item.clientId === props.activeClientId);
  // The global store may load multiple page-point agents; handoff must select the active page client.
  activeAgent.value = clientAgent || current || nextList[0];
};

const handleAgentClick = (event: { key: unknown }) => {
  const item = availableAgents.value.find((agent) => agent.agentId === String(event.key));
  if (item) {
    activeAgent.value = item;
  }
};

const handleBackgroundMessage = (payload: any) => {
  emits('background-message', payload);
};

const conversationBridges = useGeneralAgentConversationBridges({
  restoredMessages: restoredConversationMessages,
  t: $t,
  upsertLocalMessage: message => conversationRef.value?.upsertLocalMessage?.(message),
});

const handleConversationBeforeSend = (payload: GeneralAgentConversationChatPayload) => (
  conversationBridges.beforeSend(payload)
);

const handleRestoredMessages = (messages: GeneralAgentConversationMessage[]) => {
  restoredConversationMessages.value = messages;
};

const handleConversationSocketPayload = (payload: Record<string, unknown>) => {
  conversationBridges.onSocketPayload(payload);
};

const isLocalUserMessage = (message: any) => (
  message?.type === 'user'
  && (
    message?.headers?.origin === 'client'
    || String(message?.id || '').startsWith('local-user:')
  )
);

const handleConversationMessage = (message: any) => {
  conversationBridges.onMessage(message as GeneralAgentConversationMessage);
  if (typeof props.parameters?.onConversationMessage === 'function') {
    // Page runtimes can keep transient business context from the user's latest message
    // without leaking handler functions into the session init payload.
    try {
      props.parameters.onConversationMessage(message);
    } catch {
      // Message context is best-effort; chat delivery and handoff cleanup must continue.
    }
  }
  const record = visibleHandoffRecord.value;
  if (!isLocalUserMessage(message) || !record) {
    return;
  }
  // A handoff is a one-shot continuation hint; once the user sends a message,
  // clear the stored copy so reopening the page will not prefill it again.
  consumedHandoffId.value = record.id;
  appliedHandoffPromptId.value = '';
  clearHandoffPrefillCheckTimers();
  clearAiAgentHandoff(handoffTarget.value);
};

watch(
  () => [props.agentList, props.activeClientId],
  ([nextList]) => syncActiveAgent((nextList as AgentDeployRecord[]) || []),
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
      prefillHandoffPrompt();
    }
  },
);

watch(
  () => [
    props.open,
    !!conversationComponent.value,
    !!conversationRef.value?.prefillInput,
    activeAgent.value?.agentId,
    conversationHandoffPrompt.value?.id,
    conversationHandoffPrompt.value?.value,
    conversationKey.value,
  ],
  prefillHandoffPrompt,
  { immediate: true },
);

watch(
  () => handoffTargetKey.value,
  () => {
    activeHandoffRecord.value = undefined;
    consumedHandoffId.value = '';
    appliedHandoffPromptId.value = '';
    syncHandoffRecord();
  },
  { immediate: true },
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
  if (handoffPrefillTimer) {
    window.clearTimeout(handoffPrefillTimer);
    handoffPrefillTimer = undefined;
  }
  clearHandoffPrefillCheckTimers();
  handoffPrefillRetryCount = 0;
  cleanupFloatingPanel();
  window.removeEventListener('resize', handleWindowResize);
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<style src="./AiChatDrawer.less" lang="less" scoped />
