import type { HomeAgentConversationMessageContext } from './homeAgentContracts';

const record = (value: unknown): Record<string, unknown> | undefined => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
);

/** Keep UI-selected turn parameters when the server replaces an optimistic user message. */
export const resolveHomeAgentConversationContext = (
  message: Record<string, any>,
  content: string,
  previous?: HomeAgentConversationMessageContext,
): HomeAgentConversationMessageContext => {
  const id = String(message.id || '').trim();
  const local = id.startsWith('local-user:') || message.headers?.origin === 'client';
  const params = record(message.payload?.params);
  // Only the matching optimistic echo may inherit parameters. A new local send always starts a new intent.
  const echoedParams = !local && previous?.content === content
    && (previous.id?.startsWith('local-user:') || (!!id && previous.id === id))
    ? previous.params : undefined;
  return {
    id: id || undefined,
    type: 'user',
    content,
    createdAt: Number(message.createdAt) || Date.now(),
    ...((params || echoedParams) ? { params: { ...(params || echoedParams) } } : {}),
  };
};
