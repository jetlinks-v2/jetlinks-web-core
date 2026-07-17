export interface AiAgentHandoffTarget {
  handoffKey?: unknown;
  clientId?: unknown;
  subjectType?: unknown;
  subjectId?: unknown;
  subjectName?: unknown;
  scopeType?: unknown;
  scopeKey?: unknown;
  routeName?: unknown;
  menuCode?: unknown;
  path?: unknown;
}

export interface AiAgentHandoffPayload extends AiAgentHandoffTarget {
  prompt: unknown;
  label?: unknown;
  context?: unknown;
  source?: unknown;
}

export interface AiAgentHandoffRouteSource {
  name?: unknown;
  path?: unknown;
  query?: Record<string, any>;
  meta?: Record<string, any>;
}

export interface AiAgentHandoffRecord {
  id: string;
  target: {
    handoffKey?: string;
    clientId?: string;
    subjectType?: string;
    subjectId?: string;
    subjectName?: string;
    scopeType?: string;
    scopeKey?: string;
    routeName?: string;
    menuCode?: string;
    path?: string;
  };
  prompt: string;
  label?: string;
  context?: Record<string, any>;
  source?: string;
  createdAt: number;
  expiresAt: number;
}

const HANDOFF_PREFIX = 'jetlinks:ai-agent-handoff:';
const HANDOFF_POINTER_PREFIX = 'jetlinks:ai-agent-handoff-pointer:';
const CONVERSATION_KEY_PREFIX = 'jetlinks:ai-agent-conversation-key:';
const DEFAULT_TTL_MS = 30 * 60 * 1000;
const MAX_CONTEXT_CHARS = 6000;

const normalizeText = (value: unknown) => String(value || '').trim();

const encodePart = (value: string) => encodeURIComponent(value);

const createHandoffId = () => {
  try {
    const crypto = globalThis.crypto;
    const id = crypto?.randomUUID?.();
    if (id) return id;
    if (!crypto?.getRandomValues) return '';
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    return '';
  }
};

const normalizeTarget = (target: AiAgentHandoffTarget) => ({
  handoffKey: normalizeText(target.handoffKey),
  clientId: normalizeText(target.clientId),
  subjectType: normalizeText(target.subjectType),
  subjectId: normalizeText(target.subjectId),
  subjectName: normalizeText(target.subjectName),
  scopeType: normalizeText(target.scopeType),
  scopeKey: normalizeText(target.scopeKey),
  routeName: normalizeText(target.routeName),
  menuCode: normalizeText(target.menuCode),
  path: normalizeText(target.path),
});

