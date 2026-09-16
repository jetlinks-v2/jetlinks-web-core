# jetlinks-web-core Architecture

`jetlinks-web-core` is the runtime shell for the JetLinks operations UI. It owns app startup, core routes, layout, stores, common components, theme tokens, i18n, request setup, micro-app integration, and the module loading hooks used by `modules/*`.

This document is an entry map. It records the current implementation contracts and points to the files that own them.

## Workspace Boundary

The pnpm workspace is defined in `pnpm-workspace.yaml`:

- `jetlinks-web-core`: the shared shell and reusable frontend capability layer.
- `modules/*`: business UI modules loaded by the shell.

Do not statically deep-import private code from one business module into another module when that module must support independent `--module-name` builds. Put truly shared behavior in `jetlinks-web-core` or another public shared export.

### core 同时被 SaaS 前端与私有化前端复用

`jetlinks-web-core` 不是 `runtime-ui` 独占的：私有化部署是**另一个前端项目**，它同样把 `jetlinks-web-core` 作为基础模块、并挂载自己的 `modules/*` 子模块，区别只是**没有 `saas-runtime-ui` 这个模块**（本仓库侧构建私有化用 `pnpm -F jetlinks-web-core build -- --VITE_APP_DEPLOYMENT=private`，对应 `src/utils/deployment.ts` 的 `isPrivateDeployment()`）。

由此产生的约束：

- core 里的改动对两边同时生效，不能只按 SaaS 的形态判断。
- core 代码不得静态依赖任何 `modules/*`（含 `@xxx-ui/*` 别名），否则私有化项目只要缺这个模块就会构建失败。
- 只在私有化形态下存在的入口必须在 core 内部自行门控，例如 `src/views/relogin/`（会话失效后的就地重登录弹窗）只服务私有化部署，开关点是 `src/package.ts` 里对 `settings.isCreateTokenRefresh` 的最终赋值，见下节。
- SaaS 通过 `createHiddenBasisFormFields()`（`modules/saas-runtime-ui/index.ts`）隐藏的「基础配置」字段代表该能力在 SaaS 不开放，典型是 `RECORD_NUMBER`、`BACKGROUND`、`ICO`、`BASE_PATH`。注意隐藏只作用于表单 UI：`useBasisForm` 的 `submit()` 提交的是整个表单模型，被隐藏字段的值仍会写回后端，因此不能假设被隐藏字段在后端为空。

## 会话失效处理与重登录弹窗

入口链路：

1. `src/package.ts` 的 `initAxios()` 组装 `settings`，其中 `tokenExpiration`、`handleReconnect`、`isCreateTokenRefresh` 三项决定会话失效行为，随后 `crateAxios(settings)`。
2. `@jetlinks-web/core` 的 axios service 在两个地方处理失效：请求发出前若「无 token 且该 URL 不在 `filter_url`」会调 `tokenExpiration()`；响应 401 时先调 `tokenExpiration()`，再按 `this.options.isCreateTokenRefresh` 决定是否进入 `createTokenRefreshHandler()`。
3. `createTokenRefreshHandler()` 会 `await handleReconnect()`，成功则用新 token 重放原请求，失败则把排队请求一起 reject。
4. `handleReconnect` 绑的是 `src/package.ts` 的 `_handleReconnect`，它 `createApp(Relogin).mount()` 并调用 `open()`，也就是重登录弹窗。
5. `tokenExpiration` 在「无 token」或「未开启刷新」时执行 `clearVerifyCache()` + `jumpLogin()`；`jumpLogin()`（`src/router/index.ts`）会 `resetSessionStores()`、`removeToken()`，带 `reason=session-expired` 跳登录页，公开路由上直接 return 以避免回环。

约束与坑：

- 重登录弹窗只服务私有化部署：`isCreateTokenRefresh = VITE_TOKEN_REFRESH === 'true' && isPrivateDeployment()`。`VITE_TOKEN_REFRESH` 只表示「这个形态是否提供就地重登录」，SaaS 下即使它为 `true` 也会被 `isPrivateDeployment()` 收敛掉，401 直接清会话并退出到登录页，不弹窗。
- 门控必须落在 `isCreateTokenRefresh` 这一层，不能改成让 `handleReconnect` 返回假值：那样 `createTokenRefreshHandler()` 既不重放请求也不 reject，`failedQueue` 里的 Promise 会永久挂起。也不能只改 `tokenExpiration` 而不管 `settings.isCreateTokenRefresh`——响应 401 时用的是后者，两者不一致会出现「既跳登录又弹窗」。
- `settings.isCreateTokenRefresh` 必须在 `crateAxios(settings)` 之前再赋一次值：微前端基座下发的 `parentData.axiosSettings` 与 `getPackageConfig().axiosSettings` 都会覆盖它，任何一处打开都会让 SaaS 重新弹窗。
- `src/views/relogin/index.vue` 的 `open()` 自身没有任何门控，唯一调用点是 `_handleReconnect`，所以门控只能做在 `package.ts` 这一层。
- `ndJson.create()` 只接收 `tokenExpiration`，没有 `handleReconnect`/`isCreateTokenRefresh`，NDJSON 流不会弹窗。

