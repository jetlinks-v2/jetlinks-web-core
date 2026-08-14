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
- `src/store/menu.ts#queryMenus()` accepts the legacy application scope argument and an optional `{ applicationScope, conditions }` object. After `/menu/user-own/tree` returns and before route generation, the store applies module `getMenuFilters()` hooks with that context.
- Server menu trees are normalized in `src/utils/menu.ts#handleMenus()` before sidebar and route generation; sibling nodes with the same `code` share one route node and recursively merge their children.
- Route security is expressed with `RouteSecurityLevel.PUBLIC`, `RouteSecurityLevel.AUTHENTICATED`, and `RouteSecurityLevel.AUTHORIZED`.
- Routes may provide `routeLoadingComponent` for a custom navigation loading state. `routeLoadingOverlay` keeps the target route mounted behind that state, and `routeLoadingManualFinish` keeps it visible after `afterEach` until the owning page calls `useRouteLoadingStore().finish()`; both options are opt-in and leave ordinary route skeleton behavior unchanged.

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

## Data Capability Registry

The proposed neutral contract for module-owned data sources, side-effecting operations, structured value bindings, subscription lifecycle, composition, and legacy visualization-command compatibility is documented in:

- `jetlinks-web-core/docs/数据能力注册中心设计.md`

The design keeps discovery in `DataCapabilityRegistry`, read/query/stream execution in `DataSourceRunner`, and side-effecting execution in `OperationRunner`. It is a design contract pending confirmation and implementation; the current production path continues to use the existing visualization command APIs and persisted `bindCommands`.

## Component Registration And Extension Points

Global component registration:

- `jetlinks-web-core/src/components/index.ts`

Runtime extension registration:

- `jetlinks-web-core/src/utils/components-registry.ts`
- `jetlinks-web-core/src/components/RegisterComponents/index.ts`
- `jetlinks-web-core/docs/组件注册.md`

The shell globally installs common components such as `CloudEmpty`, `ConditionFilter`, `QuickFilterSidebar`, `RegistryComponent`, `SectionCard`, `JlDrawerShell`, `InputEditable`, and related shared UI building blocks.

Use `componentsRegistry.register(action)` or module `getRegisterComponents()` only for stable extension points already rendered by `RegistryComponent`. Extension actions describe where a component should be inserted, replaced, hidden, or appended; they should not hide business orchestration inside the registry definition.

### 待确认：SaaS 跨模块公共能力迁移

状态：已完成（2026-08-03）。

- 目标：将被非 `saas-manager-ui` 模块引用、且不携带 SaaS 业务语义的 UI 组件与通用 hooks 上移至 core；业务 API 即使存在跨模块调用，也继续留在 owning module。
- 影响范围：`jetlinks-web-core`、`saas-manager-ui` 及其 11 个消费模块（告警、边缘网关、巡检、物联、空间、通知、流量分析、系统设置、可视化、视联、视觉模型）；不修改 `runtime-ui`，不改变路由、菜单、权限或后端接口语义。
- 已迁移入口：`PageHeader`（原 45 处引用）、`DetailHeader`、`MetricCards`、`MarketplaceInstallStream`、`StatusPill`、`useProjectSecondaryMenu` 及 `useProjectNavigation`；组件源码位于 `src/components/`，当前项目导航契约由 `src/layout/hooks/` 统一维护。
- 文件路径：组件实现为 `src/components/PageHeader/index.vue`、`DetailHeader/index.vue`、`MetricCards/index.vue`（类型：`MetricCards/types.ts`）、`MarketplaceInstallStream/index.vue`（类型：`MarketplaceInstallStream/types.ts`）、`StatusPill/index.vue`；深层默认导入入口为同级 `PageHeader.ts`、`MetricCards.ts`、`MarketplaceInstallStream.ts`、`StatusPill.ts`。导航 hooks 为 `src/layout/hooks/useProjectNavigation.ts`、`src/layout/hooks/useProjectSecondaryMenu.ts`。确定处于项目布局的页面使用严格的 `useProjectSecondaryMenu`；同时支持普通布局、项目布局或多应用挂载的页面使用 `useOptionalProjectSecondaryMenu`，缺少 provider 时保留页内导航，不得按具体菜单或路由兜底。
- 实施结果：`StickyActionBar` 的唯一外部消费者已直接改用 core 同名组件；SaaS 的 `components/index.ts` 对已迁移组件保留 re-export。项目创建弹窗保留在 SaaS 业务域，通过 `saas-manager-ui/register.ts` 注册为 `ProjectCreateDialog`，边缘网关经 `moduleRegistry` 获取，core 不反向导入 SaaS 私有项目、地区或客户资料实现。
- 国际化：安装日志与状态胶囊的用户可见文案迁入 `jetlinks-web-core/src/locales/lang/{zh,en}.json`，不再依赖 SaaS locale 键。
- 业务 API 排除：`saas-manager-ui/api/device-asset-firmware.ts` 属于设备资产固件业务域，保留在 SaaS；边缘网关对其的既有调用不纳入 core 迁移范围。
- 项目通用智能体装配：菜单状态由 `src/store/menu.ts` 的 `useMenuStore` 统一提供，runtime factory 由 `src/layout/components/AiChat/projectGeneralAgentRuntime.ts` 统一提供。业务模块可直接消费这两个 core 契约，不得再要求 `saas-manager-ui` 注册无 SaaS 业务语义的 store 或 runtime factory；部署缺失与客户端 runtime 装配失败必须保持独立错误语义。
- 启动依赖边界：模块扫描由 `src/main.ts` 在 `package.ts` 初始化完成后、Axios 与 Vue 应用初始化前调用 `registerModule()`；`package.ts` 不再顶层调用它，避免扫描到模块入口后回引 package 时发生循环初始化。
- 验证结果：已迁移组件与 hooks 的非 SaaS 消费者均不再引用 `@saas-manager-ui/`；core 源码中反向 SaaS 引用扫描为 0；中英文 JSON 可解析，相关子模块 `git diff --check` 通过。启动循环已通过调整模块注册时机与直达导入切断；`pnpm -F jetlinks-web-core build` 已完成 Vite transforming 阶段，未再出现 `registerModule` 初始化错误，但本环境未返回最终退出结果。`pnpm exec vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json` 仍受大量既有全仓库类型错误阻塞，但迁移文件名过滤结果为 0。

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

