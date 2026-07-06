import i18n from '@jetlinks-web-core/locales';
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry';
import {
  registerHomeAgentCapabilityProvider,
  type HomeAgentCapabilityContext,
  type HomeAgentCapabilityProvider,
} from './homeAgentCapabilities';
import type { AiClientToolDefinition } from './clientTools';

type MaybeArray<T> = T | T[] | undefined | null;

type HomeAgentCapabilityProviderModule = {
  default?: MaybeArray<HomeAgentCapabilityProvider>;
  homeAgentCapabilityProvider?: HomeAgentCapabilityProvider;
  homeAgentCapabilityProviders?: HomeAgentCapabilityProvider[];
  registerHomeAgentProvider?: () => MaybeArray<() => void> | void;
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
      .replace(/\/homeAgentProvider\.ts$/, '')
      .replace(/^\.\//, ''),
  );
};

const getProviderLoaders = () => {
  const loaders: Record<string, HomeAgentCapabilityProviderLoader> = {};
  moduleRegistry.getAllModules().forEach((module, moduleId) => {
    const resources = module.homeAgentProviders as Record<string, unknown> | undefined;
    if (!resources || typeof resources !== 'object') {
      return;
    }
    Object.entries(resources).forEach(([path, loader]) => {
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

const resolveModuleProviders = (module: HomeAgentCapabilityProviderModule) => [
  ...toArray(module.default).filter(isProvider),
  ...toArray(module.homeAgentCapabilityProvider).filter(isProvider),
  ...toArray(module.homeAgentCapabilityProviders).filter(isProvider),
];

const loadProviderModule = async (
  providerLoaders: Record<string, HomeAgentCapabilityProviderLoader>,
  modulePath: string,
) => {
  if (loadedModules.has(modulePath)) {
    return {
      loaded: false,
      modulePath,
    };
  }

  const loader = providerLoaders[modulePath];
  const module = await loader() as HomeAgentCapabilityProviderModule;
  const unregisters = resolveModuleProviders(module)
    .map((provider) => registerHomeAgentCapabilityProvider(provider));
  const registered = module.registerHomeAgentProvider?.();
  unregisters.push(...toArray(registered));

  loadedModules.set(modulePath, unregisters);
  return {
    loaded: unregisters.length > 0,
    modulePath,
  };
};

export const loadHomeAgentCapabilityProviders = async (
  options: LoadHomeAgentCapabilityProvidersOptions = {},
): Promise<LoadHomeAgentCapabilityProvidersResult> => {
  const providerLoaders = getProviderLoaders();
  const providerPaths = Object.keys(providerLoaders);
  const modulePaths = providerPaths.filter((modulePath) => matchesOptions(modulePath, options));
  const cacheKey = JSON.stringify({
    menuCode: normalizeRouteKey(options.menuCode),
    routeName: normalizeRouteKey(options.routeName),
    path: normalizeRouteKey(options.path),
    loadAll: !!options.loadAll,
  });

  if (loadingModules.has(cacheKey)) {
    return loadingModules.get(cacheKey)!;
  }

  const promise = Promise.all(modulePaths.map((modulePath) => loadProviderModule(providerLoaders, modulePath)))
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

export const unloadHomeAgentCapabilityProviders = () => {
  loadedModules.forEach((unregisters) => {
    unregisters.forEach((unregister) => unregister());
  });
  loadedModules.clear();
};

export const createHomeAgentCapabilityLoaderTool = (
  afterLoaded?: () => void,
): AiClientToolDefinition<HomeAgentCapabilityContext> => ({
  id: 'home_agent_load_route_capabilities',
  name: 'home_agent_load_route_capabilities',
  displayName: i18n.global.t('components.AiChat.homeAgent.tools.loadCapabilities.displayName'),
  progressText: i18n.global.t('components.AiChat.homeAgent.tools.loadCapabilities.progressText'),
  description: i18n.global.t('components.AiChat.homeAgent.tools.loadCapabilities.description'),
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
    const result = await loadHomeAgentCapabilityProviders({
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
