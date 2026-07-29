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
export interface GeneralAgentPresentationRenderer {
  type: string;
  renderer: Component;
  /** Side-effect-free placeholder rendered while the assistant response is still streaming. */
  skeleton?: Component;
  decode?: (content: string) => unknown | undefined;
  presentation?: GeneralAgentMarkdownBlockPresentation;
}

/** @deprecated Markdown is only one compatibility envelope for a presentation renderer. */
export interface GeneralAgentMarkdownBlockRenderer extends GeneralAgentPresentationRenderer {}

export type GeneralAgentMarkdownBlockContentType = 'json' | 'text';

export type GeneralAgentMarkdownBlockDisplayMode = 'preview' | 'source';

export type GeneralAgentMarkdownBlockDeliveryPolicy = 'explicit' | 'preferred' | 'required';

export type GeneralAgentPresentationNarrativeMode = 'card-first' | 'analysis' | 'free';

/**
 * Bounded prose guidance owned by a presentation renderer.
 *
 * The runtime may expose this policy to the model, but it must never treat the policy as authorization or a
 * task-completion condition, and it must not rewrite model-authored text to enforce the limits.
 */
export interface GeneralAgentPresentationNarrativePolicy {
  mode: GeneralAgentPresentationNarrativeMode;
  allowedTextRoles: string[];
  maxTextBlocks: number;
  maxTextChars: number;
}

/**
 * Declares how a trusted conversation client can present one fenced block.
 *
 * The metadata is converted into a bounded model hint during session initialization. It is
 * presentation-only and must never be treated as authorization or a resource access grant.
 */
export interface GeneralAgentMarkdownBlockPresentation {
  contentType: GeneralAgentMarkdownBlockContentType;
  /** Canonical source media type consumed directly by the client renderer. */
  mediaType?: string;
  supportsSessionFile?: boolean;
  maxInlineBytes?: number;
  defaultMode?: GeneralAgentMarkdownBlockDisplayMode;
  /** Default delivery purpose; currently used to distinguish chat previews from reusable artifacts. */
  purpose?: 'conversation-preview';
  /** Generic tool result shapes that this renderer can present without a derived media artifact. */
  preferredInputShapes?: string[];
  /** Whether compatible result shapes are explicit-only, preferred, or required in the terminal response. */
  deliveryPolicy?: GeneralAgentMarkdownBlockDeliveryPolicy;
  /** Low-cardinality interaction tokens already provided by the rendered card. */
  affordances?: string[];
  /** Low-cardinality content tokens whose details are already rendered by the card. */
  contentResponsibilities?: string[];
  /** Renderer-owned prose guidance. It never changes task completion or grants capabilities. */
  narrativePolicy?: Partial<GeneralAgentPresentationNarrativePolicy>;
}

export interface GeneralAgentMarkdownPresentationCapability
  extends GeneralAgentMarkdownBlockPresentation {
  type: string;
}

const PRESENTATION_TYPE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const PRESENTATION_INPUT_SHAPE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,95}(?:\.\*)?$/;
const PRESENTATION_CONTENT_HINT_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

const normalizePresentationContentHints = (values?: string[]) => Array.from(new Set(
  (values || [])
    .map(value => normalizeText(value).toLowerCase())
    .filter(value => PRESENTATION_CONTENT_HINT_PATTERN.test(value)),
)).slice(0, 16);

const DEFAULT_NARRATIVE_POLICIES: Record<GeneralAgentPresentationNarrativeMode, GeneralAgentPresentationNarrativePolicy> = {
  'card-first': {
    mode: 'card-first',
    allowedTextRoles: ['summary', 'next_step'],
    maxTextBlocks: 2,
    maxTextChars: 300,
  },
  analysis: {
    mode: 'analysis',
    allowedTextRoles: ['summary', 'analysis', 'next_step'],
    maxTextBlocks: 4,
    maxTextChars: 1200,
  },
  free: {
    mode: 'free',
    allowedTextRoles: [],
    maxTextBlocks: 8,
    maxTextChars: 4000,
  },
};

const normalizePresentationNarrativePolicy = (
  policy: Partial<GeneralAgentPresentationNarrativePolicy> | undefined,
  hasContentResponsibilities: boolean,
): GeneralAgentPresentationNarrativePolicy => {
  const declaredMode = normalizeText(policy?.mode).toLowerCase() as GeneralAgentPresentationNarrativeMode;
  const mode: GeneralAgentPresentationNarrativeMode = ['card-first', 'analysis', 'free'].includes(declaredMode)
    ? declaredMode
    : (hasContentResponsibilities ? 'card-first' : 'free');
  const defaults = DEFAULT_NARRATIVE_POLICIES[mode];
  const allowedTextRoles = normalizePresentationContentHints(policy?.allowedTextRoles);
  return {
    mode,
    allowedTextRoles: allowedTextRoles.length ? allowedTextRoles : defaults.allowedTextRoles,
    maxTextBlocks: Math.max(1, Math.min(Number(policy?.maxTextBlocks) || defaults.maxTextBlocks, 8)),
    maxTextChars: Math.max(80, Math.min(Number(policy?.maxTextChars) || defaults.maxTextChars, 4000)),
  };
};

/**
 * Normalizes renderer metadata before it crosses the conversation boundary.
 *
 * Presentation metadata is descriptive only. Bounding it here prevents an extension from turning
 * arbitrary runtime data into a server-side routing, authorization, or prompt channel.
 */