## AI Client Capability Runtime

The shared AI capability runtime is owned by src/layout/components/AiChat/. Business modules register tools through the shared registry; home and project-general runtimes may install different route capability loaders, but discovery instructions must derive the active loader id from the serialized catalog rather than hard-code a route or tool name.

Semantic catalog updates are published only after the current response reaches its authoritative terminal boundary. Registry revision, active-turn deferral and reconnect refresh are runtime responsibilities; business tools must not depend on WebSocket/session fields.

### Stable Authoring Contract

Business modules declare only stable business facts:

~~~ts
defineClientTool({
  id,
  description,
  inputs,
  consumes,
  effect,
  output,
  execute,
})
~~~

- inputs contains caller-owned business values and a closed schema.
- consumes is the canonical consumer-port surface and contains name/type/mediaType/shape/required/sourcePolicy. New and
  modified business tools must use this complete descriptor.
- output is the producer-owned typed preset. Current producer descriptors already own stable name, shape, media type, field semantics, selector and delivery metadata.
- effect is READ, WRITE or EXTERNAL_ACTION plus business idempotency/reversibility facts.
- execute returns typed success/partial/failure and business facts.

Business modules must not assemble FLAT/HYBRID stages, evidence policy, physical paths, runtime resource ids, retry prompts, workflow edges or provider-specific schema. Low-level routing, binding, evidence, delivery and session projection helpers remain internal.

The current operations and runtime frontends share the same `jetlinks-web-core` commit, but each workspace owns different business modules. The inventory therefore treats shared copies as one family and treats iframe-provided rule-editor definitions as a dynamic family rather than pretending they are static TypeScript literals.

