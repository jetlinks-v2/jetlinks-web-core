import { readonly, ref, type Component } from 'vue';
import {
  homeAgentCapabilityRegistry,
} from './homeAgentRegistry';
import type {
  GeneralAgentCapabilityProvider,
} from './generalAgentRuntime';
import { normalizeText, toArray } from './homeAgentShared';

export interface GeneralAgentConversationMessage {
  id: string;
  type: string;
  content?: string;
  payload?: unknown;
  headers: Record<string, unknown>;
  createdAt: number;
  isStreaming?: boolean;
  status?: string;
}

export interface GeneralAgentConversationChatPayload {
  content?: string;
  files?: unknown[];
  params?: Record<string, unknown>;
  configOptions?: Record<string, unknown>;
  commandArguments?: Record<string, unknown>;
}

export interface GeneralAgentConversationDisplayContext {
  capabilityKey: string;
  debug: boolean;
  sourceMessages?: GeneralAgentConversationMessage[];
  resolvedDisplayMessages?: GeneralAgentConversationMessage[];
}

export interface GeneralAgentConversationDisplayAdapter {
  debug?: boolean;
  removeTimelineMessage?: (
    message: GeneralAgentConversationMessage,
    context: GeneralAgentConversationDisplayContext,
  ) => boolean;
  suppressTimelineMessage?: (
    message: GeneralAgentConversationMessage,
    context: GeneralAgentConversationDisplayContext,
  ) => boolean;
  resolveSuppressedMessageKind?: (
    message: GeneralAgentConversationMessage,
    context: GeneralAgentConversationDisplayContext,
  ) => string | undefined;
  resolveDisplayMessage?: (
    message: GeneralAgentConversationMessage,
    context: GeneralAgentConversationDisplayContext,
  ) => GeneralAgentConversationMessage | undefined;
  resolveSocketDisplayMessage?: (
    payload: Record<string, unknown>,
    context: GeneralAgentConversationDisplayContext,
  ) => GeneralAgentConversationMessage | undefined;
}

export interface GeneralAgentConversationBridgeContext {
  t: (key: string, args?: unknown[] | Record<string, unknown>) => string;
  upsertLocalMessage: (message: GeneralAgentConversationMessage) => void;
}

export interface GeneralAgentConversationBridge {
  beforeSend?: (payload: GeneralAgentConversationChatPayload) => false | void;
  onMessage?: (message: GeneralAgentConversationMessage) => void;
  onSocketPayload?: (payload: Record<string, unknown>) => void;
  onRestoredMessages?: (messages: GeneralAgentConversationMessage[]) => void;
  dispose?: () => void;
}

export interface GeneralAgentConversationExtension {
  displayAdapter?: GeneralAgentConversationDisplayAdapter;
  suppressedMessageRenderer?: Component;
  createBridge?: (
    context: GeneralAgentConversationBridgeContext,
  ) => GeneralAgentConversationBridge;
}

export interface GeneralAgentExtension {
  id: string;
  order?: number;
  provider?: GeneralAgentCapabilityProvider;
  conversation?: GeneralAgentConversationExtension;
}

class GeneralAgentExtensionRegistry {
  private extensions = new Map<string, Array<{ extension: GeneralAgentExtension; token: symbol }>>();
  private versionState = ref(0);

  readonly version = readonly(this.versionState);

  private emitChange() {
    this.versionState.value += 1;
  }

  register(extension: GeneralAgentExtension, scope = 'general') {
    const id = normalizeText(extension?.id);
    if (!id) return () => undefined;

    const normalizedScope = normalizeText(scope) || 'general';
    const scopedId = `${normalizedScope}:${id}`;
    const token = Symbol(id);
    const extensions = this.extensions.get(scopedId) || [];
    this.extensions.set(scopedId, [...extensions, {
      extension: { ...extension, id },
      token,
    }]);
    const unregisterProvider = extension.provider
      ? homeAgentCapabilityRegistry.register(extension.provider, normalizedScope)
      : undefined;
    this.emitChange();

    return () => {
      unregisterProvider?.();
      const current = this.extensions.get(scopedId) || [];
      const next = current.filter(item => item.token !== token);
      if (next.length) {
        this.extensions.set(scopedId, next);
      } else {
        this.extensions.delete(scopedId);
      }
      if (current.length) this.emitChange();
    };
  }

  getExtensions(scopes: string | string[] = 'general') {
    const prefixes = toArray(scopes).map(scope => `${normalizeText(scope) || 'general'}:`);
    return Array.from(this.extensions.entries())
      .filter(([key]) => prefixes.some(prefix => key.startsWith(prefix)))
      .map(([, items]) => items[items.length - 1]?.extension)
      .filter((item): item is GeneralAgentExtension => !!item)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  getConversationExtensions(scopes: string | string[] = 'general') {
    return this.getExtensions(scopes).filter(extension => !!extension.conversation);
  }
}

export const generalAgentExtensionRegistry = new GeneralAgentExtensionRegistry();

