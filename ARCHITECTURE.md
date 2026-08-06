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
- 已迁移入口：`PageHeader`（原 45 处引用）、`DetailHeader`、`MetricCards`、`MarketplaceInstallStream`、`StatusPill`、`useProjectSecondaryMenu` 及 `useProjectNavigation`；它们的源码位于 `src/components/` 或 `src/hooks/`，并由 core 的公开入口导出。
- 文件路径：组件实现为 `src/components/PageHeader/index.vue`、`DetailHeader/index.vue`、`MetricCards/index.vue`（类型：`MetricCards/types.ts`）、`MarketplaceInstallStream/index.vue`（类型：`MarketplaceInstallStream/types.ts`）、`StatusPill/index.vue`；深层默认导入入口为同级 `PageHeader.ts`、`MetricCards.ts`、`MarketplaceInstallStream.ts`、`StatusPill.ts`。导航 hooks 为 `src/hooks/useProjectNavigation.ts`、`src/hooks/useProjectSecondaryMenu.ts`，统一从 `src/hooks/index.ts` 导出；具名组件与类型从 `src/components/index.ts` 导出。
- 实施结果：`StickyActionBar` 的唯一外部消费者已直接改用 core 同名组件；SaaS 的 `components/index.ts` 对已迁移组件保留 re-export。项目创建弹窗保留在 SaaS 业务域，通过 `saas-manager-ui/register.ts` 注册为 `ProjectCreateDialog`，边缘网关经 `moduleRegistry` 获取，core 不反向导入 SaaS 私有项目、地区或客户资料实现。
- 国际化：安装日志与状态胶囊的用户可见文案迁入 `jetlinks-web-core/src/locales/lang/{zh,en}.json`，不再依赖 SaaS locale 键。
- 业务 API 排除：`saas-manager-ui/api/device-asset-firmware.ts` 属于设备资产固件业务域，保留在 SaaS；边缘网关对其的既有调用不纳入 core 迁移范围。
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

The shared AI capability runtime is owned by `jetlinks-web-core/src/layout/components/AiChat/`. Home and project-general runtimes reuse the same provider and client-tool assembly code, but they may install different route capability loader tools. Model-facing discovery instructions must therefore derive the loader id from the actual serialized client-tool catalog (`client-capability.load`) built for that runtime; they must not hard-code a home or general loader name. A semantic catalog update is applied by `modules/jetlinks-ai-agent-ui` only after the current response reaches its authoritative terminal boundary, so loading a route extension cannot detach the client-tool websocket in the middle of the same turn.

This contract is runtime-generic: business modules register capabilities and tools through the existing registries, and neither the core prompt nor the conversation transport selects behavior from a user phrase, route-specific keyword, or tool-name prefix. Ordinary `records` query tools remain `auto`-exposed in FLAT mode; capability search, route-provider loading, workflow guidance, artifact creation, and side-effect actions opt into `deferred` exposure explicitly. This keeps real business queries available to weak models without letting discovery helpers crowd them out. Verification covers home/general loader resolution, FLAT exposure defaults, init-contract deferral across intermediate assistant/tool epochs, and the affected module builds.

### Client Tool Authoring Target

Business modules should define only stable business facts: tool identity and usage boundary, caller-owned input schema, logical consumed resources, typed produced outputs, effect semantics, and the execute function. They must not assemble workflow stages, data-access modes, output-shape arrays, delivery arrays, evidence policy, result JSONPath maps, physical resource references, retry instructions, or FLAT/HYBRID selection hints. These runtime-facing values are compiled from one typed definition by the shared adapter while the current session-init and `client.tools.call` wire contracts remain unchanged.

The stable public facade will provide a minimal `defineClientTool` entry, typed logical resource ports, output presets such as record set, aggregate series, artifact, and state change, plus typed success/partial/failure results. Output identity, shape, media type, field semantics, selection, delivery, binding, and evidence must have one producer-owned source. Business execution may report completeness, coverage, and domain facts, but must not restate output slot names or binding paths. Common defaults derive routing, risk annotations, inline/file policy, and catalog metadata from output kind and `READ`/`WRITE`/`EXTERNAL_ACTION` effect; exceptional behavior uses an explicit adapter strategy instead of an open-ended options map.

