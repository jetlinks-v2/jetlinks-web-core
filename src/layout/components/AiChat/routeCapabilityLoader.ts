import i18n from '@jetlinks-web-core/locales';
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry';
import { homeAgentCapabilityRegistry } from './homeAgentRegistry';
import type {
  HomeAgentCapabilityContext,
  HomeAgentCapabilityProvider,
} from './homeAgentContracts';
import {
  clientToolOutput,
  defineClientTool,
  type CompiledClientTool,
} from './clientToolApi';
import {
  generalAgentExtensionRegistry,
  type GeneralAgentExtension,
} from './generalAgentExtensions';

type MaybeArray<T> = T | T[] | undefined | null;

type HomeAgentCapabilityProviderModule = {
  default?: MaybeArray<HomeAgentCapabilityProvider>;
  homeAgentCapabilityProvider?: HomeAgentCapabilityProvider;
  homeAgentCapabilityProviders?: HomeAgentCapabilityProvider[];
  registerHomeAgentProvider?: () => MaybeArray<() => void> | void;
};

type GeneralAgentExtensionModule = {
  default?: MaybeArray<GeneralAgentExtension>;
  generalAgentExtension?: GeneralAgentExtension;
  generalAgentExtensions?: GeneralAgentExtension[];
};

export interface LoadHomeAgentCapabilityProvidersOptions {
  menuCode?: string;
  routeName?: string;
  path?: string;
  loadAll?: boolean;
}

export interface LoadHomeAgentCapabilityProvidersResult {
  discovered: number;
  matched: number;
  attempted: number;
  total: number;
  loaded: string[];
  skipped: string[];
  rejected: string[];
}

type HomeAgentCapabilityProviderLoader = () => Promise<unknown>;
export type AgentProviderActivationScopeKind = 'path' | 'menuCode' | 'routeName';

export interface AgentProviderActivationManifest {
  version: 'general-agent-provider-activation/v1';
  scopes: Array<{
    kind: AgentProviderActivationScopeKind;
    values: string[];
  }>;
}

export interface AgentCapabilityProviderResource {
  loader: HomeAgentCapabilityProviderLoader;
  activation: AgentProviderActivationManifest;
}

interface DiscoveredProviderResource {
  modulePath: string;
  loader?: HomeAgentCapabilityProviderLoader;
  activation?: AgentProviderActivationManifest;
  legacy: boolean;
  valid: boolean;
}

type ProviderResourceName = 'generalAgentExtensions' | 'homeAgentProviders';
type ProviderScope = 'general' | 'home';

const loadedModules = new Map<string, Array<() => void>>();
const loadingModules = new Map<string, Promise<LoadHomeAgentCapabilityProvidersResult>>();

const normalizeText = (value: unknown) => String(value || '').trim();
const isRecord = (value: unknown): value is Record<string, unknown> => (
  !!value && typeof value === 'object' && !Array.isArray(value)
);

const toArray = <T>(value: MaybeArray<T>): T[] => {
  if (value === undefined || value === null) {
    return [];
  }
  return (Array.isArray(value) ? value : [value]).filter((item): item is T => !!item);
};