| Family | Current examples | Current authoring profile | Migration target |
| --- | --- | --- | --- |
| Shared bootstrap and discovery | `home_agent_get_context`, `home_agent_search_capabilities`, `home_agent_open_menu`, route capability loader, workflow guide | A small typed core plus manually assembled discovery metadata | First adopter of `lookup` and controlled-navigation presets; proves catalog revision and FLAT exposure behavior |
| General alarm analysis | `alarm_search_vision_scenes`, overview, record, trend, rank, detail, noise, and open-record tools | Manual routing maps, output-shape arrays, JSONPath bindings, and duplicated metadata | `lookup`, `recordSet`, `aggregateSeries`, `detail`, and controlled-navigation presets |
| General vision and video | `visual_search_*`, `video_get_resource_overview`, `video_channel_*`, recording, health, and open-channel tools | Manual routing/binding plus conditional multi-output and file-backed presentation results | `recordSet`/`artifact` selectors with canonical presentation delivery; navigation remains an external action |
| General IoT device analysis | device search, state summary, online/message trends, model, latest/history/aggregate properties, health, and open-detail tools | Manual routing/binding; mixes inline aggregates, file record streams, discovery resources, and navigation | Representative coverage for lookup, detail, aggregate, record-stream, and navigation outputs |
| General big-screen generation | template search, project-scenario recommendation, and recommendation finalization | Routed legacy tools with custom result carrying | Typed lookup/artifact outputs; no editor-write semantics in this read/recommendation family |
| Home/project device and alarm capabilities | device domain/model/property tools, instance/product search, device dashboard metrics, alarm dashboard queries, and rule-draft creation | Mostly legacy definitions using inputs/output/annotations without a canonical producer contract | Read families migrate by output preset; rule-draft creation uses a write receipt and explicit confirmation effect |
| Device detail and edge diagnostics | selector, metadata, properties, logs, documents, alarms, events, access, trace, function invocation, edge runtime/MBean/master/persistence/file/log/thread tools | More than thirty page-local tools, largely without routing or typed outputs; includes large records, local files, long-running diagnostics, and writes | Migrate in subfamilies after record streaming and result normalization are stable; function invocation is a WRITE effect |
| Big-screen editor | target/manual inspection, selected/page property edit, replacement, ECharts read/generate/update, data diagnose/bind, template binding execute/status, and camera binding | Separate editor contracts wrapped into client tools; risk, confirmation, version references, and partial status are repeated across layers | Explicit editor adapter strategies over the same public facade; write receipt carries version, completion, and compensation facts |
| Rule editor | iframe-provided remote definitions plus typed handling for `rule_editor_apply_canvas_actions` | Dynamic remote schema and transport adapter; multi-step canvas action can be partial, rolled back, or presentation-producing | Remote-definition adapter plus a typed canvas-action result strategy; catalog refreshes when the iframe definition revision changes |

Inventory entry points:

- Shared runtime and registries: `ui/jetlinks-web-core/src/layout/components/AiChat/`.
- Operations general-agent tools: `ui/modules/alarm-ui/agentCapabilities/`, `ui/modules/iot-ui/agentCapabilities/`, `ui/modules/jetlinks-media-ui/agentCapabilities/`, `ui/modules/jetlinks-ai-ui/agentCapabilities/`, and `ui/modules/visualization-manager-ui/agentCapabilities/`.
- Home and device-detail tools: `ui/modules/device-manager-ui/views/device/` and `runtime-ui/modules/device-manager-ui/views/device/`.
- Conversation transport/session refresh: `ui/modules/jetlinks-ai-agent-ui/components/AgentConversation/`.
- Runtime rule and alarm tools: `runtime-ui/modules/rule-engine-manager-ui/views/`.
- Remote rule-editor definitions: `modules/rule-engine-manager/src/main/resources/static/rule-editor/ai-agent-bridge.js`, consumed by `runtime-ui/modules/rule-engine-manager-ui/views/Instance/RuleEditor/toolRuntime.ts`.

This inventory currently contains four compatibility classes:

1. **Typed core**: producer contract exists and the runtime derives routing and bindings.
2. **Routed legacy**: routing and result bindings exist, but business modules assemble them independently.
3. **Plain legacy**: executable definitions depend mainly on input/output/annotations and have no canonical output contract.
4. **Remote/editor adapted**: the business definition originates in another runtime or has write-specific state/version semantics.

The migration must report these classes separately. A malformed legacy tool must not hide valid siblings, while a new typed tool must fail registration when its stable contract is invalid.

### Stable Facade And Internal Adapters

The public facade is stable because backend- and model-specific concepts terminate at versioned internal adapters:

| Layer | Owns | Must not own |
| --- | --- | --- |
| Business definition | id, description, inputs, typed ports, effect, execution | routing mode, physical refs, binding/evidence wire |
| Definition compiler | closed parameter schema, routing/catalog/session projection | business query logic or tool-id branches |
| Result adapter | selectors, materialization, binding, completeness, range, evidence | re-execution or inference from arbitrary result keys |
| Execution policy | confirmation, cancellation, idempotency, compensation | resource identity or output shape |
| Registry/runtime | scoped registration, revision, deferral, reconnect | duplicated business definitions |
| Transport adapter | negotiated frontend/backend wire projection | public authoring fields |

Output presets include lookup/detail, recordSet, aggregateSeries, artifact and stateChange. Exceptional lifecycles use named adapter strategies such as record streaming, controlled navigation, editor mutation, remote definition or canvas transaction; they are not expressed through an open extension bag.

### Static Ports And Runtime Facts

The cross-layer canonical contract is defined by modules/jetlinks-ai-agent/docs/help/general-agent-tool-definition-spec.md:

~~~text
ProducerPort = name + type + mediaType + shape
ConsumerPort = name + type + mediaType + shape + required + sourcePolicy
RuntimeBinding/Evidence = port identity + execution path/ref, range, count, completeness and claims
~~~