Low-level helpers such as routing assembly, result binding, evidence attachment, delivery orchestration, and session projection remain internal adapter/runtime APIs. Existing released callers may continue through a compatibility adapter, but new or modified typed tools must use the stable facade. The compatibility boundary must be confirmed before implementation: unreleased in-branch callers are migrated directly, while released or externally consumed APIs receive a documented deprecation window. The public facade must not expose `[key: string]: any` extension bags.

The intended authoring surface is deliberately smaller than either the current browser definition or the backend wire definition:

```ts
defineClientTool({
  id,
  description,
  inputs,
  consumes,
  effect,
  output,
  execute,
})
```

`inputs` describes values the caller supplies. `consumes` describes only typed logical resources supplied by authoritative page context or a preceding tool; an input such as `deviceId` must not automatically become a logical resource dependency. `output` is a typed preset with an owning selector, so one declaration produces the logical output id, result shape, field semantics, delivery strategy, binding, and evidence metadata. `effect` is a closed discriminated contract for `READ`, `WRITE`, or `EXTERNAL_ACTION`, including only business facts such as idempotency, reversibility, and whether local confirmation is required. Optional localized display text remains a UI concern and does not change routing or execution semantics.

### Current Client Tool Inventory

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
| Business definition | id, description, caller inputs, logical consumed resources, effect facts, output preset/selectors, execution | FLAT/HYBRID, stages, evidence policy, JSONPath, physical files, websocket/session fields |
| Definition compiler | current routing metadata, risk annotations, closed parameter schema, catalog metadata, session projection | Business query implementation or route/tool-id special cases |
| Result adapter | selector evaluation, canonical success/partial/failure envelope, delivery/materialization, output bindings, evidence | Re-execution, domain inference from arbitrary result field names, or false completion |
| Execution policy | local confirmation, cancellation, effect/idempotency handling, compensation status | Output shape or resource identity |
| Registry/runtime | scoped registration, snapshot, revision, subscribe/unregister, active-turn deferral, reconnect refresh | Duplicated business tool definitions |
| Transport adapter | projection to the currently negotiated frontend/backend wire version | Public authoring fields or business-module imports |

The first public output presets are:

- `lookup` / `detail`: one bounded object, schema, capability, or resolved subject.
- `recordSet`: bounded inline records with automatic record-stream/session-file materialization above the shared limit.
- `aggregateSeries`: summaries, metrics, trends, rankings, and their field semantics.
- `artifact`: a renderer-neutral resource with a declared media type; presentation is negotiated by runtime capabilities, not guessed from a filename.
- `stateChange`: navigation receipts and write/action receipts, including truthful completion, version, rollback, and compensation facts.

`aggregateSeries` remains renderer-neutral at the business boundary. The compiler may derive one optional
`application/vnd.echarts+json` presentation artifact only when the tool declares exactly one category/timestamp field,
one to eight numeric fields, one unambiguous aggregate output, and returns a complete flat record array. The adapter
uses only those declared field names: category labels are preserved exactly, timestamp values remain unchanged and use
the ECharts time axis, and no model-authored timestamp or copied record set participates. Dynamic/nested measures,
multiple aggregate outputs, incomplete data, unsafe values, and oversized sources fail closed to the original aggregate
binding. The original renderer-neutral output is always retained for analysis and follow-up tools.

Presets may have optional selectors for conditional outputs. The result adapter evaluates each selector once. An absent optional selection omits that output; selector failure is a tool failure or partial result according to the declared strategy, never an invitation to call the business operation again. Physical file paths and session resource ids remain runtime values and never enter the business definition.

Exceptional behavior is selected from closed adapter strategies such as record streaming, controlled navigation, editor mutation, remote definition, or canvas transaction. It is not expressed through a growing optional-property bag. A new strategy is justified only when at least two tools share a lifecycle or when an existing business contract cannot be represented truthfully by the standard presets.

