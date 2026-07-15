import { onBeforeUnmount, watch } from 'vue';
import type { RouteLocationNormalizedLoaded } from 'vue-router';
import { useAIStore } from '@jetlinks-web-core/store/ai';
import { useMenuStore } from '@jetlinks-web-core/store/menu';
import {
  createHomeAgentRuntime,
  HOME_AGENT_CAPABILITY_CHANGE_EVENT,
  HOME_AGENT_CLIENT_ID,
  type HomeAgentConversationMessageContext,
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
  let preparedRouteClientId = '';
  let latestUserMessage: HomeAgentConversationMessageContext | undefined;

  const normalizeMessageText = (value: unknown) => String(value || '').trim();

  const resolveMessageContent = (message: Record<string, any>) => normalizeMessageText(
    message.content
    || message.text
    || message.payload?.content
    || message.payload?.text
    || message.payload?.message,
  );

  const recordConversationMessage = (message: HomeAgentConversationMessageContext & Record<string, any>) => {
    const localUserMessage = message?.type === 'user'
      && (
        message?.headers?.origin === 'client'
        || normalizeMessageText(message.id).startsWith('local-user:')
      );
    if (!localUserMessage) {
      return;
    }
    const content = resolveMessageContent(message);
    if (!content) {
      return;
    }
    latestUserMessage = {
      id: normalizeMessageText(message.id) || undefined,
      type: 'user',
      content,
      createdAt: Number(message.createdAt) || Date.now(),
    };
  };

  const buildRuntime = () => createHomeAgentRuntime({
    currentView: () => String(route.name || route.path || ''),
    extraTools: () => [createHomeAgentCapabilityLoaderTool(refreshParameters)],
    getLatestUserMessage: () => latestUserMessage,
    onConversationMessage: recordConversationMessage,
  });

  const isHomeAgentActive = () => aiStore.parameters?.subjectId === HOME_AGENT_CLIENT_ID;

  const hasOtherAgentActivity = () => (
    (!!aiStore.pendingClientId && aiStore.pendingClientId !== HOME_AGENT_CLIENT_ID)
    || (aiStore.showAiButton && !isHomeAgentActive())
  );

  const getRoutePageAgentClientId = () => {
    const meta = (route.meta || {}) as Record<string, any>;
    const config = meta.pageAgent || meta.aiAgent || {};
    return String(
      meta.pageAgentClientId
      || meta.aiAgentClientId
      || config.clientId
      || '',
    ).trim();
  };

  const releasePreparedRouteAgent = () => {
    if (!preparedRouteClientId) return;
    aiStore.releaseAgentConversation(preparedRouteClientId);
    preparedRouteClientId = '';
  };

  const prepareRouteAgent = () => {
    const clientId = getRoutePageAgentClientId();
    if (!clientId || clientId === HOME_AGENT_CLIENT_ID) {
      releasePreparedRouteAgent();
      return false;
    }
    if (preparedRouteClientId && preparedRouteClientId !== clientId) {
      releasePreparedRouteAgent();
    }
    if (aiStore.pendingClientId === clientId || aiStore.activeClientId === clientId) {
      preparedRouteClientId = clientId;
      return true;
    }
    if (preparedRouteClientId !== clientId) {
      aiStore.prepareAgentConversation(clientId);
      preparedRouteClientId = clientId;
    }
    return true;
  };

  const refreshParameters = () => {
    if (!aiStore.agentList.length || !isHomeAgentActive()) return;

    const runtime = buildRuntime();
    aiStore.parameters = {
      ...aiStore.parameters,
      ...runtime.parameters,
    };
  };

  const sync = async () => {
    if (prepareRouteAgent()) return;
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
    releasePreparedRouteAgent();
    window.removeEventListener(HOME_AGENT_CAPABILITY_CHANGE_EVENT, handleCapabilityChange);
  });
};
