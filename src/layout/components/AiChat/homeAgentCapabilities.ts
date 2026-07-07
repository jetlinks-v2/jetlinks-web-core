import type { RouteLocationNormalizedLoaded, RouteRecordRaw } from 'vue-router';
import i18n from '@jetlinks-web-core/locales';
import router from '@jetlinks-web-core/router';
import { useMenuStore } from '@jetlinks-web-core/store/menu';
import {
  createAiClientToolRuntime,
  defineAiClientTools,
  type AiClientToolDefinition,
  type AiClientToolRuntime,
} from './clientTools';

export const HOME_AGENT_CLIENT_ID = 'iotHome';
export const HOME_AGENT_SUBJECT_TYPE = 'runtimeHome';
export const HOME_AGENT_TOOL_SCOPE = 'homeAgent';
export const HOME_AGENT_CAPABILITY_CHANGE_EVENT = 'jetlinks-home-agent-capability-change';

type MaybeArray<T> = T | T[] | undefined | null;

export type HomeAgentCapabilityKind = 'menu' | 'feature' | 'agent' | 'tool' | 'guide';

export interface HomeAgentMenuEntry {
  code: string;
  name: string;
  title: string;
  path?: string;
  routeName?: string;
  breadcrumb: string[];
  keywords: string[];
}

export interface HomeAgentCapability {
  id: string;
  name: string;
  description?: string;
  kind?: HomeAgentCapabilityKind;
  category?: string;
  keywords?: string[];
  order?: number;
  menuCode?: string;
  routeName?: string;
  path?: string;
  clientId?: string;
  clientType?: string;
  metadata?: Record<string, any> & {
    currentRoute?: boolean;
    promptExamples?: string[];
  };
}

export interface HomeAgentRuntimeOptions {
  currentView?: string | (() => string | undefined);
  extraCapabilities?: MaybeArray<HomeAgentCapability> | (() => MaybeArray<HomeAgentCapability>);
  extraTools?: MaybeArray<AiClientToolDefinition<HomeAgentCapabilityContext>>
    | (() => MaybeArray<AiClientToolDefinition<HomeAgentCapabilityContext>>);
  registeredToolScopes?: string | string[];
  toolsName?: string;
  toolsDescription?: string;
  openingStatement?: string;
  promptExamples?: string[];
  systemPromptLines?: string[];
  getLatestUserMessage?: () => HomeAgentConversationMessageContext | undefined;
  onConversationMessage?: (message: HomeAgentConversationMessageContext & Record<string, any>) => void;
}

/**
 * Frontend workflow guide passed through to AgentConversation.
 *
 * Keep provider guides focused on capability routing and evidence-gathering
 * steps. Global answer policy, tone, safety, and provider-specific prompt
 * fixes should stay out of page-level guide declarations.
 */
export interface HomeAgentWorkflowGuide {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  when?: string | string[];
  scenarios?: string[];
  keywords?: string[];
  steps?: Array<string | {
    title?: string;
    description?: string;
    tools?: string[];
    inputs?: Record<string, any>;
    tips?: string[];
    required?: boolean;
    [key: string]: any;
  }>;
  output?: string | string[];
  notes?: string | string[];
  priority?: number;
  [key: string]: any;
}

export interface HomeAgentCapabilityContext {
  currentRoute: {
    name?: string;
    path?: string;
    fullPath?: string;
    title?: string;
  };
  currentView?: string;
  latestUserMessage?: HomeAgentConversationMessageContext;
  menus: HomeAgentMenuEntry[];
  capabilities: HomeAgentCapability[];
  findMenu: (value: string) => HomeAgentMenuEntry | undefined;
  navigateToMenu: (
    value: string,
    options?: { query?: Record<string, any>; params?: Record<string, any> },
  ) => boolean;
  navigateToRoute: (
    routeName: string,
    options?: { query?: Record<string, any>; params?: Record<string, any> },
  ) => boolean;
}

export interface HomeAgentConversationMessageContext {
  id?: string;
  type?: string;
  content?: string;
  createdAt?: number;
}

interface HomeAgentRouteLink {
  routeName: string;
  menuCode?: string;
  path?: string;
  params?: Record<string, any>;
  query?: Record<string, any>;
}

export interface HomeAgentCapabilityProvider {
  id: string;
  order?: number;
  getCapabilities?: (context: HomeAgentCapabilityContext) => MaybeArray<HomeAgentCapability>;
  getClientTools?: (
    context: HomeAgentCapabilityContext,
  ) => MaybeArray<AiClientToolDefinition<HomeAgentCapabilityContext>>;
  getWorkflowGuides?: (context: HomeAgentCapabilityContext) => MaybeArray<HomeAgentWorkflowGuide>;
  getPromptExamples?: (context: HomeAgentCapabilityContext) => MaybeArray<string>;
  getSystemPromptLines?: (context: HomeAgentCapabilityContext) => MaybeArray<string>;
}

export interface HomeAgentRuntime extends AiClientToolRuntime {
  parameters: Record<string, any>;
  getContext: () => HomeAgentCapabilityContext;
}