### Versioning And Compatibility Boundary

`defineClientTool` is the versioned authoring contract. A separate internal compiler version projects it to the current session-init and `client.tools.call` wire. A backend metadata, routing, provider, FLAT/HYBRID, or result-ledger change therefore updates the compiler/transport adapter and its snapshots, not every business definition. Capability negotiation chooses the compiler projection when multiple backend wire versions must coexist.

The existing `defineAiClientToolContract`, `defineAiClientToolRouting`, `defineAiClientToolResultBindings`, evidence helpers, delivery helpers, and raw `AiClientToolDefinition` remain internal building blocks. Their public compatibility treatment depends on a release fact that must be confirmed before implementation:

- If they have not been released or consumed outside this repository, migrate all in-branch callers and do not retain aliases for intermediate APIs.
- If they are already released or externally imported, provide one legacy adapter, a bounded deprecation window, diagnostics, and a migration guide; do not maintain two independent runtimes.

Package exports and repository linting must prevent new business-module imports from internal routing, binding, evidence, delivery, session-wire, or transport modules. A generated catalog inventory becomes the migration allowlist and must decrease monotonically until the legacy boundary can be removed.

### Client Tool Runtime Optimization Plan

Owning scope:

- `jetlinks-web-core/src/layout/components/AiChat/`: stable definition/output/result facade, definition and result adapters, delivery strategies, catalog audit, registry lifecycle, and legacy adapter.
- Owning business modules: migration of representative vision, alarm, device, and rule-editor tools after the core facade is stable.
- `modules/jetlinks-ai-agent-ui/components/AgentConversation/`: session snapshot refresh only where required to consume registry revisions; it must not duplicate tool contract logic.
- The operations and runtime frontends consume the same merged `jetlinks-web-core` commit by updating their submodule references; the `AiChat` implementation is never copied between the two workspaces.

Non-goals:

- No second client-tool wire protocol and no backend runner/resource-table changes.
- No model-, provider-, route-, prompt-, tool-id-, or evaluation-case-specific branches.
- No automatic inference of business resource semantics from parameter names or result field names.
- No big-bang migration of all legacy tools before the typed facade and compatibility policy are verified.
- No visual/page-shell changes.

Implementation waves:

1. **Wave 0 — contract and inventory gate.** Freeze the public types with positive/negative compile fixtures; generate the typed/routed-legacy/plain-legacy/remote inventory; reserve runtime-owned parameter and metadata names; decide the released compatibility boundary.
2. **Wave 1 — compiler, result adapter, and registry.** Implement the definition compiler, canonical result adapter, output presets, effect policy, current-wire transport adapter, and lifecycle-aware registry. Split the existing monolith by responsibility while retaining one small compatibility export facade. No broad business migration occurs in this wave.
3. **Wave 2 — bootstrap and simple reads.** Migrate home/bootstrap tools and the alarm overview/detail/records/aggregate family. This proves FLAT discovery/exposure defaults, logical resource handling, inline bindings, controlled navigation, registry revision, and reconnect behavior with low-complexity tools.
4. **Wave 3 — multi-output and materialized reads.** Migrate visual search/video, general IoT analysis, and big-screen template recommendation. Prove conditional outputs, renderer-neutral artifacts, large record streaming, aggregate field semantics, navigation, and partial delivery without duplicate execution.
5. **Wave 4 — home and page-local tools.** Migrate device domain, instance/product/dashboard, alarm dashboard, then device-detail tools in bounded subfamilies: metadata/properties; records/alarms/events; documents/files; edge diagnostics; trace and function invocation. Delete duplicate local routing/result helpers only after each subfamily passes its contract snapshots.
6. **Wave 5 — editor mutations.** Migrate big-screen editor tools using explicit editor strategies for confirmation, resource versioning, idempotency, partial completion, rollback, and compensation. Read and write tools still share the same facade; strategy code remains internal.
7. **Wave 6 — rule-editor remote boundary.** Normalize iframe definitions through one remote adapter, subscribe to definition revisions, and map canvas transactional results through the typed state-change/artifact strategy. Preserve remote business schemas and do not copy backend/iframe routing fields into page modules.
8. **Wave 7 — enforcement and dual-workspace rollout.** Remove or deprecate legacy exports according to the confirmed release boundary; make the import/catalog gates blocking; publish one shared core commit; update `ui` and `runtime-ui` submodule pointers independently; run both workspace builds without copying implementation.

