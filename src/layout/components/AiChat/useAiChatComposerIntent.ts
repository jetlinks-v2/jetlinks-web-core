import {
  nextTick,
  onScopeDispose,
  ref,
  watch,
  type Ref,
  type WatchSource,
} from 'vue';
import {
  GENERAL_AGENT_COMPOSER_INTENT_EVENT,
  type GeneralAgentConversationChatPayload,
} from './generalAgentExtensions';

interface AiChatComposerIntent {
  action: 'focus' | 'prefill';
  value?: string;
  placeholder?: string;
  nextSendParams?: Record<string, unknown>;
}

interface UseAiChatComposerIntentOptions {
  target: Ref<HTMLElement | undefined>;
  resetKey: WatchSource<unknown>;
  focusInput: () => void;
  prefillInput: (value: string) => void;
}

const toRecord = (value: unknown): Record<string, unknown> | undefined => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
);

const resolveComposerIntent = (value: unknown): AiChatComposerIntent | undefined => {
  const record = toRecord(value);
  const action = String(record?.action || '').trim();
  if (action !== 'focus' && action !== 'prefill') return undefined;

  const nextSendParams = toRecord(record?.nextSendParams);
  return {
    action,
    value: typeof record?.value === 'string' ? record.value : undefined,
    placeholder: typeof record?.placeholder === 'string' ? record.placeholder : undefined,
    nextSendParams: nextSendParams ? { ...nextSendParams } : undefined,
  };
};

/**
 * Hosts DOM-scoped composer intents for the floating general-agent surface.
 * Pending send parameters are one-shot and are cleared whenever the conversation identity changes.
 */
export const useAiChatComposerIntent = (options: UseAiChatComposerIntentOptions) => {
  const placeholder = ref('');
  let pendingNextSendParams: Record<string, unknown> | undefined;

  const reset = () => {
    placeholder.value = '';
    pendingNextSendParams = undefined;
  };

  const handleComposerIntent = (event: Event) => {
    const intent = resolveComposerIntent((event as CustomEvent).detail);
    if (!intent) return;

    event.stopPropagation();
    pendingNextSendParams = intent.nextSendParams;
    if (intent.placeholder !== undefined) placeholder.value = intent.placeholder.trim();
    if (intent.action === 'prefill') options.prefillInput(intent.value || '');
    void nextTick(options.focusInput);
  };

  watch(
    options.target,
    (current, previous) => {
      previous?.removeEventListener(GENERAL_AGENT_COMPOSER_INTENT_EVENT, handleComposerIntent);
      current?.addEventListener(GENERAL_AGENT_COMPOSER_INTENT_EVENT, handleComposerIntent);
    },
    { immediate: true, flush: 'post' },
  );
  watch(options.resetKey, reset);

  const consumeNextSendParams = (payload: GeneralAgentConversationChatPayload) => {
    const nextSendParams = pendingNextSendParams;
    pendingNextSendParams = undefined;
    if (!nextSendParams) return payload;
    return {
      ...payload,
      params: {
        ...(payload.params || {}),
        ...nextSendParams,
      },
    };
  };

  onScopeDispose(() => {
    options.target.value?.removeEventListener(GENERAL_AGENT_COMPOSER_INTENT_EVENT, handleComposerIntent);
    pendingNextSendParams = undefined;
  });

  return {
    placeholder,
    consumeNextSendParams,
  };
};
