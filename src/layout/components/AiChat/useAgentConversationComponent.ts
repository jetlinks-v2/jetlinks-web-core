import { onMounted, onScopeDispose, ref, shallowRef, type Component } from 'vue';
import { useApplication } from '@jetlinks-web-core/store/application';
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry';
import type { AgentConversationComponentKind } from './agentConversationContracts';

export type { AgentConversationComponentKind } from './agentConversationContracts';

const getComponent = (kind: AgentConversationComponentKind): Component | undefined => {
  const candidates = Array.from(moduleRegistry.getAllModules().entries()).flatMap(([moduleId, module]) => (
    Object.entries(module.agentConversationProviders || {}).flatMap(([key, provider]) => {
      const component = provider?.components?.[kind];
      if (!component || !['object', 'function'].includes(typeof component)) return [];
      return [{ component, priority: provider.priority || 0, key: `${moduleId}:${key}` }];
    })
  ));
  candidates.sort((left, right) => right.priority - left.priority || left.key.localeCompare(right.key));
  return candidates[0]?.component;
};

/** Resolves the installed conversation UI without exposing provider identity to business modules. */
export function useAgentConversationComponent(
  kind: AgentConversationComponentKind = 'access',
  options: { autoLoad?: boolean } = {},
) {
  const conversationComponent = shallowRef(getComponent(kind));
  const conversationComponentLoading = ref(false);
  const conversationComponentError = shallowRef<unknown>();
  let disposed = false;
  let pendingLoad: Promise<Component | undefined> | undefined;

  const unsubscribe = moduleRegistry.onChange(() => {
    if (disposed) return;
    conversationComponent.value = getComponent(kind);
    if (conversationComponent.value) conversationComponentError.value = undefined;
  });
  onScopeDispose(() => {
    disposed = true;
    unsubscribe();
  });

  const loadAgentConversationComponent = (): Promise<Component | undefined> => {
    if (disposed) return Promise.resolve(undefined);
    if (pendingLoad) return pendingLoad;
    const installed = getComponent(kind);
    if (installed) {
      conversationComponent.value = installed;
      conversationComponentError.value = undefined;
      return Promise.resolve(installed);
    }
    conversationComponentLoading.value = true;
    conversationComponentError.value = undefined;
    // The application store owns shared loading and reset boundaries across all callers.
    pendingLoad = Promise.resolve().then(() => useApplication().queryApplication())
      .catch((error: unknown) => {
        if (!disposed) conversationComponentError.value = error;
      })
      .then(() => {
        // Unrelated module failures must not erase an available provider; reconcile both outcomes.
        const component = getComponent(kind);
        if (!disposed) {
          conversationComponent.value = component;
          if (component) conversationComponentError.value = undefined;
        }
        return component;
      })
      .finally(() => {
        pendingLoad = undefined;
        if (!disposed) conversationComponentLoading.value = false;
      });
    return pendingLoad;
  };

  onMounted(() => {
    if (options.autoLoad !== false) void loadAgentConversationComponent();
  });
  return {
    conversationComponent,
    conversationComponentLoading,
    conversationComponentError,
    loadAgentConversationComponent,
  };
}