Risks and rollout controls:

- Catalog changes during an active turn can detach or invalidate the executing socket. Registry revisions are published only at the authoritative terminal boundary; reconnect always serializes a fresh authorized snapshot.
- A generic result adapter can accidentally convert partial work into success. Completion, rollback, compensation, truncation, coverage, and delivery failure remain explicit canonical facts and are covered by negative tests.
- Write tools can be duplicated by retry or selector failure. Selectors never execute business work, and effect/idempotency policy prevents blind replay after an uncertain write.
- Dynamic iframe tools can drift from the page snapshot. The remote adapter keys definitions by source revision and unregisters the previous scope atomically.
- Operations and runtime workspaces can drift even while sharing the core repository. Each migration wave lands in the shared core first, then each owning workspace updates only its business tools and submodule pointer.
- An over-general facade can recreate the current optional-field problem. Public unions remain closed; exceptional lifecycles require a named internal strategy and representative cross-tool tests.

Verification gates:

- Type tests prove a standard tool can be defined from ID, description, inputs, logical resources, effect, output preset, and execute only; runtime-owned fields and open extension bags are rejected.
- Contract snapshots prove the compiled session definition remains wire-compatible and routing, produced slots, shapes, delivery, binding, and evidence originate from the same output descriptor.
- Result tests cover small inline data, empty output, multiple and conditional outputs, 10,000-record streaming, session-file fallback, artifact delivery, partial coverage, cancellation, dependency failure, permission failure, compensation, and unknown effect without duplicate execution.
- Registry tests cover register/unregister, late capability loading, monotonic revision, active-turn deferral, WebSocket reconnect, and restored-session tool availability.
- Representative business tests cover alarm, visual search, device aggregate, and rule-editor flows without scenario-specific branches.
- Catalog reports keep one malformed legacy tool from blocking siblings while enforcing the typed-tool gate.
- Run core unit/type checks and the narrow owning-module builds first, then the operations and runtime frontend builds after both consume the same core commit.

Completion criteria:

- A new ordinary business tool imports no routing, binding, evidence, delivery, or session-wire helper.
- Each logical output slot is declared exactly once and business code contains no resource-propagation JSONPath.
- Adding a standard tool does not modify the runtime, catalog auditor, conversation transport, or backend runner.
- Reconnect and dynamic capability loading publish the latest authorized catalog without interrupting an active turn.
- Existing representative completion and artifact-delivery behavior does not regress, and definition size/duplicate metadata decrease measurably.

### Dual-Workspace Delivery And Scenario Verification Plan

Goal: finish the current client-tool rollout through the existing PRs, make the operations and runtime workspaces
consume the same shared commits, and verify enterprise-query and rule-editor workflows without prompt-, tool-id-, or
evaluation-question-specific branches.

Owning repositories and delivery order:

1. jetlinks-web-core owns the stable facade, compiler, aggregate presentation adapter, catalog/registry lifecycle,
   reconnect behavior, and shared contract tests. It is committed and reviewed once.
2. jetlinks-ai-agent-ui owns canonical conversation/presentation rendering and terminal-state interaction. It is
   committed and reviewed once.
3. Business repositories own only their definitions and lifecycle integration. The rule editor keeps its iframe
   remote-definition adapter in rule-engine-manager-ui.
4. cloud.jetlinks.ui updates its business definitions, focused tests, and shared submodule references.
5. saas-runtime-ui updates the same shared references plus runtime-only adapters; it must not copy AiChat source.

Non-goals:

- Do not submit unrelated dirty submodules, browser snapshots, build artifacts, or workspace configuration.
- Do not change backend tool-wire semantics during this frontend rollout.
- Do not special-case phrases such as latest person, 24-hour online rate, HTTP, or Kafka.
- Do not save or publish a rule-engine canvas during verification unless separately authorized.

Implementation and PR steps:

1. Attribute every dirty file to an owning repository or unrelated user work and stage only attributed paths.
2. Run one stage-level verification batch, then update the already-open shared-repository PRs.
3. Update both parent gitlinks to the exact same shared commit ids and push the two parent PRs independently.
4. Run the scenario matrix against the restarted local services and record tool calls, results, reconnect, rendering,
   and canvas state rather than judging only final prose.
5. Fix any defect in its owning semantic layer, add a representative contract test, and repeat the affected batch.

Verification matrix:

- Enterprise query: category trend, timestamp trend, multi-metric or mixed-unit result, empty result,
  partial/truncated result, oversized/tabular result that must not be misrepresented as a chart, and renderer fallback.
- Temporal visual search: earliest/latest global occurrence and optional channel-scoped occurrence use the same typed
  browse contract; reconnect republishes the authorized catalog before the next call.
- Rule editor in FLAT mode: empty-canvas creation using device subscription or ReactorQL as the real-time source;
  ReactorQL wildcard semantics; HTTP/Kafka payload construction; node insertion and automatic wiring; remote schema
  revision refresh; validation failure, partial completion, rollback/compensation, and reconnect recovery.
- Side-effect boundary: editor verification mutates only the current unsaved canvas and never invokes save/publish.

Risks and controls:

- Multiple repositories contain unrelated dirty work. Use explicit path staging and verify each staged diff.
- The two shared-repository checkouts contain overlapping local copies. Publish from one owning checkout, preserve the
  other diff until equality is proven, then move it to the published commit without losing unmatched work.
- Existing PRs target different integration branches. Keep current bases unless maintainers request retargeting.
- Browser success alone is insufficient: contract/type tests and focused builds remain the merge gate.

### Client Tool Runtime Implementation And Verification

The first rollout of the stable facade and lifecycle contract is implemented in `src/layout/components/AiChat/`:

- `clientToolApi.ts` is the business-facing authoring facade. `clientToolDefinition.ts` compiles closed input, consumed-resource, effect, output, and result declarations into the existing wire contract.
- `clientToolRegistry.ts` owns monotonic scoped registration. `clientToolSnapshot.ts` owns semantic snapshots, active-execution deferral, subscriptions, and disposal. Handler-only refreshes do not change the wire version.
- `clientTools.ts` exposes dynamic `clientTools` and `clientToolsVersion` getters plus `refreshClientTools`, `subscribeClientTools`, and `dispose`; wrappers must proxy these members instead of spreading the runtime object.
- Home/bootstrap, alarm, visual search, and general IoT analysis tools use the facade. The catalog gate rejects new business imports of routing, binding, delivery, and contract internals while keeping an explicit legacy allowlist.
- A generic aggregate-presentation adapter now materializes one safe ECharts source from a closed field contract. It is
  selected by semantic roles rather than tool ids or result-key guessing, keeps the original aggregate binding, and
  uses the shared artifact delivery boundary for session-file/inline fallback. Renderer capability input shapes now
  describe renderer-ready sources only; raw `time-series.*` data is never forwarded directly as an ECharts option.
- The runtime rule editor adapts iframe definitions through `rule-editor-remote-definition/v1`, uses an explicit or stable-hash source revision, refreshes one runtime in place, defers semantic publication during execution, and disposes replaced runtimes.

Verification on 2026-07-31:

- `pnpm run test:client-tools`: 46/46 passed; coverage remained above the client-tool gate (95.96% lines,
  81.88% branches, 91.05% functions).
- `pnpm run test:client-tool-types` passed.
- `agentConversationVisualizationSafety.spec.ts` passed through the repository's esbuild-backed standalone runner,
  covering renderer capability source shape and JSON-to-ECharts safety boundaries.
- `iot-ui` and `system-setting-ui` module builds passed (8040 and 7716 transformed modules respectively); only the
  existing Rollup input, CSS comment, dynamic/static import, and chunk-size warnings remained.