验证结果（2026-09-16，编译产物级双向核对）：

- SaaS 形态（默认构建）：`isPrivateDeployment()` 被折叠为 `S6e=()=>!1`；`tokenExpiration` 编译成 `()=>{getToken(),clearVerifyCache(),jumpLogin()}`，`!token || !isCreateTokenRefresh` 这个守卫因恒真被整体消除，反证 `isCreateTokenRefresh` 在构建期已知为 `false`；`crateAxios` 之前是 `t.isCreateTokenRefresh=e`（`e=false`）。即 401 不再进入 `createTokenRefreshHandler`，不会弹窗，而是清会话跳登录页。
- 私有化形态（`VITE_APP_DEPLOYMENT=private`，`--outDir` 到临时目录核对后已删除）：`isPrivateDeployment()` 折叠为 `S6e=()=>!0`，`tokenExpiration` 保留为 `()=>{(!getToken()||!e)&&(clearVerifyCache(),jumpLogin())}`，`e=true`，原有「就地重登录」行为完全不变。

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

## Unified Verification

The shared verification dialog is owned by `jetlinks-web-core/src/views/verify/index.vue` and is opened from `jetlinks-web-core/src/package.ts` when a request fails with `verify.required`.

Captcha confirmation uses `jetlinks-web-core/src/api/verify.ts#confirmCaptcha` and must keep the provider-specific parameter contract aligned with the backend `CaptchaProvider` implementations:

- `image`: submit `params.verifyKey` and `params.verifyCode`.
- `tianai`: first complete `jetlinks-web-core/src/components/Captcha`, then submit the returned passed captcha id as `params["captcha-id"]`. The parent verification dialog hides its footer for this provider and auto-confirms as soon as the behavior captcha succeeds.

`jetlinks-web-core/src/components/Captcha/useCaptha.ts` returns the backend validation success payload to callers. Consumers that need a follow-up confirmation token must use that payload instead of assuming the component only emits a boolean success flag.

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
- Placeholder menu items declared with `options.meta.menuBadge.type = "comingSoon"` stay visible in layout navigation but are excluded from dynamic route generation; `BasicLayoutShell` renders leaf items as disabled text with a small badge, and project secondary navigation preserves the disabled state.
- Application side layout is owned by `src/layout/shells/ApplicationLayoutPage.vue`: ProLayout receives level-one menus only, while the active level-one menu's level-two children render through `ProjectSecondaryMenu` in the content area. Project and tenant layouts keep their `BasicLayoutShell` contracts.
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

Notification extension points (business-neutral):

- Realtime and list handlers are registered through `notification-realtime:handlers` and `notification-provider:default`, and consumed by `src/layout/components/noticeRealtimeHandler.ts` and `noticeListHandler.ts`.
- The handler context uses `source: 'realtime' | 'list'` to separate a realtime arrival from clicking an existing bell record. Only the realtime path receives `showTip(options)`, which renders a single top-right tip with an optional icon, title, description and click callback; core keeps its own default tip for providers that do not take over.
- A bell record may carry the generic `noticeIcon` field (an Ant Design icon name) and `NoticeItem.vue` only renders that field. Core never resolves a provider's business type, provider name, or copy.

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

### 登录页从 saas-runtime-ui 迁入 core

状态：已完成（2026-09-16）。