const DEFAULT_LIMIT = 20;
const PROMPT_EXAMPLE_LIMIT = 3;

const toArray = <T>(value: MaybeArray<T>): T[] => {
  if (value === undefined || value === null) {
    return [];
  }
  return (Array.isArray(value) ? value : [value]).filter((item): item is T => !!item);
};

const resolveMaybeArray = <T>(
  value: MaybeArray<T> | (() => MaybeArray<T>) | undefined,
) => (typeof value === 'function' ? toArray((value as () => MaybeArray<T>)()) : toArray(value));

const normalizeText = (value: unknown) => String(value || '').trim();

const normalizeKeyword = (value: unknown) => normalizeText(value).toLowerCase();

const uniqueStrings = (items: unknown[]) => {
  const seen = new Set<string>();
  const result: string[] = [];
  items.forEach((item) => {
    const text = normalizeText(item);
    if (!text || seen.has(text)) return;
    seen.add(text);
    result.push(text);
  });
  return result;
};

const clampLimit = (value: unknown, defaultValue = DEFAULT_LIMIT) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return defaultValue;
  }
  return Math.min(100, Math.max(1, Math.floor(numberValue)));
};

const isPlainRecord = (value: unknown): value is Record<string, any> => (
  !!value && typeof value === 'object' && !Array.isArray(value)
);

