import {
  readonly,
  ref,
  type Component,
  type InjectionKey,
} from 'vue';
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

/**
 * Declares a Markdown fenced-block renderer owned by a general-agent capability.
 *
 * The fence info string is matched against `type`. Returning `undefined` from
 * `decode` rejects the block so the conversation falls back to a normal code block.
 */
export interface GeneralAgentMarkdownBlockRenderer {
  type: string;
  renderer: Component;
  decode?: (content: string) => unknown | undefined;
}

export interface GeneralAgentResolvedMarkdownBlock {
  type: string;
  renderer: Component;
  value: unknown;
}

export interface GeneralAgentMarkdownTextResourceOptions {
  maxBytes?: number;
}

/**
 * Resolves a capability-owned text resource through the active conversation boundary.
 *
 * Renderers receive only an opaque URI and never need the session id, HTTP endpoint or
 * authorization details used by the host conversation.
 */
export type GeneralAgentMarkdownTextResourceResolver = (
  uri: string,
  options?: GeneralAgentMarkdownTextResourceOptions,
) => Promise<string | undefined>;

export const GENERAL_AGENT_MARKDOWN_TEXT_RESOURCE_RESOLVER_KEY:
  InjectionKey<GeneralAgentMarkdownTextResourceResolver> = Symbol(
    'generalAgentMarkdownTextResourceResolver',
  );

/**
 * Extracts closed fenced blocks for one capability-owned type.
 *
 * This helper only locates the Markdown envelope. The owning capability still
 * defines and validates the block body through its decoder.
 */
export const findGeneralAgentMarkdownBlockContents = (
  source: string,
  type: string,
) => {
  const normalizedType = normalizeText(type).toLowerCase();
  if (!normalizedType || typeof source !== 'string') return [];

  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const contents: string[] = [];
  const openingPattern = /^[ \t]{0,3}((?:`{3,})|(?:~{3,}))[ \t]*([^ \t`~]+)?[^\n]*$/;

  for (let index = 0; index < lines.length; index += 1) {
    const opening = lines[index]?.match(openingPattern);
    if (!opening) continue;

    const fence = opening[1] || '';
    const fenceMarker = fence[0];
    const blockType = normalizeText(opening[2]).toLowerCase();
    let closingIndex = -1;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const closing = lines[cursor]?.trim() || '';
      if (
        closing.length >= fence.length
        && Array.from(closing).every(marker => marker === fenceMarker)
      ) {
        closingIndex = cursor;
        break;
      }
    }

    // Streaming tails are intentionally ignored until the closing fence arrives.
    if (closingIndex < 0) break;
    if (blockType === normalizedType) {
      contents.push(lines.slice(index + 1, closingIndex).join('\n'));
    }
    index = closingIndex;
  }

  return contents;
};

export interface GeneralAgentConversationExtension {
  displayAdapter?: GeneralAgentConversationDisplayAdapter;
  suppressedMessageRenderer?: Component;
  markdownBlockRenderers?: GeneralAgentMarkdownBlockRenderer[];
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

  /**
   * Resolves a fenced block through the currently loaded capability Extensions.
   * Decoder failures are treated as an unsupported block and never break Markdown rendering.
   */
  resolveMarkdownBlock(
    type: string,
    content: string,
    scopes: string | string[] = 'general',
  ): GeneralAgentResolvedMarkdownBlock | undefined {
    const normalizedType = normalizeText(type).toLowerCase();
    if (!normalizedType) return undefined;

    for (const extension of this.getConversationExtensions(scopes)) {
      const renderers = extension.conversation?.markdownBlockRenderers || [];
      for (const candidate of renderers) {
        if (normalizeText(candidate.type).toLowerCase() !== normalizedType) continue;
        try {
          const value = candidate.decode ? candidate.decode(content) : content;
          if (value !== undefined) {
            return {
              type: normalizedType,
              renderer: candidate.renderer,
              value,
            };
          }
        } catch {
          // Invalid capability payloads remain visible as ordinary source blocks.
        }
      }
    }
    return undefined;
  }
}

export const generalAgentExtensionRegistry = new GeneralAgentExtensionRegistry();
