export interface AiAgentHandoffTarget {
  clientId?: unknown;
  subjectType?: unknown;
  subjectId?: unknown;
  routeName?: unknown;
  menuCode?: unknown;
  path?: unknown;
}

export interface AiAgentHandoffPayload extends AiAgentHandoffTarget {
  prompt: unknown;
  label?: unknown;
  context?: unknown;
  source?: unknown;
  ttlMs?: number;
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
    clientId?: string;
    subjectType?: string;
    subjectId?: string;
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
  openedAt?: number;
}

const HANDOFF_PREFIX = 'jetlinks:ai-agent-handoff:';
const DEFAULT_TTL_MS = 10 * 60 * 1000;
const MAX_CONTEXT_CHARS = 6000;

const normalizeText = (value: unknown) => String(value || '').trim();

const encodePart = (value: string) => encodeURIComponent(value);

const createHandoffId = () => {
  try {
    const id = globalThis.crypto?.randomUUID?.();
    if (id) return id;
  } catch {
    // Fall back below for older browsers or restricted contexts.
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeTarget = (target: AiAgentHandoffTarget) => ({
  clientId: normalizeText(target.clientId),
  subjectType: normalizeText(target.subjectType),
  subjectId: normalizeText(target.subjectId),
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
 * Subject identity is still the strongest match; route/menu/path are fallbacks for
 * pages that expose an agent without a concrete business object subject.
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
  const { clientId, subjectType, subjectId, routeName, menuCode, path } = normalized;
  const parts: string[] = [];

  if (clientId && subjectType && subjectId) {
    parts.push('client', clientId, 'subject', subjectType, subjectId);
  } else if (subjectType && subjectId) {
    parts.push('subject', subjectType, subjectId);
  } else if (clientId && routeName) {
    parts.push('client', clientId, 'route', routeName);
  } else if (routeName) {
    parts.push('route', routeName);
  } else if (clientId && menuCode) {
    parts.push('client', clientId, 'menu', menuCode);
  } else if (menuCode) {
    parts.push('menu', menuCode);
  } else if (clientId && path) {
    parts.push('client', clientId, 'path', path);
  } else if (path) {
    parts.push('path', path);
  }

  return parts.length ? `${HANDOFF_PREFIX}${parts.map(encodePart).join(':')}` : '';
};

const getStorage = () => {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
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

  const key = buildAiAgentHandoffKey(payload);
  const storage = getStorage();
  if (!key || !storage) return false;

  const now = Date.now();
  const ttlMs = Number.isFinite(payload.ttlMs) && Number(payload.ttlMs) > 0
    ? Number(payload.ttlMs)
    : DEFAULT_TTL_MS;
  const target = normalizeTarget(payload);

  try {
    cleanupAiAgentHandoffs();
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
      expiresAt: now + ttlMs,
    }));
    return true;
  } catch {
    return false;
  }
};

export const readAiAgentHandoff = (
  target: AiAgentHandoffTarget,
  options: { includeOpened?: boolean } = {},
) => {
  const key = buildAiAgentHandoffKey(target);
  const storage = getStorage();
  if (!key || !storage) return undefined;

  try {
    const record = JSON.parse(storage.getItem(key) || '{}') as AiAgentHandoffRecord;
    if (!record?.prompt || !Number.isFinite(record.expiresAt)) {
      return undefined;
    }
    if (record.expiresAt <= Date.now()) {
      storage.removeItem(key);
      return undefined;
    }
    if (record.openedAt && options.includeOpened === false) {
      return undefined;
    }
    return record;
  } catch {
    storage.removeItem(key);
    return undefined;
  }
};

export const hasPendingAiAgentHandoff = (target: AiAgentHandoffTarget) => (
  !!readAiAgentHandoff(target, { includeOpened: false })
);

export const markAiAgentHandoffOpened = (target: AiAgentHandoffTarget) => {
  const key = buildAiAgentHandoffKey(target);
  const storage = getStorage();
  if (!key || !storage) return false;

  const record = readAiAgentHandoff(target, { includeOpened: false });
  if (!record) return false;

  try {
    storage.setItem(key, JSON.stringify({
      ...record,
      openedAt: Date.now(),
    }));
    return true;
  } catch {
    return false;
  }
};

export const clearAiAgentHandoff = (target: AiAgentHandoffTarget) => {
  const key = buildAiAgentHandoffKey(target);
  const storage = getStorage();
  if (!key || !storage) return false;

  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
};
