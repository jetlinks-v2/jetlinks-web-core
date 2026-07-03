import { onBeforeUnmount, watch } from 'vue';
import type { RouteLocationNormalizedLoaded } from 'vue-router';
import { useAIStore } from '@jetlinks-web-core/store/ai';
import { useMenuStore } from '@jetlinks-web-core/store/menu';
import {
  createHomeAgentRuntime,
  HOME_AGENT_CAPABILITY_CHANGE_EVENT,
  HOME_AGENT_CLIENT_ID,
} from './homeAgentCapabilities';
import {
  createHomeAgentCapabilityLoaderTool,
  loadHomeAgentCapabilityProviders,
} from './routeCapabilityLoader';

export const useGlobalHomeAgent = (route: RouteLocationNormalizedLoaded) => {
  const aiStore = useAIStore();
  const menuStore = useMenuStore();
  let syncing = false;
  let syncTimer: number | undefined;

  const buildRuntime = () => createHomeAgentRuntime({
    currentView: () => String(route.name || route.path || ''),
    extraTools: () => [createHomeAgentCapabilityLoaderTool(refreshParameters)],
  });

  const isHomeAgentActive = () => aiStore.parameters?.subjectId === HOME_AGENT_CLIENT_ID;

  const hasOtherAgentActivity = () => (
    (!!aiStore.pendingClientId && aiStore.pendingClientId !== HOME_AGENT_CLIENT_ID)
    || (aiStore.showAiButton && !isHomeAgentActive())
  );

  const refreshParameters = () => {
    if (!aiStore.agentList.length || !isHomeAgentActive()) return;

    const runtime = buildRuntime();
    aiStore.parameters = {
      ...aiStore.parameters,
      ...runtime.parameters,
    };
  };

  const sync = async () => {
    if (syncing || hasOtherAgentActivity()) return;

    syncing = true;
    try {
      await loadHomeAgentCapabilityProviders({ loadAll: true });
      const runtime = buildRuntime();
      await aiStore.queryAgent(HOME_AGENT_CLIENT_ID, runtime.parameters);
      refreshParameters();
    } finally {
      syncing = false;
    }
  };

  const scheduleSync = () => {
    if (syncTimer) {
      window.clearTimeout(syncTimer);
    }
    syncTimer = window.setTimeout(() => {
      syncTimer = undefined;
      void sync();
    }, 160);
  };

  const handleCapabilityChange = () => {
    scheduleSync();
  };

  watch(
    () => [
      route.fullPath,
      menuStore.initialized,
      menuStore.siderMenus.length,
    ],
    scheduleSync,
    { immediate: true, flush: 'post' },
  );

  window.addEventListener(HOME_AGENT_CAPABILITY_CHANGE_EVENT, handleCapabilityChange);

  onBeforeUnmount(() => {
    if (syncTimer) {
      window.clearTimeout(syncTimer);
    }
    window.removeEventListener(HOME_AGENT_CAPABILITY_CHANGE_EVENT, handleCapabilityChange);
  });
};
