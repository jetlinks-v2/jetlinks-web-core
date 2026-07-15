export interface AgentConversationSubject {
  type: string;
  id: string;
  subjectType: string;
  subjectId: string;
  name?: string;
  subjectName?: string;
}

export const normalizeAgentSubject = (source: Record<string, any> = {}) => {
  const subject = source?.subject || {};
  const scope = Array.isArray(source?.scope) ? source.scope[0] : source?.scope || {};
  const type = String(source?.subjectType || subject?.type || scope?.type || '').trim();
  const id = String(source?.subjectId || subject?.id || scope?.id || '').trim();
  const name = String(source?.subjectName || subject?.name || scope?.name || '').trim();

  if (!type || !id) {
    return undefined;
  }

  return {
    type,
    id,
    subjectType: type,
    subjectId: id,
    ...(name ? { name, subjectName: name } : {}),
  };
};

export const buildAgentSubjectPayload = (subject?: AgentConversationSubject) => {
  if (!subject) {
    return {};
  }

  const normalizedSubject = {
    type: subject.type,
    id: subject.id,
    ...(subject.name ? { name: subject.name } : {}),
  };

  return {
    subjectType: subject.type,
    subjectId: subject.id,
    ...(subject.name ? { subjectName: subject.name } : {}),
    subject: normalizedSubject,
    scope: [normalizedSubject],
  };
};