- A fresh `/ai-search-hub` conversation produced one canonical ECharts presentation. Its source used the exact 24
  server labels from `13:00` through `12:00`, contained no generated epoch timestamps, and retained the original
  aggregate binding alongside the renderer-ready resource.

Verification on 2026-07-31:

- Both `ui/jetlinks-web-core` and `runtime-ui/jetlinks-web-core` passed `pnpm run test:client-tools`: 43/43 tests, line coverage 94.77%, branch coverage above 81%, and function coverage 89.98%.
- Both core workspaces passed `pnpm run test:client-tool-types`; tracked source and new-file content match across the two checkouts.
- `runtime-ui/modules/rule-engine-manager-ui` passed `pnpm run test:agent-tools`: 12/12 tests, line coverage 99.32%, branch coverage 92.64%, and function coverage 93.94%.
- Narrow runtime builds passed for `rule-engine-manager-ui`, `visualization-manager-ui`, and `device-manager-ui`. Operations builds passed for `alarm-ui` and `iot-ui`.
- The `vision-ui` build remains blocked by the pre-existing `VideoChannelPlayerView.vue` import of `DetailHeader`, which is not exported by `modules/saas-manager-ui/components/index.ts`; the failure does not originate in the client-tool changes.
- In-app Browser verification on the project visual-search page confirmed FLAT catalog validity and direct `visual_search_browse` execution for global earliest/latest requests. The client sends `timeRange + order + objectType` and omits `topK` when the user did not request a count; the execution default still returns one server-sorted record. A page reconnect rebuilt the authorized catalog and subsequent tool execution succeeded.

One workflow contract was corrected during browser verification: `vision.search.browse` is the only required operation for a global temporal occurrence request. `video.channel.search` is a conditional prerequisite only when the user explicitly supplies a place or channel; representing it as universally required caused weak models to substitute a resource overview for the actual target-image query.

### Client Tool Alternative Schema Hardening Implementation

Goal: keep the stable business-facing `defineClientTool` API while ensuring every compiled conditional-input branch is a self-contained JSON Schema that passes the backend fail-closed tool audit.

Scope and owner: `jetlinks-web-core/src/layout/components/AiChat/clientToolDefinition.ts` owns alternative compilation; representative coverage lives in the shared client-tool tests and the general IoT analysis catalog. The compiler will validate every `required`, discriminator, and forbidden input reference against the declared tool inputs, then emit branch-local property declarations without duplicating the authoritative root value constraints.

Non-goals: do not weaken `ToolContractAudit`, add exceptions for the four affected device tools, expose raw `_schema` authoring to business modules, or copy the shared-core implementation into `runtime-ui` during this change.

Implementation: `compileInputAlternatives` validates every `required`, discriminator, and forbidden reference against the tool's declared inputs. Each `oneOf` branch declares its referenced inputs in branch-local `properties`, while the root input definitions remain the single owner of type, range, and enum constraints. An invalid alternative now fails during frontend definition compilation instead of being serialized and rejected later by the backend.

Verification on 2026-07-31:

- `pnpm run test:client-tools` passed 44/44 tests with 95.45% line, 81.26% branch, and 90% function coverage; `pnpm run test:client-tool-types` also passed.
- `pnpm -F jetlinks-web-core build -- --module-name iot-ui` passed after transforming 8,039 modules.
- A real AI Search Hub session-init contained all four formerly rejected tools. Every time alternative declared `timeRange`, `startTime`, and `endTime` in the corresponding branch and had no undeclared or branch-missing required property.
- The model successfully invoked `device_query_online_rate_trend` with `timeRange=24h`, proving the corrected declaration remained model-exposable after the backend audit.
- Device metric trend bindings expose the actual ordered point array as `metric.time-series`, with the backend-provided local-time `label` as the category field and `value` as the measure. Summary wrappers and raw timestamps remain evidence, not renderer rows; a chart producer therefore cannot invent bucket spacing or timezone formatting while flattening the result.

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
