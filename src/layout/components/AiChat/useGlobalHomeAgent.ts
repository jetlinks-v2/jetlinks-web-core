import { computed, onBeforeUnmount, watch } from 'vue';
import { useRouter, type RouteLocationNormalizedLoaded } from 'vue-router';
import { useAIStore } from '@jetlinks-web-core/store/ai';
import { useMenuStore } from '@jetlinks-web-core/store/menu';
import {
  getProjectIdFromLocation,
  isProjectRuntime,
  normalizeProjectRuntimePath,
} from '@jetlinks-web-core/utils/project-runtime';
import {
  createHomeAgentRuntime,
  HOME_AGENT_CAPABILITY_CHANGE_EVENT,
  HOME_AGENT_CLIENT_ID,
  type HomeAgentConversationMessageContext,
  type HomeAgentRuntime,
} from './homeAgentCapabilities';
import {
  createHomeAgentCapabilityLoaderTool,
  loadHomeAgentCapabilityProviders,
} from './routeCapabilityLoader';
import {
  createProjectBubbleParameters,
  createProjectGeneralAgentRuntime,
} from './projectGeneralAgentRuntime';
import { loadGeneralAgentExtensions } from './generalAgentExtensionLoader';
import {
  PROJECT_GENERAL_AGENT_CLIENT_ID,
  PROJECT_GENERAL_AGENT_SUBJECT_TYPE,
  type GeneralAgentRuntime,
} from './generalAgentRuntime';

const normalizeMessageText = (value: unknown) => String(value || '').trim();

const resolveRoutePageAgentClientId = (route: RouteLocationNormalizedLoaded) => {
  const meta = (route.meta || {}) as Record<string, any>;
  const config = meta.pageAgent || meta.aiAgent || {};
  return String(
    meta.pageAgentClientId
    || meta.aiAgentClientId
    || config.clientId
    || '',
  ).trim();
};

const resolveMessageContent = (message: Record<string, any>) => normalizeMessageText(
  message.content
  || message.text
  || message.payload?.content
  || message.payload?.text
  || message.payload?.message,
);

const useProjectGlobalAgent = (route: RouteLocationNormalizedLoaded) => {
  const router = useRouter();
  const aiStore = useAIStore();
  const menuStore = useMenuStore();
  const projectId = computed(() => normalizeMessageText(getProjectIdFromLocation()));
  let syncing = false;
  let syncTimer: number | undefined;
  let managedClientId = '';
  let preparedRouteClientId = '';
  let latestUserMessage: Record<string, any> | undefined;
  let activeRuntime: GeneralAgentRuntime | undefined;
  let unsubscribeRuntime: (() => void) | undefined;

  const isHubRoute = () => normalizeProjectRuntimePath(route.path) === '/ai-search-hub';

  const releasePreparedRouteAgent = () => {
    if (!preparedRouteClientId) return;
    aiStore.releaseAgentConversation(preparedRouteClientId);
    preparedRouteClientId = '';
  };

  const prepareRouteAgent = () => {
    const clientId = resolveRoutePageAgentClientId(route);
    if (!clientId || clientId === PROJECT_GENERAL_AGENT_CLIENT_ID) {
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
    aiStore.prepareAgentConversation(clientId);
    preparedRouteClientId = clientId;
    return true;
  };

  const recordConversationMessage = (message: Record<string, any>) => {
    if (message?.type !== 'user' && message?.type !== 'human') return;
    const content = resolveMessageContent(message);
    if (!content) return;
    latestUserMessage = {
      id: normalizeMessageText(message.id) || undefined,
      type: 'user',
      content,
      createdAt: Number(message.createdAt) || Date.now(),
    };
  };

  const createRuntimeParameters = (runtime: GeneralAgentRuntime) => ({
    ...createProjectBubbleParameters(runtime),
    clientTools: runtime.clientTools,
    clientToolsVersion: runtime.clientToolsVersion,
    projectId: projectId.value,
    scopeType: PROJECT_GENERAL_AGENT_SUBJECT_TYPE,
    scopeKey: projectId.value,
  });

  const applyRuntimeParameters = (runtime: GeneralAgentRuntime) => {
    if (runtime !== activeRuntime || aiStore.activeClientId !== PROJECT_GENERAL_AGENT_CLIENT_ID) return;
    aiStore.parameters = {
      ...aiStore.parameters,
      ...createRuntimeParameters(runtime),
    };
  };

  const buildRuntime = () => {
    const runtime = createProjectGeneralAgentRuntime({
      route,
      router,
      projectId: projectId.value,
      menus: menuStore.siderMenus as Record<string, any>[],
      getLatestUserMessage: () => latestUserMessage,
      onConversationMessage: recordConversationMessage,
      onCapabilitiesLoaded: refreshParameters,
    });
    unsubscribeRuntime?.();
    activeRuntime?.dispose();
    activeRuntime = runtime;
    unsubscribeRuntime = runtime.subscribeClientTools(() => applyRuntimeParameters(runtime));
    return runtime;
  };

  const releaseManagedAgent = () => {
    if (!managedClientId) return;
    aiStore.releaseAgentConversation(managedClientId);
    managedClientId = '';
  };

  const refreshParameters = () => {
    if (resolveRoutePageAgentClientId(route) || aiStore.activeClientId !== PROJECT_GENERAL_AGENT_CLIENT_ID) return;
    if (!aiStore.agentList.length || !projectId.value) return;
    const runtime = buildRuntime();
    applyRuntimeParameters(runtime);
  };

  const sync = async () => {
    if (!projectId.value || !menuStore.initialized || syncing) return;
    if (isHubRoute()) {
      releasePreparedRouteAgent();
      releaseManagedAgent();
      return;
    }

    // 页面专用助手由页面自身组装上下文；全局气泡只预留会话，避免覆盖专用参数。
    if (prepareRouteAgent()) {
      releaseManagedAgent();
      return;
    }

    if (aiStore.activeClientId === PROJECT_GENERAL_AGENT_CLIENT_ID && aiStore.agentList.length) {
      managedClientId = PROJECT_GENERAL_AGENT_CLIENT_ID;
      refreshParameters();
      return;
    }
    if (aiStore.pendingClientId && aiStore.pendingClientId !== PROJECT_GENERAL_AGENT_CLIENT_ID) return;
    if (aiStore.showAiButton && aiStore.activeClientId !== PROJECT_GENERAL_AGENT_CLIENT_ID) return;

    syncing = true;
    try {
      await loadGeneralAgentExtensions({ loadAll: true });
      const runtime = buildRuntime();
      await aiStore.queryAgent(PROJECT_GENERAL_AGENT_CLIENT_ID, createRuntimeParameters(runtime));
      managedClientId = aiStore.activeClientId === PROJECT_GENERAL_AGENT_CLIENT_ID
        ? PROJECT_GENERAL_AGENT_CLIENT_ID
        : '';
      if (managedClientId) applyRuntimeParameters(runtime);
    } finally {
      syncing = false;
    }
  };

  const scheduleSync = () => {
    if (syncTimer) window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => {
      syncTimer = undefined;
      void sync();
    }, 160);
  };

  watch(
    () => [route.fullPath, projectId.value, menuStore.initialized, menuStore.siderMenus.length],
    scheduleSync,
    { immediate: true, flush: 'post' },
  );

  window.addEventListener(HOME_AGENT_CAPABILITY_CHANGE_EVENT, scheduleSync);
  onBeforeUnmount(() => {
    if (syncTimer) window.clearTimeout(syncTimer);
    releasePreparedRouteAgent();
    releaseManagedAgent();
    unsubscribeRuntime?.();
    activeRuntime?.dispose();
    unsubscribeRuntime = undefined;
    activeRuntime = undefined;
    window.removeEventListener(HOME_AGENT_CAPABILITY_CHANGE_EVENT, scheduleSync);
  });
};