export const normalizeGeneralAgentMarkdownPresentationCapability = (
  capability: GeneralAgentMarkdownPresentationCapability,
): GeneralAgentMarkdownPresentationCapability | undefined => {
  const type = normalizeText(capability?.type).toLowerCase();
  const contentType = normalizeText(capability?.contentType).toLowerCase();
  if (!PRESENTATION_TYPE_PATTERN.test(type) || !['json', 'text'].includes(contentType)) {
    return undefined;
  }
  const mediaType = normalizeText(capability.mediaType).toLowerCase().slice(0, 160);
  const preferredInputShapes = Array.from(new Set(
    (capability.preferredInputShapes || [])
      .map(value => normalizeText(value).toLowerCase())
      .filter(value => PRESENTATION_INPUT_SHAPE_PATTERN.test(value)),
  )).slice(0, 16);
  const deliveryPolicy = ['preferred', 'required'].includes(capability.deliveryPolicy || '')
    ? capability.deliveryPolicy as GeneralAgentMarkdownBlockDeliveryPolicy
    : 'explicit';
  const affordances = normalizePresentationContentHints(capability.affordances);
  const contentResponsibilities = normalizePresentationContentHints(capability.contentResponsibilities);
  const narrativePolicy = normalizePresentationNarrativePolicy(
    capability.narrativePolicy,
    contentResponsibilities.length > 0,
  );
  return {
    type,
    contentType: contentType as GeneralAgentMarkdownBlockContentType,
    ...(mediaType ? { mediaType } : {}),
    supportsSessionFile: capability.supportsSessionFile === true,
    maxInlineBytes: Math.max(0, Math.min(Number(capability.maxInlineBytes) || 0, 1024 * 1024)),
    defaultMode: capability.defaultMode === 'source' ? 'source' : 'preview',
    purpose: 'conversation-preview',
    ...(preferredInputShapes.length ? { preferredInputShapes } : {}),
    deliveryPolicy,
    ...(affordances.length ? { affordances } : {}),
    ...(contentResponsibilities.length ? { contentResponsibilities } : {}),
    narrativePolicy,
  };
};

export interface GeneralAgentResolvedPresentationBlock {
  type: string;
  renderer: Component;
  value: unknown;
}

/** @deprecated Use the neutral presentation block contract. */
export type GeneralAgentResolvedMarkdownBlock = GeneralAgentResolvedPresentationBlock;

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
  presentationRenderers?: GeneralAgentPresentationRenderer[];
  /** Compatibility renderers discovered from closed Markdown fences. */
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
      .sort((a, b) => (
        (a.order || 0) - (b.order || 0)
        || normalizeText(a.id).localeCompare(normalizeText(b.id))
      ));
  }

  getConversationExtensions(scopes: string | string[] = 'general') {
    return this.getExtensions(scopes).filter(extension => !!extension.conversation);
  }

  getPresentationRenderers(scopes: string | string[] = 'general') {
    const renderers: GeneralAgentPresentationRenderer[] = [];
    const seen = new Set<string>();
    for (const extension of this.getConversationExtensions(scopes)) {
      for (const renderer of [
        ...(extension.conversation?.presentationRenderers || []),
        ...(extension.conversation?.markdownBlockRenderers || []),
      ]) {
        const type = normalizeText(renderer.type).toLowerCase();
        if (!type || seen.has(type)) continue;
        seen.add(type);
        renderers.push(renderer);
      }
    }
    return renderers;
  }

  /** Returns the neutral presentation contract actually installed in the current client. */
  getPresentationCapabilities(
    scopes: string | string[] = 'general',
  ): GeneralAgentMarkdownPresentationCapability[] {
    const capabilities: GeneralAgentMarkdownPresentationCapability[] = [];
    const seen = new Set<string>();
    for (const renderer of this.getPresentationRenderers(scopes)) {
      const type = normalizeText(renderer.type).toLowerCase();
      if (!type || seen.has(type) || !renderer.presentation) continue;
      const capability = normalizeGeneralAgentMarkdownPresentationCapability({
        type,
        ...renderer.presentation,
      });
      if (!capability) continue;
      seen.add(type);
      capabilities.push(capability);
    }
    return capabilities;
  }

  /** @deprecated Use {@link getPresentationCapabilities}. */
  getMarkdownPresentationCapabilities(
    scopes: string | string[] = 'general',
  ): GeneralAgentMarkdownPresentationCapability[] {
    return this.getPresentationCapabilities(scopes);
  }

  /**
   * Resolves a typed assistant presentation through the installed renderer registry.
   * Decoder failures are isolated to the block and never break the conversation timeline.
   */
  resolvePresentationBlock(
    type: string,
    content: string,
    scopes: string | string[] = 'general',
  ): GeneralAgentResolvedPresentationBlock | undefined {
    const normalizedType = normalizeText(type).toLowerCase();
    if (!normalizedType) return undefined;

    for (const candidate of this.getPresentationRenderers(scopes)) {
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
        // Invalid capability payloads remain isolated to their presentation block.
      }
    }
    return undefined;
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
    return this.resolvePresentationBlock(type, content, scopes);
  }
}

export const generalAgentExtensionRegistry = new GeneralAgentExtensionRegistry();