The definition compiler projects static ports to the current session wire. The result adapter derives execution facts from the typed result. Business code does not repeat output names, binding paths, completeness wire or evidence envelopes.

Current compatibility classes:

1. Typed core: producer contract exists and routing/binding are derived.
2. Released name-only consumer: the centralized definition adapter preserves only accepts/prerequisites discovery
   metadata while the opposite producer side may migrate independently; it never invents type/mediaType/shape or grants
   typed resource authority.
3. Routed legacy: routing and result bindings are assembled independently.
4. Plain legacy: executable definition has no canonical output contract.
5. Remote/editor adapted: another runtime owns the definition or write lifecycle.

Malformed legacy tools must not block valid siblings. New or modified typed tools fail registration when their stable contract is invalid. Legacy tools remain executable but receive only the typed capabilities that can be proven.

### Presentation And Renderer Boundary

aggregateSeries remains renderer-neutral. The browser retains the original binding, declared field semantics, producer-guaranteed ordering, range and completeness; it never derives or repairs ECharts options.

The backend canonical presentation compiler is the single decision and materialization boundary for application/vnd.echarts+json. It may derive a presentation only from a complete, verified and unambiguous structured source plus the current session renderer capability. Preview, restored history and document export consume the same canonical source.

Renderer capability is session-scoped:

- mediaType/preferredInputShapes is a consumer compatibility declaration;
- supportsSessionFile/maxInlineBytes/defaultMode is transport capability;
- deliveryPolicy/narrativePolicy is UX policy.

These are not business-tool fields and do not grant permission or create presentation obligations by themselves.

### Registry, Versioning And Compatibility

defineClientTool is the stable authoring facade. An internal compiler version projects it to session-init and client.tools.call. Backend routing, provider, result-ledger or transport changes update the compiler/adapter rather than every business definition.

The current defineAiClientToolContract, routing, binding, evidence and delivery helpers are internal building blocks. New
business modules must not import them directly. Released name-only consumers are accepted only by the centralized
definition adapter and projected to flat accepts/prerequisites; canonical and legacy descriptors must not be mixed in one
consumer declaration. Business modules must not copy this adapter. Producer and consumer migration may proceed one side
at a time, but a legacy side remains legacy until its complete descriptor is authored. New parallel runtimes or a second
wire protocol are forbidden.

Operations and runtime workspaces consume the same jetlinks-web-core commit and update their submodule pointers independently. AiChat implementation is never copied between ui and runtime-ui.

### Implementation Entry Points

- clientToolApi.ts: public authoring facade.
- clientToolDefinition.ts: input, consumer, effect, output and result compilation.
- clientToolContract.ts: producer contract and routing/binding metadata projection.
- clientToolResult.ts and clientToolResultDelivery.ts: typed result normalization and materialization.
- clientToolCatalog.ts: catalog audit and legacy diagnostics.
- clientToolRegistry.ts and clientToolSnapshot.ts: registration, revision, active-turn deferral and disposal.
- clientTools.ts: runtime assembly and dynamic snapshot access.
- generalAgentExtensions.ts: bounded session renderer capability types.

The former clientToolAggregatePresentation.ts browser write path is deleted. Canonical presentation is backend-owned.

### Canonical Port Status

- Canonical `ClientToolConsumedResource` exposes name/type/mediaType/shape/required/sourcePolicy; the released name-only
  form is a read-compatible migration input owned by clientToolDefinition.ts, not a new authoring option.
- `ai-tool-port/v1` consumer/producer ports are the canonical routing envelope.
- accepts/prerequisites/produces/outputShapes are compiler-owned legacy projections; authored drift fails catalog audit.
- Multi-output producer descriptors remain intact through routing and output binding generation.
- Remaining migration is limited to reducing routed/plain legacy callers through the centralized adapter, without route-, tool- or scenario-specific branches.

Conditional input alternatives remain compiled by clientToolDefinition.ts. Every branch must declare its referenced properties and validate required, discriminator and forbidden names against the root input definition; the backend ToolContractAudit remains fail closed.

### Verification Gates

- pnpm run test:client-tools
- pnpm run test:client-tool-types
- pnpm -F jetlinks-web-core build -- --module-name <module-name>
- registry tests for register/unregister, revision, active-turn deferral and reconnect;
- result tests for empty, multi-output, large materialized, partial, cancellation, permission, compensation and unknown effect;
- catalog tests proving one malformed legacy tool does not block valid siblings;
- anonymous cross-domain fixtures proving no tool-id, page, provider, field-name or prompt special cases.

For documentation-only changes, use link/fact checks and git diff --check. For runtime changes, run the narrowest owning-module checks first, then the affected workspace builds.
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