export const useGlobalHomeAgent = (route: RouteLocationNormalizedLoaded) => {
  if (isProjectRuntime()) {
    useProjectGlobalAgent(route);
    return;
  }

  const aiStore = useAIStore();
  const menuStore = useMenuStore();
  let syncing = false;
  let syncTimer: number | undefined;
  let preparedRouteClientId = '';
  let latestUserMessage: HomeAgentConversationMessageContext | undefined;
  let activeRuntime: HomeAgentRuntime | undefined;
  let unsubscribeRuntime: (() => void) | undefined;

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

  const applyRuntimeParameters = (runtime: HomeAgentRuntime) => {
    if (!isHomeAgentActive() || runtime !== activeRuntime) return;
    aiStore.parameters = {
      ...aiStore.parameters,
      ...runtime.parameters,
      clientTools: runtime.clientTools,
      clientToolsVersion: runtime.clientToolsVersion,
    };
  };

  const buildRuntime = () => {
    const runtime = createHomeAgentRuntime({
      currentView: () => String(route.name || route.path || ''),
      extraTools: () => [createHomeAgentCapabilityLoaderTool(refreshParameters)],
      getLatestUserMessage: () => latestUserMessage,
      onConversationMessage: recordConversationMessage,
    });
    unsubscribeRuntime?.();
    activeRuntime?.dispose();
    activeRuntime = runtime;
    unsubscribeRuntime = runtime.subscribeClientTools(() => applyRuntimeParameters(runtime));
    return runtime;
  };

  const isHomeAgentActive = () => aiStore.parameters?.subjectId === HOME_AGENT_CLIENT_ID;

  const hasOtherAgentActivity = () => (
    (!!aiStore.pendingClientId && aiStore.pendingClientId !== HOME_AGENT_CLIENT_ID)
    || (aiStore.showAiButton && !isHomeAgentActive())
  );

  const getRoutePageAgentClientId = () => {
    return resolveRoutePageAgentClientId(route);
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
    applyRuntimeParameters(runtime);
  };

  const sync = async () => {
    if (prepareRouteAgent()) return;
    if (syncing || hasOtherAgentActivity()) return;

    syncing = true;
    try {
      await loadHomeAgentCapabilityProviders({ loadAll: true });
      const runtime = buildRuntime();
      await aiStore.queryAgent(HOME_AGENT_CLIENT_ID, runtime.parameters);
      applyRuntimeParameters(runtime);
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
    unsubscribeRuntime?.();
    activeRuntime?.dispose();
    unsubscribeRuntime = undefined;
    activeRuntime = undefined;
    window.removeEventListener(HOME_AGENT_CAPABILITY_CHANGE_EVENT, handleCapabilityChange);
  });
};