const normalizeRouteKey = (value: unknown) => normalizeText(value)
  .toLowerCase()
  .replace(/^#/, '')
  .replace(/^\/+|\/+$/g, '');

const ACTIVATION_VERSION = 'general-agent-provider-activation/v1';
const ACTIVATION_SCOPE_KINDS = new Set<AgentProviderActivationScopeKind>([
  'path',
  'menuCode',
  'routeName',
]);

const normalizeActivationManifest = (value: unknown): AgentProviderActivationManifest | undefined => {
  if (!isRecord(value) || value.version !== ACTIVATION_VERSION || !Array.isArray(value.scopes)) {
    return undefined;
  }
  if (!value.scopes.length) {
    return undefined;
  }

  const scopes: AgentProviderActivationManifest['scopes'] = [];
  for (const candidate of value.scopes) {
    if (!isRecord(candidate) || !ACTIVATION_SCOPE_KINDS.has(candidate.kind as AgentProviderActivationScopeKind)) {
      return undefined;
    }
    if (!Array.isArray(candidate.values) || !candidate.values.length) {
      return undefined;
    }
    const normalizedValues = candidate.values.map((item) => (
      typeof item === 'string' ? normalizeRouteKey(item) : ''
    ));
    if (normalizedValues.some(item => !item)) {
      return undefined;
    }
    const values = Array.from(new Set(normalizedValues));
    scopes.push({
      kind: candidate.kind as AgentProviderActivationScopeKind,
      values,
    });
  }
  return { version: ACTIVATION_VERSION, scopes };
};

const getProviderResources = (resourceName: ProviderResourceName): DiscoveredProviderResource[] => {
  const resources: DiscoveredProviderResource[] = [];
  moduleRegistry.getAllModules().forEach((module, moduleId) => {
    const entries = module[resourceName];
    if (!entries || typeof entries !== 'object') return;
    Object.entries(entries as Record<string, unknown>).forEach(([path, resource]) => {
      const modulePath = `${moduleId}::${path}`;
      if (typeof resource === 'function') {
        resources.push({
          modulePath,
          loader: resource as HomeAgentCapabilityProviderLoader,
          legacy: true,
          valid: true,
        });
        return;
      }
      const loader = isRecord(resource) && typeof resource.loader === 'function'
        ? resource.loader as HomeAgentCapabilityProviderLoader
        : undefined;
      const activation = isRecord(resource)
        ? normalizeActivationManifest(resource.activation)
        : undefined;
      resources.push({
        modulePath,
        loader,
        activation,
        legacy: false,
        valid: !!loader && !!activation,
      });
    });
  });
  return resources;
};

const matchesOptions = (
  resource: DiscoveredProviderResource,
  options: LoadHomeAgentCapabilityProvidersOptions = {},
) => {
  if (options.loadAll) {
    return resource.valid;
  }
  if (!resource.activation || resource.legacy || !resource.valid) {
    return false;
  }
  const candidates: Record<AgentProviderActivationScopeKind, string> = {
    path: normalizeRouteKey(options.path),
    menuCode: normalizeRouteKey(options.menuCode),
    routeName: normalizeRouteKey(options.routeName),
  };
  return resource.activation.scopes.some(scope => (
    !!candidates[scope.kind] && scope.values.includes(candidates[scope.kind])
  ));
};

const isProvider = (value: unknown): value is HomeAgentCapabilityProvider => (
  !!value
  && typeof value === 'object'
  && !!normalizeText((value as HomeAgentCapabilityProvider).id)
);

const resolveHomeModuleProviders = (module: HomeAgentCapabilityProviderModule) => [
  ...toArray(module.default).filter(isProvider),
  ...toArray(module.homeAgentCapabilityProvider).filter(isProvider),
  ...toArray(module.homeAgentCapabilityProviders).filter(isProvider),
];

const isExtension = (value: unknown): value is GeneralAgentExtension => (
  !!value
  && typeof value === 'object'
  && !!normalizeText((value as GeneralAgentExtension).id)
);

const resolveGeneralAgentExtensions = (module: GeneralAgentExtensionModule) => [
  ...toArray(module.default).filter(isExtension),
  ...toArray(module.generalAgentExtension).filter(isExtension),
  ...toArray(module.generalAgentExtensions).filter(isExtension),
];

const loadProviderModule = async (
  resource: DiscoveredProviderResource,
  scope: ProviderScope,
) => {
  const { modulePath, loader } = resource;
  const scopedModulePath = `${scope}:${modulePath}`;
  if (loadedModules.has(scopedModulePath)) {
    return {
      loaded: false,
      modulePath,
    };
  }

  if (!loader) {
    throw new Error(`Provider loader is unavailable: ${modulePath}`);
  }
  const module = await loader() as HomeAgentCapabilityProviderModule & GeneralAgentExtensionModule;
  const unregisters = scope === 'general'
    ? resolveGeneralAgentExtensions(module)
      .map(extension => generalAgentExtensionRegistry.register(extension, scope))
    : resolveHomeModuleProviders(module)
      .map(provider => homeAgentCapabilityRegistry.register(provider, scope));
  const registrations = scope === 'home'
    ? module.registerHomeAgentProvider?.()
    : undefined;
  if (registrations) {
    unregisters.push(...toArray(registrations));
  }

  loadedModules.set(scopedModulePath, unregisters);
  return {
    loaded: unregisters.length > 0,
    modulePath,
  };
};

const loadCapabilityProviders = async (
  resourceName: ProviderResourceName,
  scope: ProviderScope,
  options: LoadHomeAgentCapabilityProvidersOptions = {},
): Promise<LoadHomeAgentCapabilityProvidersResult> => {
  const resources = getProviderResources(resourceName);
  const rejectedResources = resources.filter(resource => !resource.valid);
  const matchedResources = resources.filter(resource => matchesOptions(resource, options));
  const cacheKey = JSON.stringify({
    scope,
    resourceName,
    menuCode: normalizeRouteKey(options.menuCode),
    routeName: normalizeRouteKey(options.routeName),
    path: normalizeRouteKey(options.path),
    loadAll: !!options.loadAll,
  });

  if (loadingModules.has(cacheKey)) {
    return loadingModules.get(cacheKey)!;
  }

  const promise = Promise.all(matchedResources.map(async (resource) => {
    try {
      return {
        ...(await loadProviderModule(resource, scope)),
        rejected: false,
      };
    } catch {
      return {
        loaded: false,
        modulePath: resource.modulePath,
        rejected: true,
      };
    }
  }))
    .then((items) => {
      const rejected = [
        ...rejectedResources.map(resource => resource.modulePath),
        ...items.filter(item => item.rejected).map(item => item.modulePath),
      ];
      const accepted = items.filter(item => !item.rejected);
      return {
        discovered: resources.length,
        matched: matchedResources.length,
        attempted: matchedResources.length,
        total: matchedResources.length,
        loaded: accepted.filter(item => item.loaded).map(item => item.modulePath),
        skipped: accepted.filter(item => !item.loaded).map(item => item.modulePath),
        rejected: Array.from(new Set(rejected)),
      };
    })
    .finally(() => {
      loadingModules.delete(cacheKey);
    });

  loadingModules.set(cacheKey, promise);
  return promise;
};

export const loadHomeAgentCapabilityProviders = (
  options: LoadHomeAgentCapabilityProvidersOptions = {},
) => loadCapabilityProviders('homeAgentProviders', 'home', options);

export const loadGeneralAgentExtensions = (
  options: LoadHomeAgentCapabilityProvidersOptions = {},
) => loadCapabilityProviders('generalAgentExtensions', 'general', options);

const unloadCapabilityProviders = (scope: ProviderScope) => {
  loadedModules.forEach((unregisters, key) => {
    if (!key.startsWith(`${scope}:`)) return;
    unregisters.forEach((unregister) => unregister());
    loadedModules.delete(key);
  });
};

export const unloadHomeAgentCapabilityProviders = () => unloadCapabilityProviders('home');
export const unloadGeneralAgentExtensions = () => unloadCapabilityProviders('general');

const createCapabilityLoaderTool = (
  toolId: string,
  loadProviders: typeof loadHomeAgentCapabilityProviders,
  afterLoaded?: () => void,
): CompiledClientTool<HomeAgentCapabilityContext> => defineClientTool<
  Record<string, any>,
  HomeAgentCapabilityContext,
  Record<string, any>
>({
  id: toolId,
  description: {
    text: i18n.global.t('components.AiChat.homeAgent.tools.loadCapabilities.description'),
    capabilities: ['client-capability.load'],
    intents: [
      '加载当前路由或菜单尚未注册的专属能力',
      'load route- or menu-specific capabilities that are not registered yet',
    ],
    notFor: [
      '使用当前会话已声明的业务工具查询或分析数据',
      'query or analyze data with a business tool already declared in the current session',
    ],
    activation: 'ON_DEMAND',
  },
  presentation: {
    displayName: i18n.global.t('components.AiChat.homeAgent.tools.loadCapabilities.displayName'),
    progressText: i18n.global.t('components.AiChat.homeAgent.tools.loadCapabilities.progressText'),
  },
  inputs: [
    {
      id: 'menuCode',
      name: 'menuCode',
      description: i18n.global.t('components.AiChat.homeAgent.tools.loadCapabilities.menuCode'),
      required: false,
      valueType: 'string',
    },
    {
      id: 'routeName',
      name: 'routeName',
      description: i18n.global.t('components.AiChat.homeAgent.tools.loadCapabilities.routeName'),
      required: false,
      valueType: 'string',
    },
    {
      id: 'path',
      name: 'path',
      description: i18n.global.t('components.AiChat.homeAgent.tools.loadCapabilities.path'),
      required: false,
      valueType: 'string',
    },
    {
      id: 'loadAll',
      name: 'loadAll',
      description: i18n.global.t('components.AiChat.homeAgent.tools.loadCapabilities.loadAll'),
      required: false,
      valueType: 'boolean',
    },
  ],
  consumes: [{
    name: 'session-context', type: 'structured-data', mediaType: 'application/json',
    shape: 'session.context', required: false, sourcePolicy: 'CONTEXT',
  }],
  effect: { kind: 'READ' },
  output: clientToolOutput.lookup({
    name: 'client-tool-catalog',
    shape: 'tool.catalog',
  }),
  owner: { module: 'jetlinks-web-core', group: 'home-agent' },
  execute: async (args, context) => {
    const result = await loadProviders({
      menuCode: args.menuCode,
      routeName: args.routeName || context.currentRoute.name,
      path: args.path || context.currentRoute.path,
      loadAll: args.loadAll === true,
    });
    afterLoaded?.();
    return {
      ...result,
      currentRoute: context.currentRoute,
    };
  },
});

export const createHomeAgentCapabilityLoaderTool = (
  afterLoaded?: () => void,
) => createCapabilityLoaderTool(
  'home_agent_load_route_capabilities',
  loadHomeAgentCapabilityProviders,
  afterLoaded,
);

export const createGeneralAgentExtensionLoaderTool = (
  afterLoaded?: () => void,
) => createCapabilityLoaderTool(
  'general_agent_load_route_capabilities',
  loadGeneralAgentExtensions,
  afterLoaded,
);
