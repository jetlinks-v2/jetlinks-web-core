import { onBeforeUnmount, watch, type Ref } from 'vue';
import {
  generalAgentExtensionRegistry,
  type GeneralAgentConversationBridge,
  type GeneralAgentConversationChatPayload,
  type GeneralAgentConversationMessage,
  type GeneralAgentExtension,
} from './generalAgentExtensions';

interface GeneralAgentConversationBridgesOptions {
  restoredMessages: Ref<GeneralAgentConversationMessage[]>;
  t: (key: string, args?: unknown[] | Record<string, unknown>) => string;
  upsertLocalMessage: (message: GeneralAgentConversationMessage) => void;
  scopes?: string | string[];
}

/**
 * Hosts capability-owned conversation bridges for every general-agent surface.
 *
 * Floating assistants and full workspaces must share this lifecycle; otherwise a renderer can be visible while its
 * local send interception is absent, causing card actions such as numeric selection to leak back to the model.
 */
export function useGeneralAgentConversationBridges(
  options: GeneralAgentConversationBridgesOptions,
) {
  const bridges = new Map<string, {
    bridge: GeneralAgentConversationBridge;
    extension: GeneralAgentExtension;
  }>();
  const scopes = options.scopes || 'general';

  const syncBridges = () => {
    const extensions = generalAgentExtensionRegistry.getConversationExtensions(scopes);
    const activeIds = new Set(extensions.map(extension => extension.id));

    bridges.forEach((entry, id) => {
      if (activeIds.has(id)) return;
      entry.bridge.dispose?.();
      bridges.delete(id);
    });

    extensions.forEach((extension) => {
      const current = bridges.get(extension.id);
      if (current?.extension === extension || !extension.conversation?.createBridge) return;
      current?.bridge.dispose?.();
      const bridge = extension.conversation.createBridge({
        t: options.t,
        upsertLocalMessage: options.upsertLocalMessage,
      });
      bridges.set(extension.id, { bridge, extension });
      bridge.onRestoredMessages?.(options.restoredMessages.value);
    });

    return extensions
      .map(extension => bridges.get(extension.id)?.bridge)
      .filter((bridge): bridge is GeneralAgentConversationBridge => !!bridge);
  };

  const beforeSend = (payload: GeneralAgentConversationChatPayload) => {
    for (const bridge of syncBridges()) {
      if (bridge.beforeSend?.(payload) === false) return false;
    }
    return undefined;
  };

  const onMessage = (message: GeneralAgentConversationMessage) => {
    syncBridges().forEach(bridge => bridge.onMessage?.(message));
  };

  const onSocketPayload = (payload: Record<string, unknown>) => {
    syncBridges().forEach(bridge => bridge.onSocketPayload?.(payload));
  };

  watch(
    generalAgentExtensionRegistry.version,
    () => syncBridges(),
    { immediate: true },
  );
  watch(
    () => options.restoredMessages.value,
    messages => syncBridges().forEach(bridge => bridge.onRestoredMessages?.(messages)),
    { immediate: true },
  );

  onBeforeUnmount(() => {
    bridges.forEach(entry => entry.bridge.dispose?.());
    bridges.clear();
  });

  return {
    beforeSend,
    onMessage,
    onSocketPayload,
  };
}
