# jetlinks-web-core Architecture

`jetlinks-web-core` is the runtime shell for the JetLinks operations UI. It owns app startup, core routes, layout, stores, common components, theme tokens, i18n, request setup, micro-app integration, and the module loading hooks used by `modules/*`.

This document is an entry map. It records the current implementation contracts and points to the files that own them.

## Workspace Boundary

The pnpm workspace is defined in `pnpm-workspace.yaml`:

- `jetlinks-web-core`: the shared shell and reusable frontend capability layer.
- `modules/*`: business UI modules loaded by the shell.

Do not statically deep-import private code from one business module into another module when that module must support independent `--module-name` builds. Put truly shared behavior in `jetlinks-web-core` or another public shared export.

## Startup Chain

Primary startup files:

- `jetlinks-web-core/src/main.ts`
- `jetlinks-web-core/src/App.vue`
- `jetlinks-web-core/src/package.ts`

Current startup flow:

1. `main.ts` initializes axios with `initAxios()`, loads micro-app support with `loadMicroApp()`, starts `microApp` when `VITE_MICRO_APP` is enabled, then installs Pinia, router, directives, Ant Design Vue, i18n, `@jetlinks-web/components`, and `jetlinks-web-core/src/components`.
2. `package.ts` calls `registerModule()` at module load time, so enabled `modules/*/index.ts` files can register their module resources before app features consume them.
3. `App.vue` wraps the route view in `ConfigProvider`, applies runtime theme tokens, initializes websocket packages with `initPackages()`, batches component extension registration, handles URL token/from query cleanup, and installs the permission provider for common hooks.

Startup changes are high-risk because they can affect login, token handling, websocket connection, module registration, theme, and micro-app data exchange.

## Module Loading

Module discovery is centralized in:

- `jetlinks-web-core/src/utils/modules.ts`
- `jetlinks-web-core/src/router/globModules.ts`

Module conventions currently used by the shell:

| Contract | Owner | Purpose |
| --- | --- | --- |
| `modules/<module>/index.ts` | business module | Exports route maps, extra routes, optional config, register hook, priority, and other module-level hooks. |
| `modules/<module>/register.ts` | business module | Exports resources registered into `moduleRegistry`, such as `apis`, `components`, `hooks`, `stores`, or `utils`. |
| `modules/<module>/baseMenu.ts` | business module | Menu entry consumed by `getModulesMenu()`. In current modules it commonly imports `baseMenu.json` and enriches menu options. |
| `modules/<module>/baseMenu.json` | business module | Data source for menu metadata where the module uses a `baseMenu.ts` wrapper. |
| `views/**/index.vue` | core or module | Page component convention used by `import.meta.glob`. |

Important details:

- `getSortModules()` eagerly scans `../../../modules/*/index.ts` and sorts by `default.priority`.
- A module is skipped when it has no default export or `default.filter === true`.
- `getModulesMenu()` scans `../../../modules/*/baseMenu.ts` and resolves each default export as a function, array, or single menu object.
- `registerModule()` calls each active module's `default.register?.()`.

## Routing And Menus

Core route entry points:

- `jetlinks-web-core/src/router/index.ts`
- `jetlinks-web-core/src/router/basic.ts`
- `jetlinks-web-core/src/router/coreRoutes.ts`
- `jetlinks-web-core/src/router/globModules.ts`
- `jetlinks-web-core/src/router/startup.ts`
- `jetlinks-web-core/src/router/MODULE_OVERRIDE_GUIDE.md`

Route responsibilities:

- Core pages are registered from `router/basic.ts` and resolved by `resolveCoreRoutes()`.
- Core route overrides are collected from modules with `getCoreRouteOverrides()`.
- Core and module page components are mapped through `getAsyncRoutesMap()`.
- Hidden/detail pages should be exposed through module `getExtraRoutesMap()`.
- Menu routes are fetched and installed during router startup through `bootstrapSession()` and `ensureMenuRoutes()`.
- Route security is expressed with `RouteSecurityLevel.PUBLIC`, `RouteSecurityLevel.AUTHENTICATED`, and `RouteSecurityLevel.AUTHORIZED`.

Use `jetlinks-web-core/src/router/MODULE_OVERRIDE_GUIDE.md` for the current route override contract.

## Module Resource Registry

The module resource registry lives in:

- `jetlinks-web-core/src/utils/module-registry.ts`

Common usage:

```ts
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'

moduleRegistry.register(moduleName, registerSetting)
const apis = moduleRegistry.getResource('some-module-ui', 'apis')
const Component = moduleRegistry.getResourceItem('some-module-ui', 'components', 'SomeComponent')
```

The registry stores cross-module resources by module id. It also exposes remote module/component loading helpers backed by `@jetlinks-web/vite/dist/dynamic-remote`.

Public contract typing for this registry is handled by the separate module-contract task. Until that is complete, keep docs aligned with the actual `module-registry.ts` API and do not invent resource keys.

## Component Registration And Extension Points

Global component registration:

- `jetlinks-web-core/src/components/index.ts`

Runtime extension registration:

- `jetlinks-web-core/src/utils/components-registry.ts`
- `jetlinks-web-core/src/components/RegisterComponents/index.ts`
- `jetlinks-web-core/docs/组件注册.md`

The shell globally installs common components such as `CloudEmpty`, `ConditionFilter`, `QuickFilterSidebar`, `RegistryComponent`, `SectionCard`, `JlDrawerShell`, `InputEditable`, and related shared UI building blocks.

Use `componentsRegistry.register(action)` or module `getRegisterComponents()` only for stable extension points already rendered by `RegistryComponent`. Extension actions describe where a component should be inserted, replaced, hidden, or appended; they should not hide business orchestration inside the registry definition.

## Store Boundary

Store entry:

- `jetlinks-web-core/src/store/index.ts`

The shell creates the Pinia instance and re-exports core stores such as auth, user, menu, system, application, ai, and route-loading. Module-specific state should stay in the owning module unless at least two modules need a stable shared contract.

## Theme And Style Tokens

Theme and style entry points:

- `jetlinks-web-core/src/style.css`
- `jetlinks-web-core/src/utils/theme-config.ts`
- `jetlinks-web-core/src/utils/theme-style.ts`
- `jetlinks-web-core/src/hooks/useResponsiveAntdToken.ts`
- `jetlinks-web-core/src/App.vue`

Prefer existing Ant Design Vue tokens, `--jet-theme-*`, `--space-*`, and `--fs-*` variables before introducing local design values. Runtime theme updates are applied through `ConfigProvider.config()` and `applyThemeStyle()`.

## Micro-App And Federation Boundary

Micro-app and remote loading entry points:

- `jetlinks-web-core/src/main.ts`
- `jetlinks-web-core/src/package.ts`
- `jetlinks-web-core/src/utils/module-registry.ts`

`loadMicroApp()` exposes base app APIs to sub-apps, including `moduleRegistry`, tab save callbacks, and `routerFallback`. Remote module/component loading is available through `moduleRegistry.loadRemoteModule()` and `moduleRegistry.loadRemoteComponent()`.

Changes in this area must preserve parent/sub-app token propagation, module registry sharing, and router fallback behavior.

## Verification Entry Points

Common commands are defined in `package.json` and `jetlinks-web-core/package.json`:

```shell
pnpm dev
pnpm dev:proxy localhost:8844
pnpm build
pnpm test
pnpm -F jetlinks-web-core build -- --module-name <module-name>
```

For documentation-only changes, prefer link and fact checks. For contract or runtime changes, run the narrowest relevant build first, then the full build when feasible.