- 目标：把 `runtime-ui/modules/saas-runtime-ui/views/login/**` 这套运行时登录页整体上移到 core，让 core 自己拥有 `/login`；`saas-runtime-ui` 不再通过 `getCoreRouteOverrides()` 覆盖登录路由。
- 影响范围：`jetlinks-web-core`（子模块，独立仓库）接收登录页、登录 API 端点、路由注册、i18n 键与图片资源；`saas-runtime-ui`（`runtime-ui` 仓库内目录）删除 `views/login/**` 与只服务登录页的 `api/login.ts`、`api/typing.d.ts` 及 `index.ts` 中的 Login 覆盖。不修改 `ui/` 运营端，不改变后端接口语义、菜单与权限。迁移本身不改登录页视觉与交互；为不丢失旧 core 登录页能力，另外补回备案号、密码加密、SSO 图标入口、初始化跳转四项，并按部署形态补回自定义登录背景图（见下）。core 同时被私有化前端复用，所以这些能力都必须在 core 内部对两种形态都成立。
- 文件路径：页面入口 `src/views/login/index.vue`，组件在 `src/views/login/components/`，hooks 在 `src/views/login/hooks/`，跳转工具 `src/views/login/utils/redirect.ts`；图片资源 `src/assets/login/`；登录 API 端点并入 `src/api/login.ts`；路由 `src/router/basic.ts` 的 `LOGIN_ROUTE`。
- 依赖方向：core 不得反向引用 `@saas-runtime-ui/*`，因此迁移时 `@saas-runtime-ui/api/login` 改写为 `@jetlinks-web-core/api/login`，`@saas-runtime-ui/assets/*` 改写为 `@jetlinks-web-core/assets/login/*`。
- API 边界：并入 `src/api/login.ts` 时只新增导出，不改动既有 `login`/`codeUrl`/`captchaConfig` 等导出的语义，`src/views/relogin/`、`src/views/oauth/`、`src/views/share/authorize/` 的既有请求行为保持不变。
- 路由守卫：`saas-runtime-ui/index.ts` 原先在 Login 覆盖上挂的 `beforeEnter`（主动退出清理 `clearLoginTransientState`、会话失效记录 `rememberLoginRedirect`）随页面一并迁入 core 的 `LOGIN_ROUTE`。
- 旧登录页归属：core 原 `src/views/login/right.vue`、`remember.vue`、`util.ts` 只被 `src/views/relogin/index.vue`（WebSocket 重登录弹窗）引用，随之移到 `src/views/relogin/components/`，`views/login/` 只保留新登录页；原 `src/views/login/index.vue` 由新页面取代后删除。
- 国际化：`Login.*` 键从 `modules/saas-runtime-ui/locales/lang/{zh,en}.json` 迁入 `src/locales/lang/{zh,en}.json`。迁移前这些键只在构建 `saas-runtime-ui` 模块时可用；`moduleFilterPlugin` 会把非目标模块的 JSON 置空，因此登录页留在 core 后必须由 core 自己持有这些键。
- 已知缺陷（本次不修，原样搬运）：登录页用到的 8 个 `SaasManager.generated.*` 键在整个仓库任何 locale JSON 中都不存在，界面上仍会显示原始键名。
- 已知缺陷（本次不修）：`WechatCallbackLogin.vue` 依赖的 `/weixin/callback` 路由全仓库未注册，微信浏览器登录链路仍不闭环；本次只迁移组件，不新增路由。
- 不迁移：`LoginBrandPanel.vue`、`ThirdPartyLogin.vue`、`login-input.less` 全仓库无引用，直接删除，不带入 core。
- 顺手修复的既有缺陷：`useLoginSuccess.ts` 的 `handleLoginSuccess(token, options?)` 里 `options.username` 未做空值保护，而 `WechatScanLogin.vue`、`WechatCallbackLogin.vue` 都只传 token，扫码成功或微信回调时会直接抛 `TypeError` 并被上层 catch 成“登录失败”。迁移后改为 `const username = options?.username || ''`，恢复“用户名含 `@` 才按子账号处理”的原意。
- 旧登录页能力已补回：新 `/login` 接管后，旧 core 登录页的能力一并迁入，不再依赖重登录弹窗——备案号展示（`src/views/login/index.vue` 读 `systemStore.systemInfo.front` 的 `showRecordNumber`/`recordNumber`，复用 `login.index.102238-0`）、登录密码加密（`src/views/login/hooks/useLogin.ts` 用 `encryptionConfig` 的 `encrypt.enabled`/`publicKey`/`id` 加密密码并带 `encryptId`，公钥按 3 分钟刷新、登录失败时重取）、第三方 SSO 图标入口（`src/views/login/hooks/useSsoLogin.ts` 统一加载 `bindInfo`，`src/views/login/components/SsoLoginMethods.vue` 渲染其余应用入口，`src/utils/sso-icon.ts` 收敛 provider→图标映射并同时供重登录弹窗复用）、管理员首次初始化跳转（`src/views/login/hooks/useLoginSuccess.ts` 在默认落地分支前用 `getInitSet()` 判断，命中空初始化配置时跳 `toRuntimeHashHref('/init-home')`，显式 redirect 仍然优先）。SSO 图标列表会排除已经作为微信扫码方式展示的同一个公众号应用，避免重复入口。
- 自定义登录背景图按部署形态分流：`src/views/login/index.vue` 用 `--login-bg-image` 自定义属性承载背景，默认值是迁入的 `src/assets/login/login-bg.png`；只有 `isPrivateDeployment()` 为真时才用 `front.background`（未配置时回退历史默认图 `images/login/login.png`）覆盖它。原因是 SaaS 模块隐藏了 `BACKGROUND` 字段，但 `useBasisForm` 的表单模型始终带 `background: images/login/login.png` 并整表提交，后端该字段恒为历史默认值——若无条件支持，SaaS 登录页会退回旧背景图。备案号不必这样分流：`showRecordNumber` 默认 `false` 且是显式开关，隐藏后仍是 `false`。
- 明确不做的两处：旧登录页在 `system_edition !== 'community'` 时才请求 `bindInfo`，新页面无条件请求——`useRequest` 会把失败吞进 `onWarn`/`console.warn`，core 也没有全局 axios 错误 toast，社区版最多多一次请求，而按 edition 门控反而可能让报 `community` 的实例丢掉微信扫码登录；旧页面的页级 `a-spin` 与 `v-model:loading` 换成按钮级 loading，属交互细节。
- 验证结果：`node --max-old-space-size=12288 ../node_modules/vite/bin/vite.js build` 主机构建通过（`✓ 23674 modules transformed. built in 7m 39s`），产物落在 `runtime-ui/dist`，其中 `dist/.vite/manifest.json` 含 `src/views/login/index.vue`，`dist/assets/login-bg.png` 为迁入的背景图（2521024 字节，与 `modules/saas-runtime-ui/assets/login.png` 一致），SSO 入口用到的 `dingtalk.png`/`third-party.png`/`internal-standalone.png`/`wechat-miniapp.png` 与 `Login.*`、`Login.ssoMethods`、`login.index.102238-0` 等键均已打进产物。默认 `pnpm -F jetlinks-web-core build` 在本机因内存压力 OOM（swap 已用满），与环境相关，非本次改动导致。
- 验证结果（背景图门控双向）：SaaS 形态产物中登录页 chunk（`dist/assets/index.*.js`）`login-bg-image` 与 `images/login/login.png` 出现次数均为 0，说明 `isPrivateDeployment()` 被常量折叠后该分支被摇掉，只用 CSS 里的内置 `login-bg.png`；私有化形态用 `VITE_APP_DEPLOYMENT=private` 单独构建（`--outDir` 到临时目录，验证后已删除）时同一 chunk 里两者各出现 1 次，编译结果为 `s => \`url("${s.replace(/["\\\r\n]/g,"")}")\`` 与 `o.value.background || <fallback>`，即后台配置的登录背景图在私有化下确实生效。
- 验证结果：单模块构建 `pnpm -F jetlinks-web-core build -- --module-name saas-runtime-ui` 失败于 `modules/saas-runtime-ui/views/device/Template/Save/index.vue:90` 的 `import { device } from '@device-manager-ui/assets'`，根因是 `configs/plugin/moduleFilterPlugin.ts` 把非目标模块的 `.ts` 置为 `export default { filter: true }`，该文件与机制均未被本次改动触及，属既有问题。
- 验证结果：`vue-tsc --noEmit -p tsconfig.json` 在改动后为 561 条，改动前基线（core HEAD 的独立 worktree，补入 `components.d.ts`）为 552 条（worktree 无 `node_modules`，另有 5 条 `Cannot find module` 属该环境假报，已剔除）。差值 +9 由两部分构成：8 条是迁移前 `modules/saas-runtime-ui/views/login/**` 中已存在、只因 core 的 `tsconfig.json` 只 include `./**`（不含 `modules/`）而未被 core 扫到的旧错误，迁入后落进 core 的扫描范围；1 条是新增的 `src/api/login.ts` `codeUrlWithoutProjectContext` 复刻同文件既有 `codeUrl` 的 `request.get<T>` 写法而带出的同类 TS2347。剩余 12 条迁移文件类型错误均为纯类型标注问题（reactive 字段推断、rules/QRCode 联合类型、NDJSON 流 `unknown`），不影响运行时行为；按约定本次不修，仅在文档记录。补回四项旧登录页能力后错误数仍为 561，未新增任何类型错误。迁移文件的 import 解析另用静态脚本核对 112 条，0 处未解析或缺失导出。

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

### Runtime Catalog Failure Isolation

The runtime keeps contract validation fail-closed, but a malformed optional extension must not prevent the authorized base catalog and unrelated providers from initializing.

- Provider contributions are read independently. A provider that throws while producing capabilities, tools, workflow guides, prompt examples, or system prompt lines is quarantined for that contribution and reported with its provider id and contribution kind.
- Tool projection is admitted independently after canonical ids have been checked. A tool that cannot be projected into a model declaration is absent from both the advertised catalog and the executable name map; duplicate ids and advertised-to-canonical identity collisions still fail the complete snapshot.
- The last executable snapshot remains authoritative during a failed refresh. Isolation never converts an invalid definition into a legacy/direct tool and never weakens effect, schema, resource, evidence, or delivery validation.
- Business modules must still repair invalid authoring declarations. Isolation is a runtime availability boundary, not a compatibility fallback.

Verification must cover a failing provider beside a healthy provider, an individually unprojectable tool beside a healthy tool, duplicate-id rejection, and absence of quarantined tools from both model declarations and execution dispatch.

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