const normalizeContext = (value: unknown): Record<string, any> | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  try {
    const text = JSON.stringify(value);
    if (!text) {
      return undefined;
    }
    if (text.length > MAX_CONTEXT_CHARS) {
      return {
        summary: text.slice(0, MAX_CONTEXT_CHARS),
        truncated: true,
      };
    }
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/**
 * Normalizes the page identity used by handoff producers and AiChat consumers.
 *
 * Producers write a random handoffKey and consumers use subject-like fields only
 * to find that key from the current tab pointer.
 */
export const resolveAiAgentHandoffTarget = (
  target: AiAgentHandoffTarget,
  route?: AiAgentHandoffRouteSource,
) => {
  const query = route?.query || {};
  const meta = route?.meta || {};
  return normalizeTarget({
    ...target,
    routeName: target.routeName
      || query.routeName
      || query.route
      || meta.routeName
      || route?.name,
    menuCode: target.menuCode
      || query.menu
      || query.menuCode
      || meta.menuCode
      || meta.code,
    path: target.path || route?.path,
  });
};

export const buildAiAgentHandoffKey = (target: AiAgentHandoffTarget) => {
  const normalized = normalizeTarget(target);
  const { handoffKey } = normalized;
  return handoffKey ? `${HANDOFF_PREFIX}${handoffKey}` : '';
};

const buildAiAgentTargetIdentity = (target: AiAgentHandoffTarget) => {
  const normalized = normalizeTarget(target);
  const { clientId, subjectType, subjectId } = normalized;
  const parts: string[] = [];
  if (clientId && subjectType && subjectId) {
    parts.push('client', clientId, 'subject', subjectType, subjectId);
  } else if (subjectType && subjectId) {
    parts.push('subject', subjectType, subjectId);
  }
  return parts.length ? parts.map(encodePart).join(':') : '';
};

const getHandoffPointerKey = (target: AiAgentHandoffTarget) => {
  const identity = buildAiAgentTargetIdentity(target);
  return identity ? `${HANDOFF_POINTER_PREFIX}${identity}` : '';
};

const getStorage = () => {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

const getSessionStorage = () => {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
};

const readHandoffPointer = (target: AiAgentHandoffTarget) => {
  const sessionStorage = getSessionStorage();
  const pointerKey = getHandoffPointerKey(target);
  if (!sessionStorage || !pointerKey) return '';
  return normalizeText(sessionStorage.getItem(pointerKey));
};

const writeHandoffPointer = (target: AiAgentHandoffTarget, handoffKey: string) => {
  const sessionStorage = getSessionStorage();
  const pointerKey = getHandoffPointerKey(target);
  if (!sessionStorage || !pointerKey || !handoffKey) return;
  try {
    sessionStorage.setItem(pointerKey, handoffKey);
  } catch {
    // Handoff still works through the explicit key; the pointer only helps same-tab navigation.
  }
};

const clearHandoffPointer = (target: AiAgentHandoffTarget, handoffKey?: string) => {
  const sessionStorage = getSessionStorage();
  const pointerKey = getHandoffPointerKey(target);
  if (!sessionStorage || !pointerKey) return;
  try {
    const current = normalizeText(sessionStorage.getItem(pointerKey));
    if (!handoffKey || current === handoffKey) {
      sessionStorage.removeItem(pointerKey);
    }
  } catch {
    // Ignore storage failures; stale pointers are cleaned up when the handoff record is missing.
  }
};

const resolveHandoffStorageTarget = (target: AiAgentHandoffTarget) => {
  const normalized = normalizeTarget(target);
  if (normalized.handoffKey) {
    return normalized;
  }
  const handoffKey = readHandoffPointer(normalized);
  return handoffKey ? { ...normalized, handoffKey } : normalized;
};

export const resolveAiAgentConversationHandoffKey = (target: AiAgentHandoffTarget) => {
  const normalized = normalizeTarget(target);
  if (normalized.handoffKey) {
    return normalized.handoffKey;
  }

  const pendingHandoffKey = readHandoffPointer(normalized);
  if (pendingHandoffKey) {
    return pendingHandoffKey;
  }

  const sessionStorage = getSessionStorage();
  const identity = buildAiAgentTargetIdentity(normalized);
  if (!sessionStorage || !identity) {
    return createHandoffId();
  }

  const storageKey = `${CONVERSATION_KEY_PREFIX}${identity}`;
  try {
    const existing = normalizeText(sessionStorage.getItem(storageKey));
    if (existing) {
      return existing;
    }
    const next = createHandoffId();
    sessionStorage.setItem(storageKey, next);
    return next;
  } catch {
    return createHandoffId();
  }
};

export const cleanupAiAgentHandoffs = () => {
  const storage = getStorage();
  if (!storage) return;

  const now = Date.now();
  try {
    Object.keys(storage)
      .filter((key) => key.startsWith(HANDOFF_PREFIX))
      .forEach((key) => {
        try {
          const record = JSON.parse(storage.getItem(key) || '{}') as AiAgentHandoffRecord;
          if (!Number.isFinite(record?.expiresAt) || record.expiresAt <= now) {
            storage.removeItem(key);
          }
        } catch {
          storage.removeItem(key);
        }
      });
  } catch {
    // Storage enumeration may be denied; handoff is optional and should not block UI.
  }
};

export const saveAiAgentHandoff = (payload: AiAgentHandoffPayload) => {
  const prompt = normalizeText(payload.prompt).slice(0, 1000);
  if (!prompt) return false;

  const normalizedPayload = normalizeTarget(payload);
  const handoffKey = normalizedPayload.handoffKey || createHandoffId();
  const target = {
    ...normalizedPayload,
    handoffKey,
  };
  const key = buildAiAgentHandoffKey(target);
  const storage = getStorage();
  if (!key || !storage) return false;

  const now = Date.now();
  try {
    cleanupAiAgentHandoffs();
    writeHandoffPointer(normalizedPayload, handoffKey);
    storage.setItem(key, JSON.stringify({
      id: createHandoffId(),
      target: Object.fromEntries(
        Object.entries(target).filter(([, value]) => !!value),
      ),
      prompt,
      label: normalizeText(payload.label) || undefined,
      context: normalizeContext(payload.context),
      source: normalizeText(payload.source) || undefined,
      createdAt: now,
      expiresAt: now + DEFAULT_TTL_MS,
    }));
    return true;
  } catch {
    return false;
  }
};

export const readAiAgentHandoff = (target: AiAgentHandoffTarget) => {
  const storageTarget = resolveHandoffStorageTarget(target);
  const key = buildAiAgentHandoffKey(storageTarget);
  const storage = getStorage();
  if (!key || !storage) return undefined;

  try {
    const record = JSON.parse(storage.getItem(key) || '{}') as AiAgentHandoffRecord;
    if (!record?.prompt || !Number.isFinite(record.expiresAt)) {
      return undefined;
    }
    if (record.expiresAt <= Date.now()) {
      storage.removeItem(key);
      clearHandoffPointer(storageTarget, storageTarget.handoffKey);
      return undefined;
    }
    return record;
  } catch {
    storage.removeItem(key);
    clearHandoffPointer(storageTarget, storageTarget.handoffKey);
    return undefined;
  }
};

export const hasPendingAiAgentHandoff = (target: AiAgentHandoffTarget) => (
  !!readAiAgentHandoff(target)
);

export const clearAiAgentHandoff = (target: AiAgentHandoffTarget) => {
  const storageTarget = resolveHandoffStorageTarget(target);
  const key = buildAiAgentHandoffKey(storageTarget);
  const storage = getStorage();
  if (!key || !storage) return false;

  try {
    storage.removeItem(key);
    clearHandoffPointer(storageTarget, storageTarget.handoffKey);
    return true;
  } catch {
    return false;
  }
};
