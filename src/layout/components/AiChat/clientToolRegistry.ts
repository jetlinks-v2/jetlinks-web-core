import type { AiClientToolDefinition } from './clientTools';

export interface AiClientToolRegistryRecord<TContext = Record<string, any>> {
  scope: string;
  tool: AiClientToolDefinition<TContext>;
  order?: number;
}

const normalizeScopes = (scope?: string | string[]) => {
  if (Array.isArray(scope)) {
    return scope.map((item) => String(item || '').trim()).filter(Boolean);
  }
  const value = String(scope || '').trim();
  return value ? [value] : [];
};

class AiClientToolRegistry {
  private registryMap = new Map<string, AiClientToolRegistryRecord<any>[]>();

  register<TContext = Record<string, any>>(
    scope: string,
    tools: AiClientToolDefinition<TContext> | AiClientToolDefinition<TContext>[],
    order = 0,
  ) {
    const normalizedScope = String(scope || '').trim();
    if (!normalizedScope) {
      return;
    }

    const nextTools: AiClientToolRegistryRecord<any>[] = (Array.isArray(tools) ? tools : [tools])
      .filter((tool) => !!tool?.id)
      .map((tool) => ({ scope: normalizedScope, tool, order }));
    if (!nextTools.length) {
      return;
    }

    const current = this.registryMap.get(normalizedScope) || [];
    nextTools.forEach((record) => {
      const index = current.findIndex((item) => item.tool.id === record.tool.id);
      if (index >= 0) {
        current[index] = record;
      } else {
        current.push(record);
      }
    });
    this.registryMap.set(normalizedScope, current);
  }

  getTools<TContext = Record<string, any>>(scope?: string | string[]) {
    const scopes = normalizeScopes(scope);
    const records = scopes.length
      ? scopes.flatMap((item) => this.registryMap.get(item) || [])
      : Array.from(this.registryMap.values()).flat();

    return records
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((record) => record.tool as AiClientToolDefinition<TContext>);
  }
}

export const aiClientToolRegistry = new AiClientToolRegistry();
