import i18n from '@jetlinks-web-core/locales';
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry';
import { homeAgentCapabilityRegistry } from './homeAgentRegistry';
import type {
  HomeAgentCapabilityContext,
  HomeAgentCapabilityProvider,
} from './homeAgentContracts';
import type { AiClientToolDefinition } from './clientTools';
import {
  defineAiClientToolContract,
} from './clientTools';
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
  total: number;
  loaded: string[];
  skipped: string[];
}

type HomeAgentCapabilityProviderLoader = () => Promise<unknown>;
type ProviderResourceName = 'generalAgentExtensions' | 'homeAgentProviders';
type ProviderScope = 'general' | 'home';

const loadedModules = new Map<string, Array<() => void>>();
const loadingModules = new Map<string, Promise<LoadHomeAgentCapabilityProvidersResult>>();

const normalizeText = (value: unknown) => String(value || '').trim();

const toArray = <T>(value: MaybeArray<T>): T[] => {
  if (value === undefined || value === null) {
    return [];
  }
  return (Array.isArray(value) ? value : [value]).filter((item): item is T => !!item);
};

const normalizeRouteKey = (value: unknown) => normalizeText(value)
  .replace(/^#\/?/, '')
  .replace(/^\//, '')
  .replace(/^iot\//, '');

const getProviderRouteCode = (modulePath: string) => {
  const resourcePath = modulePath.includes('::') ? modulePath.split('::').slice(1).join('::') : modulePath;
  return normalizeRouteKey(
    resourcePath
      .replace(/^.*\/views\//, '')
      .replace(/\/(?:generalAgentExtension|homeAgentProvider)\.ts$/, '')
      .replace(/^\.\//, ''),
  );
};

const getProviderLoaders = (resourceName: ProviderResourceName) => {
  const loaders: Record<string, HomeAgentCapabilityProviderLoader> = {};
  moduleRegistry.getAllModules().forEach((module, moduleId) => {
    const resources = module[resourceName];
    if (!resources || typeof resources !== 'object') return;
    Object.entries(resources as Record<string, unknown>).forEach(([path, loader]) => {
      if (typeof loader === 'function') {
        loaders[`${moduleId}::${path}`] = loader as HomeAgentCapabilityProviderLoader;
      }
    });
  });
  return loaders;
};

const matchesOptions = (
  modulePath: string,
  options: LoadHomeAgentCapabilityProvidersOptions = {},
) => {
  if (options.loadAll) {
    return true;
  }

  const routeCode = getProviderRouteCode(modulePath);
  const candidates = [
    options.menuCode,
    options.routeName,
    options.path,
  ].map(normalizeRouteKey).filter(Boolean);

  return !candidates.length || candidates.some((item) => item === routeCode);
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
  providerLoaders: Record<string, HomeAgentCapabilityProviderLoader>,
  modulePath: string,
  scope: ProviderScope,
) => {
  const scopedModulePath = `${scope}:${modulePath}`;
  if (loadedModules.has(scopedModulePath)) {
    return {
      loaded: false,
      modulePath,
    };
  }

  const loader = providerLoaders[modulePath];
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
  const providerLoaders = getProviderLoaders(resourceName);
  const providerPaths = Object.keys(providerLoaders);
  const modulePaths = providerPaths.filter((modulePath) => matchesOptions(modulePath, options));
  const cacheKey = JSON.stringify({
    scope,
    menuCode: normalizeRouteKey(options.menuCode),
    routeName: normalizeRouteKey(options.routeName),
    path: normalizeRouteKey(options.path),
    loadAll: !!options.loadAll,
  });

  if (loadingModules.has(cacheKey)) {
    return loadingModules.get(cacheKey)!;
  }

  const promise = Promise.all(modulePaths.map((modulePath) => loadProviderModule(providerLoaders, modulePath, scope)))
    .then((items) => ({
      total: providerPaths.length,
      loaded: items.filter((item) => item.loaded).map((item) => item.modulePath),
      skipped: items.filter((item) => !item.loaded).map((item) => item.modulePath),
    }))
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

const CAPABILITY_LOADER_CONTRACT = defineAiClientToolContract({
  routingKind: 'discovery',
  routing: {
    capabilities: ['client-capability.load'],
    accepts: ['session-context'],
    evidencePolicy: 'none',
  },
  outputs: [{
    kind: 'lookup',
    name: 'client-tool-catalog',
    shape: 'tool.catalog',
    path: '$',
  }],
});

const createCapabilityLoaderTool = (
  toolId: string,
  loadProviders: typeof loadHomeAgentCapabilityProviders,
  afterLoaded?: () => void,
): AiClientToolDefinition<HomeAgentCapabilityContext> => ({
  id: toolId,
  name: toolId,
  displayName: i18n.global.t('components.AiChat.homeAgent.tools.loadCapabilities.displayName'),
  progressText: i18n.global.t('components.AiChat.homeAgent.tools.loadCapabilities.progressText'),
  description: i18n.global.t('components.AiChat.homeAgent.tools.loadCapabilities.description'),
  ...CAPABILITY_LOADER_CONTRACT,
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
  output: { type: 'object' },
  annotations: { readOnlyHint: true },
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