const parseObjectParam = (value: string | null) => {
  const text = normalizeText(value);
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return isPlainRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const normalizeSameOriginHashLink = (href: string) => {
  const raw = normalizeText(href);
  if (!raw || raw.startsWith('#')) {
    return raw;
  }

  if (typeof window === 'undefined') {
    return raw;
  }

  try {
    const url = new URL(raw, window.location.href);
    return url.origin === window.location.origin && url.hash ? url.hash : raw;
  } catch {
    return raw;
  }
};

const isHashRoutePathLink = (href: string) => /^#!?\//.test(normalizeText(href));

const resolveHashRoutePath = (href: string) => {
  const raw = normalizeText(href);
  if (!isHashRoutePathLink(raw)) return '';
  return raw.replace(/^#!/, '#').slice(1);
};

const normalizeRouteTitle = (route?: RouteLocationNormalizedLoaded | RouteRecordRaw | Record<string, any>) => {
  const meta = (route?.meta || {}) as Record<string, any>;
  return normalizeText(meta.title || route?.name || route?.path);
};

const resolveMenuTitle = (menu: Record<string, any>) => (
  normalizeText(menu?.meta?.title || menu?.title || menu?.name || menu?.code || menu?.path)
);

const resolveMenuCode = (menu: Record<string, any>) => (
  normalizeText(menu?.code || menu?.name || menu?.routeName || menu?.path)
);

const resolveMenuRouteName = (menu: Record<string, any>) => (
  normalizeText(menu?.routeName || menu?.name || menu?.code)
);

const flattenVisibleMenus = (
  source: Record<string, any>[],
  parents: HomeAgentMenuEntry[] = [],
) => {
  const result: HomeAgentMenuEntry[] = [];

  source.forEach((menu) => {
    const code = resolveMenuCode(menu);
    const title = resolveMenuTitle(menu);
    const routeName = resolveMenuRouteName(menu);
    const entry: HomeAgentMenuEntry | undefined = code && title
      ? {
        code,
        name: code,
        title,
        routeName,
        path: normalizeText(menu?.path) || undefined,
        breadcrumb: [...parents.map((item) => item.title), title],
        keywords: uniqueStrings([
          code,
          title,
          routeName,
          menu?.path,
          menu?.meta?.title,
          ...(parents || []).flatMap((item) => [item.code, item.title]),
        ]),
      }
      : undefined;

    if (entry) {
      result.push(entry);
    }

    const children = Array.isArray(menu?.children) ? menu.children : [];
    if (children.length) {
      result.push(...flattenVisibleMenus(children, entry ? [...parents, entry] : parents));
    }
  });

  return result;
};

const collectVisibleMenus = () => {
  const menuStore = useMenuStore();
  const menus = Array.isArray(menuStore.siderMenus) ? menuStore.siderMenus as any[] : [];
  return flattenVisibleMenus(menus);
};

const menuToCapability = (menu: HomeAgentMenuEntry): HomeAgentCapability => ({
  id: `menu:${menu.code}`,
  name: menu.title,
  description: menu.breadcrumb.join(' / '),
  kind: 'menu',
  category: 'menu',
  keywords: menu.keywords,
  menuCode: menu.code,
  routeName: menu.routeName,
  path: menu.path,
});

const normalizeCapability = (item: HomeAgentCapability): HomeAgentCapability | undefined => {
  const id = normalizeText(item?.id);
  const name = normalizeText(item?.name);
  if (!id || !name) {
    return undefined;
  }

  return {
    ...item,
    id,
    name,
    kind: item.kind || 'feature',
    keywords: uniqueStrings([
      ...(item.keywords || []),
      item.id,
      item.name,
      item.description,
      item.category,
      item.menuCode,
      item.routeName,
      item.path,
      item.clientId,
      item.clientType,
    ]),
  };
};

const mergeCapabilities = (items: HomeAgentCapability[]) => {
  const result: HomeAgentCapability[] = [];
  const indexMap = new Map<string, number>();

  items.forEach((item) => {
    const capability = normalizeCapability(item);
    if (!capability) return;
    const index = indexMap.get(capability.id);
    if (index === undefined) {
      indexMap.set(capability.id, result.length);
      result.push(capability);
    } else {
      result[index] = {
        ...result[index],
        ...capability,
      };
    }
  });

  return result.sort((a, b) => (a.order || 0) - (b.order || 0));
};

const getCapabilityMenuAnchors = (capability: HomeAgentCapability) => uniqueStrings([
  capability.menuCode,
  capability.routeName,
  capability.path,
  capability.metadata?.menuCode,
  capability.metadata?.routeName,
  capability.metadata?.path,
]);

const filterUnauthorizedCapabilities = (
  capabilities: HomeAgentCapability[],
  context: HomeAgentCapabilityContext,
) => capabilities.filter((capability) => {
  if (capability.kind === 'menu') {
    return true;
  }

  const anchors = getCapabilityMenuAnchors(capability);
  if (!anchors.length) {
    return true;
  }

  // Business providers bind capabilities to visible menus so the home agent cannot expose
  // tools for pages that the current account cannot open.
  return anchors.some((anchor) => !!context.findMenu(anchor));
});

const getProviders = () => homeAgentCapabilityRegistry.getProviders();

const buildCurrentRouteSummary = () => {
  const current = router.currentRoute.value;
  return {
    name: normalizeText(current.name),
    path: current.path,
    fullPath: current.fullPath,
    title: normalizeRouteTitle(current),
  };
};

const resolveCurrentView = (options?: HomeAgentRuntimeOptions) => (
  typeof options?.currentView === 'function'
    ? normalizeText(options.currentView())
    : normalizeText(options?.currentView)
);

const findMenuFromStore = (value: string) => {
  const menuStore = useMenuStore();
  const text = normalizeText(value);
  if (!text) return undefined;
  return menuStore.getMenu(text) || undefined;
};

const createFindMenu = (menus: HomeAgentMenuEntry[]) => (value: string) => {
  const text = normalizeText(value);
  if (!text) return undefined;
  const normalized = normalizeKeyword(text);
  return menus.find((menu) => (
    normalizeKeyword(menu.code) === normalized
    || normalizeKeyword(menu.routeName) === normalized
    || normalizeKeyword(menu.path) === normalized
    || normalizeKeyword(menu.title) === normalized
  ));
};

const normalizeNavigationOptions = (options?: { query?: Record<string, any>; params?: Record<string, any> }) => ({
  query: isPlainRecord(options?.query) ? options?.query : {},
  params: isPlainRecord(options?.params) ? options?.params : {},
});

const createMenuNavigator = (
  menus: HomeAgentMenuEntry[],
  findMenu: (value: string) => HomeAgentMenuEntry | undefined,
) => (
  value: string,
  options?: { query?: Record<string, any>; params?: Record<string, any> },
) => {
  const menuStore = useMenuStore();
  const text = normalizeText(value);
  if (!text) return false;

  const storeMenu = findMenuFromStore(text);
  const menu = findMenu(text);
  const routeName = normalizeText(storeMenu?.routeName || menu?.routeName || storeMenu?.name);
  const navOptions = normalizeNavigationOptions(options);

  if (storeMenu) {
    menuStore.routerPush(routeName || text, navOptions);
    return true;
  }

  if (routeName) {
    menuStore.routerPush(routeName, navOptions);
    return true;
  }

  const target = menu || menus.find((item) => normalizeText(item.path) === text);
  if (target?.path) {
    void router.push({ path: target.path, query: navOptions.query });
    return true;
  }

  return false;
};

const createRouteNavigator = () => (
  routeName: string,
  options?: { query?: Record<string, any>; params?: Record<string, any> },
) => {
  const name = normalizeText(routeName);
  if (!name || !router.hasRoute(name)) {
    return false;
  }
  useMenuStore().routerPush(name, normalizeNavigationOptions(options));
  return true;
};

const createBaseContext = (options?: HomeAgentRuntimeOptions): HomeAgentCapabilityContext => {
  const menus = collectVisibleMenus();
  const findMenu = createFindMenu(menus);
  const latestUserMessage = options?.getLatestUserMessage?.();
  const context: HomeAgentCapabilityContext = {
    currentRoute: buildCurrentRouteSummary(),
    currentView: resolveCurrentView(options) || undefined,
    ...(latestUserMessage?.content ? { latestUserMessage } : {}),
    menus,
    capabilities: [],
    findMenu,
    navigateToMenu: createMenuNavigator(menus, findMenu),
    navigateToRoute: createRouteNavigator(),
  };

  const providerCapabilities = getProviders()
    .flatMap((provider) => toArray(provider.getCapabilities?.(context)));
  context.capabilities = filterUnauthorizedCapabilities(mergeCapabilities([
    ...menus.map(menuToCapability),
    ...resolveMaybeArray(options?.extraCapabilities),
    ...providerCapabilities,
  ]), context);

  return context;
};

const findPathPermissionAnchor = (
  path: string,
  context: HomeAgentCapabilityContext,
) => {
  const routePath = normalizeText(path).split('?')[0];
  if (!routePath) return undefined;

  return context.menus.find((menu) => {
    const menuPath = normalizeText(menu.path);
    return menuPath && (routePath === menuPath || routePath.startsWith(`${menuPath}/`));
  });
};

const findRoutePermissionAnchor = (
  routeLink: HomeAgentRouteLink,
  context: HomeAgentCapabilityContext,
) => {
  if (routeLink.menuCode) {
    return context.findMenu(routeLink.menuCode);
  }
  if (routeLink.routeName) {
    return context.findMenu(routeLink.routeName);
  }
  if (routeLink.path) {
    return findPathPermissionAnchor(routeLink.path, context);
  }
  return undefined;
};

const includesKeyword = (values: unknown[], keyword: string) => {
  if (!keyword) return true;
  return values.some((value) => normalizeKeyword(value).includes(keyword));
};

const filterCapabilities = (
  capabilities: HomeAgentCapability[],
  args: Record<string, any>,
) => {
  const keyword = normalizeKeyword(args.keyword);
  const kind = normalizeKeyword(args.kind);
  const category = normalizeKeyword(args.category);

  return capabilities.filter((item) => {
    if (kind && normalizeKeyword(item.kind) !== kind) {
      return false;
    }
    if (category && normalizeKeyword(item.category) !== category) {
      return false;
    }
    return includesKeyword([
      item.id,
      item.name,
      item.description,
      item.category,
      item.kind,
      item.menuCode,
      item.routeName,
      item.path,
      item.clientId,
      item.clientType,
      ...(item.keywords || []),
    ], keyword);
  });
};

const compactCapability = (item: HomeAgentCapability) => ({
  id: item.id,
  kind: item.kind,
  name: item.name,
  description: item.description,
  category: item.category,
  menuCode: item.menuCode,
  routeName: item.routeName,
  path: item.path,
  link: item.kind === 'menu' && (item.menuCode || item.routeName)
    ? `#menu=${encodeURIComponent(String(item.menuCode || item.routeName))}`
    : undefined,
  markdownLink: item.kind === 'menu' && (item.menuCode || item.routeName)
    ? `[${item.name}](#menu=${encodeURIComponent(String(item.menuCode || item.routeName))})`
    : undefined,
  clientId: item.clientId,
  clientType: item.clientType,
});

const isCurrentMenu = (menu: HomeAgentMenuEntry, context: HomeAgentCapabilityContext) => {
  const route = context.currentRoute;
  const routeName = normalizeKeyword(route.name);
  const routePath = normalizeKeyword(route.path);
  return (
    (!!routeName && (
      normalizeKeyword(menu.routeName) === routeName
      || normalizeKeyword(menu.code) === routeName
    ))
    || (!!routePath && normalizeKeyword(menu.path) === routePath)
  );
};

const isLikelyContainerMenu = (menu: HomeAgentMenuEntry) => (
  !menu.path && menu.breadcrumb.length <= 1
);

const getCurrentMenu = (context: HomeAgentCapabilityContext) => (
  context.menus.find((menu) => isCurrentMenu(menu, context))
);

const isHomeRoute = (context: HomeAgentCapabilityContext) => {
  const currentMenu = getCurrentMenu(context);
  const path = normalizeKeyword(context.currentRoute.path);
  const name = normalizeKeyword(context.currentRoute.name);
  return (
    currentMenu?.code === 'home'
    || currentMenu?.path === '/iot/home'
    || path === '/iot/home'
    || name === 'home'
  );
};

const scorePromptMenu = (
  menu: HomeAgentMenuEntry,
  currentMenu?: HomeAgentMenuEntry,
) => {
  let score = 0;
  const title = normalizeKeyword(menu.title);
  if (currentMenu?.breadcrumb?.[0] && menu.breadcrumb[0] === currentMenu.breadcrumb[0]) {
    score += 30;
  }
  if (currentMenu?.breadcrumb?.[1] && menu.breadcrumb[1] === currentMenu.breadcrumb[1]) {
    score += 10;
  }
  if (menu.path) {
    score += 10;
  }
  if (menu.breadcrumb.length > 1) {
    score += 8;
  }
  if (/首页|仪表盘|dashboard|home/i.test(title)) {
    score -= 20;
  }
  return score;
};

const selectPromptMenu = (context: HomeAgentCapabilityContext) => {
  const currentMenu = getCurrentMenu(context);
  const candidates = context.menus.filter((menu) => (
    !isCurrentMenu(menu, context)
    && !isLikelyContainerMenu(menu)
  ));
  if (!candidates.length) return undefined;

  return candidates
    .slice()
    .sort((a, b) => scorePromptMenu(b, currentMenu) - scorePromptMenu(a, currentMenu))[0];
};

const isCapabilityForCurrentRoute = (
  capability: HomeAgentCapability,
  context: HomeAgentCapabilityContext,
) => {
  if (capability.kind === 'menu') {
    return false;
  }
  if (capability.metadata?.currentRoute) {
    return true;
  }
  const currentMenu = getCurrentMenu(context);
  const routeName = normalizeKeyword(context.currentRoute.name);
  const routePath = normalizeKeyword(context.currentRoute.path);
  return (
    (!!capability.menuCode && currentMenu?.code === capability.menuCode)
    || (!!capability.routeName && (
      normalizeKeyword(capability.routeName) === routeName
      || currentMenu?.routeName === capability.routeName
    ))
    || (!!capability.path && normalizeKeyword(capability.path) === routePath)
  );
};

const buildCapabilityExample = (capability: HomeAgentCapability) => (
  i18n.global.t('components.AiChat.homeAgent.promptExamples.capability', [capability.name])
);

const getCapabilityPromptExamples = (capability: HomeAgentCapability) => {
  const prompts = toArray(capability.metadata?.promptExamples);
  return prompts.length ? prompts : [buildCapabilityExample(capability)];
};

const interleavePromptGroups = (groups: string[][]) => {
  const normalizedGroups = groups
    .map((group) => uniqueStrings(group))
    .filter((group) => group.length);
  if (!normalizedGroups.length) {
    return [];
  }

  const maxLength = Math.max(...normalizedGroups.map((group) => group.length));
  const result: string[] = [];
  for (let index = 0; index < maxLength; index += 1) {
    normalizedGroups.forEach((group) => {
      if (group[index]) {
        result.push(group[index]);
      }
    });
  }
  return uniqueStrings(result);
};

const isPromptCapability = (capability: HomeAgentCapability) => (
  !!capability.kind && capability.kind !== 'menu'
);

const buildCurrentRouteCapabilityPromptExamples = (context: HomeAgentCapabilityContext) => {
  const capabilities = context.capabilities
    .filter((item) => isCapabilityForCurrentRoute(item, context));
  return interleavePromptGroups(capabilities.map(getCapabilityPromptExamples));
};

const buildHomeRoutePromptExamples = (context: HomeAgentCapabilityContext) => {
  const currentMenu = getCurrentMenu(context);
  const capabilityExamples = interleavePromptGroups(
    context.capabilities
      .filter(isPromptCapability)
      .filter((capability) => toArray(capability.metadata?.promptExamples).length)
      .map(getCapabilityPromptExamples),
  );
  const menuExamples = context.menus
    .filter((menu) => !isLikelyContainerMenu(menu))
    .sort((a, b) => scorePromptMenu(b, currentMenu) - scorePromptMenu(a, currentMenu))
    .slice(0, 3)
    .map((menu) => i18n.global.t('components.AiChat.homeAgent.promptExamples.openMenu', [
      menu.title,
    ]));
  const agentCount = context.capabilities.filter((item) => item.kind === 'agent').length;

  return uniqueStrings([
    ...capabilityExamples,
    ...(context.findMenu('device/Instance')
      ? [i18n.global.t('components.AiChat.homeAgent.promptExamples.openDevice')]
      : []),
    ...(agentCount > 0 && !capabilityExamples.length
      ? [i18n.global.t('components.AiChat.homeAgent.promptExamples.listAgents')]
      : []),
    ...(!capabilityExamples.length ? menuExamples : []),
    i18n.global.t('components.AiChat.homeAgent.promptExamples.findMenu'),
  ]);
};

const buildCapabilityPromptExamples = (context: HomeAgentCapabilityContext) => {
  const currentExamples = buildCurrentRouteCapabilityPromptExamples(context);
  if (currentExamples.length) {
    return currentExamples;
  }
  if (isHomeRoute(context)) {
    return buildHomeRoutePromptExamples(context);
  }

  const examples: string[] = [];
  const menu = selectPromptMenu(context);
  const agentCount = context.capabilities.filter((item) => item.kind === 'agent').length;

  if (menu) {
    examples.push(i18n.global.t('components.AiChat.homeAgent.promptExamples.openMenu', [menu.title]));
  }
  if (agentCount > 0) {
    examples.push(i18n.global.t('components.AiChat.homeAgent.promptExamples.listAgents'));
  }
  examples.push(i18n.global.t('components.AiChat.homeAgent.promptExamples.findMenu'));

  return examples;
};

const createHomeAgentBaseTools = () => defineAiClientTools<HomeAgentCapabilityContext>([
  {
    id: 'home_agent_get_context',
    name: 'home_agent_get_context',
    displayName: i18n.global.t('components.AiChat.homeAgent.tools.context.displayName'),
    progressText: i18n.global.t('components.AiChat.homeAgent.tools.context.progressText'),
    description: i18n.global.t('components.AiChat.homeAgent.tools.context.description'),
    inputs: [],
    output: { type: 'object' },
    annotations: { readOnlyHint: true },
    execute: (_args, context) => ({
      currentRoute: context.currentRoute,
      currentView: context.currentView,
      menuCount: context.menus.length,
      capabilityCount: context.capabilities.length,
      categories: uniqueStrings(context.capabilities.map((item) => item.category)),
      capabilityKinds: uniqueStrings(context.capabilities.map((item) => item.kind)),
    }),
  },
  {
    id: 'home_agent_search_capabilities',
    name: 'home_agent_search_capabilities',
    displayName: i18n.global.t('components.AiChat.homeAgent.tools.search.displayName'),
    progressText: i18n.global.t('components.AiChat.homeAgent.tools.search.progressText'),
    description: i18n.global.t('components.AiChat.homeAgent.tools.search.description'),
    inputs: [
      {
        id: 'keyword',
        name: 'keyword',
        description: i18n.global.t('components.AiChat.homeAgent.tools.search.keyword'),
        required: false,
        valueType: 'string',
      },
      {
        id: 'kind',
        name: 'kind',
        description: i18n.global.t('components.AiChat.homeAgent.tools.search.kind'),
        required: false,
        valueType: 'string',
      },
      {
        id: 'category',
        name: 'category',
        description: i18n.global.t('components.AiChat.homeAgent.tools.search.category'),
        required: false,
        valueType: 'string',
      },
      {
        id: 'limit',
        name: 'limit',
        description: i18n.global.t('components.AiChat.homeAgent.tools.search.limit'),
        required: false,
        valueType: 'int',
      },
    ],
    output: { type: 'object' },
    annotations: { readOnlyHint: true },
    execute: (args, context) => {
      const matches = filterCapabilities(context.capabilities, args);
      const limit = clampLimit(args.limit);
      return {
        keyword: args.keyword,
        kind: args.kind,
        category: args.category,
        total: matches.length,
        items: matches.slice(0, limit).map(compactCapability),
      };
    },
  },
  {
    id: 'home_agent_open_menu',
    name: 'home_agent_open_menu',
    displayName: i18n.global.t('components.AiChat.homeAgent.tools.openMenu.displayName'),
    progressText: i18n.global.t('components.AiChat.homeAgent.tools.openMenu.progressText'),
    description: i18n.global.t('components.AiChat.homeAgent.tools.openMenu.description'),
    confirm: {
      title: i18n.global.t('components.AiChat.homeAgent.tools.openMenu.confirmTitle'),
      content: (args, context) => {
        const menu = context.findMenu(String(args.menuCode || args.routeName || ''));
        return menu
          ? i18n.global.t('components.AiChat.homeAgent.tools.openMenu.confirmContent', [menu.breadcrumb.join(' / ')])
          : i18n.global.t('components.AiChat.homeAgent.tools.openMenu.confirmUnknown');
      },
      okText: i18n.global.t('components.AiChat.homeAgent.tools.openMenu.okText'),
      cancelText: i18n.global.t('verify.cancel'),
    },
    inputs: [
      {
        id: 'menuCode',
        name: 'menuCode',
        description: i18n.global.t('components.AiChat.homeAgent.tools.openMenu.menuCode'),
        required: true,
        valueType: 'string',
      },
      {
        id: 'query',
        name: 'query',
        description: i18n.global.t('components.AiChat.homeAgent.tools.openMenu.query'),
        required: false,
        valueType: { type: 'object' },
      },
      {
        id: 'params',
        name: 'params',
        description: i18n.global.t('components.AiChat.homeAgent.tools.openMenu.params'),
        required: false,
        valueType: { type: 'object' },
      },
    ],
    output: { type: 'object' },
    annotations: { readOnlyHint: false, idempotentHint: true },
    execute: (args, context) => {
      const menuCode = String(args.menuCode || args.routeName || '');
      const menu = context.findMenu(menuCode);
      const opened = context.navigateToMenu(menuCode, {
        query: isPlainRecord(args.query) ? args.query : {},
        params: isPlainRecord(args.params) ? args.params : {},
      });

      return {
        ok: opened,
        menu: menu ? {
          code: menu.code,
          title: menu.title,
          breadcrumb: menu.breadcrumb,
          path: menu.path,
          routeName: menu.routeName,
        } : undefined,
        error: opened ? undefined : i18n.global.t('components.AiChat.homeAgent.tools.openMenu.notFound'),
      };
    },
  },
]);

class HomeAgentCapabilityRegistry {
  private providers = new Map<string, Array<{ provider: HomeAgentCapabilityProvider; token: symbol }>>();

  private emitChange() {
    window.dispatchEvent(new CustomEvent(HOME_AGENT_CAPABILITY_CHANGE_EVENT));
  }

  register(provider: HomeAgentCapabilityProvider) {
    const id = normalizeText(provider?.id);
    if (!id) {
      return () => undefined;
    }
    const token = Symbol(id);
    const providers = this.providers.get(id) || [];
    // Static module providers and mounted page components may share an id; keep a stack so
    // the page-scoped provider can disappear without deleting the module-level fallback.
    this.providers.set(id, [...providers, {
      provider: { ...provider, id },
      token,
    }]);
    this.emitChange();
    return () => {
      const current = this.providers.get(id) || [];
      const next = current.filter((item) => item.token !== token);
      if (next.length) {
        this.providers.set(id, next);
        this.emitChange();
      } else if (current.length) {
        this.providers.delete(id);
        this.emitChange();
      }
    };
  }

  unregister(id: string) {
    this.providers.delete(normalizeText(id));
    this.emitChange();
  }

  getProviders() {
    return Array.from(this.providers.values())
      .map((items) => items[items.length - 1]?.provider)
      .filter((item): item is HomeAgentCapabilityProvider => !!item)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }
}

export const homeAgentCapabilityRegistry = new HomeAgentCapabilityRegistry();

export const registerHomeAgentCapabilityProvider = (
  provider: HomeAgentCapabilityProvider,
) => homeAgentCapabilityRegistry.register(provider);

export const createHomeAgentContext = (
  options: HomeAgentRuntimeOptions = {},
) => createBaseContext(options);

const buildProviderTools = (context: HomeAgentCapabilityContext) => (
  getProviders().flatMap((provider) => toArray(provider.getClientTools?.(context)))
);

const buildProviderWorkflowGuides = (context: HomeAgentCapabilityContext) => (
  getProviders().flatMap((provider) => toArray(provider.getWorkflowGuides?.(context)))
);

const buildProviderPromptExamples = (context: HomeAgentCapabilityContext) => (
  getProviders().flatMap((provider) => toArray(provider.getPromptExamples?.(context)))
);

const buildProviderSystemPromptLines = (context: HomeAgentCapabilityContext) => (
  getProviders().flatMap((provider) => toArray(provider.getSystemPromptLines?.(context)))
);

const buildHomeAgentSystemPrompt = (
  context: HomeAgentCapabilityContext,
  options: HomeAgentRuntimeOptions,
) => {
  const topMenus = context.menus.slice(0, 8).map((menu) => `${menu.title}(${menu.code})`).join('、');
  return [
    i18n.global.t('components.AiChat.homeAgent.prompt.role'),
    i18n.global.t('components.AiChat.homeAgent.prompt.discovery'),
    i18n.global.t('components.AiChat.homeAgent.prompt.dynamicLoading'),
    i18n.global.t('components.AiChat.homeAgent.prompt.navigation'),
    i18n.global.t('components.AiChat.homeAgent.prompt.menuLinks'),
    i18n.global.t('components.AiChat.homeAgent.prompt.boundary'),
    topMenus
      ? i18n.global.t('components.AiChat.homeAgent.prompt.visibleMenus', [topMenus])
      : i18n.global.t('components.AiChat.homeAgent.prompt.noMenus'),
    ...toArray(options.systemPromptLines),
    ...buildProviderSystemPromptLines(context),
  ].filter(Boolean).join('\n');
};

const buildHomeAgentToolsDescription = (
  context: HomeAgentCapabilityContext,
  options: HomeAgentRuntimeOptions,
) => options.toolsDescription || [
  i18n.global.t('components.AiChat.homeAgent.toolsDescription'),
  i18n.global.t('components.AiChat.homeAgent.toolsDescriptionStats', [
    context.menus.length,
    context.capabilities.length,
  ]),
].join('\n');

const buildHomeAgentPromptExamples = (
  context: HomeAgentCapabilityContext,
  options: HomeAgentRuntimeOptions,
) => uniqueStrings([
  ...(options.promptExamples || []),
  ...buildProviderPromptExamples(context),
  ...buildCapabilityPromptExamples(context),
]).slice(0, PROMPT_EXAMPLE_LIMIT);

export const resolveHomeAgentMenuLink = (href: string) => {
  const raw = normalizeSameOriginHashLink(href);
  if (!raw) return '';

  if (raw.startsWith('#')) {
    const fragment = raw.slice(1);
    const params = new URLSearchParams(fragment.includes('=') ? fragment : `menu=${fragment}`);
    return normalizeText(params.get('menu') || params.get('menuCode') || params.get('route') || '');
  }

  const menuMatch = raw.match(/^jetlinks:\/\/menu\/([^?#]+)/i) || raw.match(/^menu:\/\/([^?#]+)/i);
  if (menuMatch?.[1]) {
    try {
      return decodeURIComponent(menuMatch[1]);
    } catch {
      return menuMatch[1];
    }
  }

  return '';
};

export const resolveHomeAgentRouteLink = (href: string): HomeAgentRouteLink | undefined => {
  const raw = normalizeSameOriginHashLink(href);
  if (!raw) return undefined;

  const routePath = resolveHashRoutePath(raw);
  if (routePath) {
    return {
      routeName: '',
      path: routePath,
    };
  }

  if (raw.startsWith('#')) {
    const params = new URLSearchParams(raw.slice(1));
    const routeName = normalizeText(params.get('routeName') || params.get('route'));
    if (!routeName) return undefined;

    const routeParams = {
      ...parseObjectParam(params.get('params')),
      ...(params.get('id') ? { id: params.get('id') } : {}),
      ...(params.get('tab') ? { tab: params.get('tab') } : {}),
    };
    return {
      routeName,
      menuCode: normalizeText(params.get('menu') || params.get('menuCode')),
      params: routeParams,
      query: parseObjectParam(params.get('query')),
    };
  }

  const routeMatch = raw.match(/^jetlinks:\/\/route\/([^?#]+)/i) || raw.match(/^route:\/\/([^?#]+)/i);
  if (!routeMatch?.[1]) {
    return undefined;
  }

  let routeName = routeMatch[1];
  try {
    routeName = decodeURIComponent(routeName);
  } catch {
    // Keep the raw route name when the link is not URI-encoded.
  }
  const queryIndex = raw.indexOf('?');
  const search = queryIndex >= 0 ? raw.slice(queryIndex + 1).split('#')[0] : '';
  const params = new URLSearchParams(search);
  const routeParams = {
    ...parseObjectParam(params.get('params')),
    ...(params.get('id') ? { id: params.get('id') } : {}),
    ...(params.get('tab') ? { tab: params.get('tab') } : {}),
  };

  return {
    routeName: normalizeText(routeName),
    menuCode: normalizeText(params.get('menu') || params.get('menuCode')),
    params: routeParams,
    query: parseObjectParam(params.get('query')),
  };
};

export const isHomeAgentMenuLink = (href: string) => !!resolveHomeAgentMenuLink(href);

export const createHomeAgentMarkdownLinkHandler = (
  options: HomeAgentRuntimeOptions = {},
) => (payload: { href: string; event: MouseEvent; defaultOpen?: () => void }) => {
  const routeLink = resolveHomeAgentRouteLink(payload.href);
  if (routeLink?.routeName || routeLink?.path) {
    const context = createHomeAgentContext(options);
    const permissionAnchor = findRoutePermissionAnchor(routeLink, context);
    if (!permissionAnchor) {
      if (routeLink.path) {
        return false;
      }
      payload.event.preventDefault();
      return true;
    }
    payload.event.preventDefault();
    if (typeof payload.defaultOpen === 'function') {
      payload.defaultOpen();
      return true;
    }
    if (routeLink.path) {
      void router.push(routeLink.path);
      return true;
    }
    return context.navigateToRoute(routeLink.routeName, {
      params: routeLink.params,
      query: routeLink.query,
    });
  }

  const menuCode = resolveHomeAgentMenuLink(payload.href);
  if (!menuCode) return false;

  const context = createHomeAgentContext(options);
  const menu = context.findMenu(menuCode);
  payload.event.preventDefault();
  if (!menu) {
    return true;
  }
  return context.navigateToMenu(menuCode);
};

export const createHomeAgentRuntime = (
  options: HomeAgentRuntimeOptions = {},
): HomeAgentRuntime => {
  const getContext = () => createHomeAgentContext(options);
  const context = getContext();
  const providerTools = buildProviderTools(context);
  const extraTools = resolveMaybeArray(options.extraTools);
  const registeredScopes = uniqueStrings([
    HOME_AGENT_TOOL_SCOPE,
    ...toArray(options.registeredToolScopes),
  ]);
  const runtime = createAiClientToolRuntime<HomeAgentCapabilityContext>(
    [
      ...createHomeAgentBaseTools(),
      ...providerTools,
      ...extraTools,
    ],
    {
      toolsName: options.toolsName || i18n.global.t('components.AiChat.homeAgent.toolsName'),
      toolsDescription: buildHomeAgentToolsDescription(context, options),
      registeredToolScopes: registeredScopes,
      getContext,
      resultGuard: {
        maxJsonLength: 64 * 1024,
        maxArrayLength: 30,
        maxObjectKeys: 64,
      },
      riskDefaults: {
        readOnly: true,
        parallelSafe: true,
        needsApproval: false,
      },
    },
  );

  return {
    ...runtime,
    getContext,
    parameters: {
      subjectType: HOME_AGENT_SUBJECT_TYPE,
      subjectId: HOME_AGENT_CLIENT_ID,
      subjectName: i18n.global.t('components.AiChat.homeAgent.subjectName'),
      conversationTitle: i18n.global.t('components.AiChat.homeAgent.conversationTitle'),
      currentView: context.currentView,
      currentRoute: context.currentRoute,
      clientTools: runtime.clientTools,
      clientToolHandler: runtime.handleClientToolCall,
      clientToolsName: runtime.clientToolsName,
      clientToolsDescription: runtime.clientToolsDescription,
      workflowGuides: buildProviderWorkflowGuides(context),
      markdownLinkHandler: createHomeAgentMarkdownLinkHandler(options),
      ...(options.onConversationMessage ? { onConversationMessage: options.onConversationMessage } : {}),
      systemPrompt: buildHomeAgentSystemPrompt(context, options),
      openingStatement: options.openingStatement || i18n.global.t('components.AiChat.homeAgent.opening'),
      promptExamples: buildHomeAgentPromptExamples(context, options),
    },
  };
};
