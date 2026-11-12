# Theme Configuration Guide

This directory documents how to add a theme style for the JetLinks shell.
The runtime entry is still `src/utils/theme-config.ts`.

## Theme Persistence

Header theme switching is a user preference. The selected style is saved to `localStorage` with key `jetlinks-theme-style` for fast first paint, and to the user setting `PATCH /user/settings/theme/style` with payload `{ name: 'style', content: '<theme>' }` for cross-session persistence.

Theme initialization first applies the localStorage value for fast first paint. After an authenticated user setting can be read, `GET /user/settings/theme/style` wins and is written back to localStorage; when the user setting is absent, system `front.headerTheme` remains the fallback before the default `light` style.

## 应用根组件、公共默认布局与微前端迁移设计

状态：已选定“应用根组件 + 公共默认布局”，并明确微前端应用使用独立仓库、独立构建和独立部署，源码不要求留在当前 workspace；以下为 L 级实施设计，尚未实现。本文替代此前的 `getApplicationWrapper` 与 default/content 双插槽计划。

目标：当前本地应用继续在 `runtime-ui/modules/` 内维护；迁为微前端后，由独立应用仓库维护入口、Layout、主题、路由和业务依赖，独立发布到应用自己的部署地址。框架团队一次性提供公共运行契约和宿主接入，项目端保持自身布局与主题。宿主在运行时读取应用注册信息并加载远程应用，无需该应用在本仓库保留源码、占位模块或构建期注册入口。

“无缝切换”的验收范围是：迁出到独立仓库后，应用根组件、Layout、主题及业务逻辑继续复用，宿主通过运行配置切换到远程入口，对外访问路径、权限及交互保持兼容。首次迁出、独立打包、部署、资源路径、网关配置与历史依赖清理仍是必要工作；不承诺任意现有模块零改造，也不承诺模式切换时保留全部内存状态或跨域访问不刷新。复用同一份业务实现不意味着必须保留在同一仓库，远程应用也不必同时产出本地入口。

### 当前事实与改造边界

- `src/layout/BasicLayoutPage.vue` 区分 tenant/project/application，但在选择布局前就初始化 `useBasicLayoutController`；应用接入需要先分流，再按实际使用的默认布局启动控制器。`ProjectLayoutPage` 只保留项目入口职责。
- `src/layout/shells/ApplicationLayoutPage.vue`、其控制器及 `PageRouteView` 依赖 core 的 store、路由与注入上下文。目前没有可独立使用的 `DefaultApplicationLayout`；仅增加 export 不满足迁移要求。
- `src/utils/modules.ts` eager 加载 `modules/*/index.ts`；`src/utils/menu.ts` 按菜单层级插入 `BasicLayoutPage`。应用包需要独立的声明与启动入口，应用内部路由不能再次套入宿主布局。
- `src/App.vue`、`src/utils/theme-style.ts` 与 `src/store/system.ts` 使用全局主题、根元素变量及项目/用户偏好；应用不得借用这条写入链。`vite.config.ts` 的 `cssCodeSplit: false` 使惰性加载不能承担 CSS 隔离职责。
- `src/views/mirco/SubAppRedirect/base.vue` 已接入 `@micro-zoe/micro-app`，但默认追加 `layout=false`；`src/package.ts` 还共享模块注册表、函数及客户端实例。这些现有行为不能直接作为应用独立运行契约。
- 消防现有 `runtime/layout/FireLayout.vue` 读取 core 菜单 store、私有导航 hook 和用户组件，`runtime/utils/saas/request-context.ts` 读取 core 请求上下文。迁移必须覆盖根组件的业务依赖链，不能只改外壳包装层（`ApplicationLayout.vue` 已在应用外壳注册落地后移除）。

### 总体结构与所有权

```text
BasicLayoutPage
  ├─ tenant / project → 现有入口
  └─ application → ApplicationHost
                       ├─ local：本仓库 modules 中的应用
                       └─ micro：运行时注册信息 → 独立部署地址
                                                    ↓
                                          独立仓库的应用入口

两类入口遵守相同契约；应用内部选择：
ApplicationRoot.vue → 应用主题 + 公共默认布局 / 自定义布局
```

| 落点（拟新增部分以实施时核验为准） | 职责与依赖方向 |
| --- | --- |
| `modules/<application>-ui/application/` | 仅当前本地应用的清单、启动入口、根组件、主题及业务依赖 |
| 独立应用仓库 | 微前端应用自己的源码、构建配置、依赖锁定、CI/CD 与部署产物；不依赖本 workspace 目录结构 |
| `packages/application/`，拟发布为 `@jetlinks-web/application` | 公共类型、生命周期、Vue 运行入口、主题/弹层边界、路由承载与默认布局；以有版本的 npm 包供独立仓库安装，不反向导入 core 或具体应用 |
| `jetlinks-web-core/src/application/` | 本地发现、远程注册信息解析、身份解析、宿主能力适配、本地/远程加载及失败处理；不包含业务应用映射 |
| `jetlinks-web-core/src/layout/` | 保留入口分流与项目/租户行为；应用分支交给 ApplicationHost |

公共包先作为一个包组织，按 `contracts`、`vue`、`layout`、`adapters` 提供明确子入口，不预建大量小包。公共包源码可以先放在本 workspace，但必须构建并发布到应用团队可访问的包仓库；独立应用按版本安装，不读取本地 core 源码。当前 `pnpm-workspace.yaml` 只包含 core 与 modules，实施时需显式加入公共包并建立真实构建/导出。框架团队维护公共包，应用团队在自己的本地模块或独立仓库维护应用；远程接入不要求给宿主提交代码。

### 应用入口与公共默认布局

应用根组件负责选择布局，公共运行层负责挂载。以下 API 名称为拟定契约，当前不可直接使用：

```vue
<script setup lang="ts">
import { ApplicationTheme, DefaultApplicationLayout } from '@jetlinks-web/application/vue'
import theme from './theme'
</script>

<template>
  <ApplicationTheme class="sample-application" :theme="theme">
    <DefaultApplicationLayout />
  </ApplicationTheme>
</template>
```

自定义布局的根组件将 `DefaultApplicationLayout` 换为本应用 Layout，并在其中渲染一次 `ApplicationRouteView`。默认布局自身包含路由承载；自定义布局不再渲染默认布局。不引入 default/content 两套内容入口。

公共默认布局从现有应用布局提取可复用实现，依赖公共应用上下文获取菜单、用户和导航动作，不依赖宿主 Pinia、私有 hook 或父组件注入。`ApplicationRouteView` 复用现有路由 loading/Suspense/骨架逻辑，但将其状态归入应用运行实例；不能通过重新导出当前 core 组件保留隐式依赖。默认布局的导航监听与功能订阅仅在使用它时启动。

图标、语言、指令、共享组件及反馈服务由应用 bootstrap 显式安装。通知、用户菜单、AI 等默认布局能力通过公开服务或可选能力接入；不能直接把宿主 Vue 组件、VNode 或 slot 函数跨运行环境传给应用，也不能为维持外观偷偷导入整套 core。

### 本地与微前端共用的运行契约

为支持以后直接切换，本地模式也创建独立 Vue App、Router、Pinia 与应用服务实例，挂到 ApplicationHost 的容器；不把根组件直接接到宿主组件树并依赖其注入。共享库的模块级请求/状态单例不会因为 createApp 自动隔离，必须改为实例服务或由适配器封装。独立实例也不等于 CSS 隔离，样式仍遵守下文的作用域要求。

```ts
// 接口草案：这些调用发生在应用所在运行环境内部。
interface ApplicationEntry {
  mount(target: HTMLElement, runtime: ApplicationRuntime): Promise<ApplicationInstance>
}

interface ApplicationInstance {
  update(snapshot: ApplicationSnapshot): Promise<void>
  unmount(): Promise<void>
}
```

- 本地适配器直接启动入口；微前端适配器在子应用内部选择容器、构造 runtime 并调用同一个入口。DOM、Vue App、Router、Pinia、函数、响应式对象与 WebSocket 客户端不穿过跨窗口通信边界。
- `ApplicationSnapshot` 是带协议版本、实例/会话标识、上下文修订号的可序列化数据，包含应用/模板、项目、用户必要信息、权限、菜单、语言及初始应用内路径。应用用自身响应式状态消费它；宿主更新通过显式快照/事件传递。
- `ApplicationRuntime` 是应用端 SDK：提供导航、请求、订阅、宿主动作及应用偏好等必要能力。本地实现可以委托 core；远程实现通过版本化消息或应用自身的请求客户端实现。异步服务从第一版使用 Promise/订阅句柄，避免后来把同步宿主调用改为跨环境异步。
- 协议只传 DTO、命令与事件；消息包含请求/关联 ID、实例 ID 和上下文版本，支持超时、取消、结构化错误、取消订阅及拒绝旧实例消息。SDK 回调只在各自环境中执行。采用 postMessage 的适配器需核对 source、origin 和会话握手；不能把宿主整个 store 或注册表作为“上下文”暴露出去。
- HTTP、上传/下载及长连接沿用当前租户/项目/应用鉴权语义，在传输适配层处理凭据、刷新和失效；不靠业务页读宿主 localStorage 或 token URL 参数。上传/流式数据按专用传输处理，不强行 JSON 化。权限快照用于界面展示，不能替代服务端授权。
- 每次 mount 创建新实例；unmount 幂等销毁 Vue App、监听、订阅、请求、弹层、定时器及本实例状态。连续切换时旧实例即使迟到加载完成也不能重新挂回；update 只接受当前实例的新修订。项目、应用或登录身份改变时默认重建实例，同身份的菜单/权限/语言变动可更新。
- 第一个微前端适配器优先验证仓库已安装的 `@micro-zoe/micro-app@1.0.0-rc.26`，将其全局变量、事件及路由配置限制在适配层。公共应用代码不感知框架名称；后续更换容器只需实现并验证同一契约。现有旧微应用继续使用其原协议，避免混用新旧行为。

### 本地发现、远程注册与独立发布

- 本地应用可以在本模块的 `application/manifest.ts` 导出纯数据清单，由本地发现适配器读取。该清单不得导入根组件、样式、store 或启动服务；本地文件发现仅服务本地应用。
- 远程应用由宿主在运行时从应用注册配置中取得 application code、实例/模板绑定、`runtime: micro`、entry URL、适配器类型、契约版本及发布版本。注册配置优先复用现有应用配置/资源入口，实施时核实可写入与读取的实际契约，不预设已有某个新接口。远程注册源不依赖 modules 扫描、构建期 import 或本地清单文件；新增及更新兼容协议的远程应用无需重新构建/发布宿主。
- 两类注册信息归一为应用描述，由加载器选择 local/micro。local 定位本地应用入口；micro 只使用注册的远程地址启动应用，宿主不 import 远程应用根组件。身份以当前应用实体为准，不通过目录、显示名称或菜单权限猜测；实例绑定优先于模板默认绑定，同优先级重复绑定报错。缺少配置的老应用保留既有默认布局；明确配置但版本冲突/加载失败时展示可重试错误。
- 尚未确认应用身份时展示加载状态，不提前挂载某个业务根组件。纯元信息与业务启动分离；不继续采用 `getApplicationWrapper` 或只返回 Vue 组件的扩展契约。远程应用声明的身份/能力还需与宿主授权上下文核对，不能让远程清单自行扩大权限。
- 一个应用组合多个能力模块，根组件仍只有一个。本地模块通过公开导出组合；迁出后的应用将所需能力纳入自己的仓库或安装其已发布包，不能依赖本仓库的 sibling 路径、alias 或宿主全局模块注册表。
- 当前 eager `modules/*/index.ts` 及页面 glob 必须对已迁移应用拆出宿主贡献与应用内启动。迁出后移除其本地应用注册及源码要求；仅确实仍服务项目端的共享模块独立保留。远程接入不能以本地 register、页面表或专用 CSS 存在为前提。
- 本地应用单独输出 ESM、CSS 和资源清单，按需加载，避免业务入口被 `cssCodeSplit: false` 合入宿主全局 CSS。远程应用在自己的仓库和 CI 中构建 HTML/bootstrap、JS/CSS 及静态资源，发布到自己的站点/CDN；宿主构建不参与，也不要求复制远程产物到本仓库或宿主 dist。
- 迁移过程是复用已经解耦的根组件、主题、页面和服务实现，迁入独立仓库，使用已发布公共包，增加远程 bootstrap 与部署配置，然后更新应用注册信息。远程应用可以独立演进，不强制继续维护本地入口或本仓库副本。
- 独立构建必须脱离 core 源码 alias、宿主自动导入及宿主单例，只依赖本应用、显式能力包和有版本的公共包；静态资源 base、字体、worker、动态 import 路径以应用自己的部署地址解析，域名和网关策略按实际环境验证。应用样式资源按实例管理，卸载释放，但命名空间仍是避免运行中污染的前提。
- 不强制共享 Vue/Pinia 运行实例；库是否去重是本地构建优化，不能成为应用能否启动的条件。公共契约进行版本协商，不兼容时在挂载前失败；配置可回退至前一个已验证产物。

### 路由与外壳归属

- 宿主管理应用入口及浏览器地址；应用管理自身页面和内部 Router。宿主以应用边界路由交给 ApplicationHost，不再逐页把该应用业务组件注册到宿主 Router。
- 嵌入运行时应用使用 memory history，由适配器提供首次导航和宿主 URL 同步；宿主浏览器 history 是前进/后退的权威来源。独立打开时由 standalone 适配器接管浏览器 history。不能创建两个同时改写同一 window history 的 Router。
- 保留现有应用访问地址和深链接规则，由现有 project/application runtime URL 工具在宿主侧转换为应用内路径；不硬编码新的统一 `/apps/...` 前缀。路径、query、hash、刷新、前进/后退、replace、重定向及新窗口链接都必须双模式验证。
- 应用内跳转先经过应用 guard，成功后以带关联标识的导航结果同步宿主；宿主发起的前进/后退也要有接受/拒绝结果，拒绝时恢复一致状态且避免重复 history 项。跨应用/回项目使用 SDK 的语义化宿主动作；禁止应用直接赋值宿主 location。权限变更需同步当前路由的允许状态。
- 提取菜单到路由的纯组装能力，为应用模式关闭 core 外壳注入，保留既有组件 code、权限、额外路由和重定向语义。应用内部渲染使用自己的路由深度，嵌套布局只能产生一个业务页面实例。
- 新应用模式由子应用持有完整 Layout，宿主只提供挂载容器；现有 `SubAppRedirect/base.vue` 的 `layout=false` 不用于此模式，避免应用外壳被隐藏或内外重复出现。
- 当前 `src/store/businessApplication.ts` 使用 `window.location.assign()` 切换入口。先保证加载模式迁移兼容现有 URL；如需运行中不刷新地在应用之间跳转，还需完成宿主会话切换、导航事务和状态清理，不把它算成根组件能力自带的效果。

### 主题与弹层边界

- 应用根组件拥有 `ApplicationTheme`、固定 token 基线与作用域 CSS。默认布局也从此局部主题读取视觉配置，不能继续跟随项目 system store。局部 Provider 明确不继承项目配色，同时保留应用 bootstrap 提供的语言、图标及组件配置。
- 应用范围覆盖自身语义变量与兼容别名，专用 CSS 限定在应用根类；不得写宿主 `document.documentElement`、裸 `html/body/:root/.ant-*` 覆盖或全局 `ConfigProvider.config`。共享 CSS reset、字体、全局 keyframes 等也要审计；独立 Vue 实例与异步组件都不能隔离任意 CSS。
- 下拉框、Modal、Drawer、Tooltip 与静态 message/notification/confirm 都绑定应用自己的主题及 overlay 容器。容器属于应用运行实例且位于作用域内，避免被内容区 overflow 裁剪；退出时清理。应用的静态反馈迁移到实例服务，不通过全局配置切换主题。
- 第一版不新增在线主题编辑或用户偏好接口。将来持久化时使用用户/租户/项目/应用的独立命名空间，不覆盖 `jetlinks-theme-style`、主题色缓存或 `/user/settings/theme/style`；同源微应用也遵循此规则。
- 本地与微前端采用同一套样式约束，不把某个容器的 `iframe` 标记当作完整 DOM/CSS 隔离的验收证明。需要任意全局样式或不同设计系统完全隔离时，另用真实独立文档的 iframe 适配器并测试其布局、弹层与通信；这不改变应用根组件契约。

### 实施顺序与验证门槛

1. 建立并发布公共包与最小运行契约，用一个小应用验证独立启动、局部默认布局、自定义布局及卸载。必须同时跑通本地实例及独立应用工程的真实微前端入口；后者仅安装发布包，不能解析本 workspace 路径，也不能只用 mock 或给远程接口留 TODO。
2. 在 core 落地 ApplicationHost、本地清单发现、远程运行时注册源、身份选择与本地/微前端适配。分离默认布局控制器初始化，提取默认布局/路由 loading 能力并适配当前菜单及 URL，保留旧应用和项目/租户分支。
3. 以消防为真实迁移试点：确认稳定应用/模板绑定，清理其根组件及首批业务链上的私有依赖、全局状态、样式和注册副作用，补齐实际需要的请求/上传/订阅能力。部分路由试点期间保留未迁移入口的兼容行为。`vite-plugin.js` 对 `BasicLayoutPage.vue` 的构建期替换已随「应用外壳注册与模块内绑定」一并移除，消防改由 `getApplicationShell()` 声明外壳。
4. 对试点迁出、独立构建和部署：验收环境移除对应本地应用目录，在宿主产物不变的情况下注册远程地址并成功打开；独立发布新版本、修改注册版本/入口后，宿主无需重建即可加载，旧深链接及权限语义不变。若仅迁移部分路由，只将该部分标记为验证通过，不能宣称整个消防应用已可直切。
5. 在本文回填最终公开 API、模块示例、验证命令及证据；后续应用按同一契约接入。首期难度由单纯布局扩展的中等提高到中高，主要成本是路由/状态边界、公共默认布局去耦及真实应用依赖迁移。

验收至少覆盖：

- 应用根组件与业务实现从本地模块迁到独立工程后继续运行；默认布局与自定义布局各一例。远程应用在无法访问本仓库的环境中只安装发布依赖完成构建，宿主不存在对应 modules 源码/占位入口也能接入；宿主产物不变时，运行时新增注册、独立升级及回退均有效。
- 项目 → 应用 A → 应用 B → 项目、直接打开/刷新深链接、query/hash、前进/后退、路由拒绝与重定向；默认布局与业务页各挂载一次，权限变化不改变根组件归属。
- 应用主题、项目深浅色变化、普通弹层及静态反馈；项目主题缓存/用户设置没有被应用修改，卸载后项目外观与反馈正常。
- 两次挂载/卸载、加载中切换、初始化失败、RPC 超时、协议版本不符、token 失效、项目/用户变化、权限撤回及延迟响应；无旧订阅/弹层/状态泄漏，错误可重试且可回退配置。
- 生产部署下动态资源、字体、worker、上传/下载、长连接、登录续期、菜单与按钮权限；跨源部署的网关/会话方案需用真实环境验证。

计划执行契约与导航生命周期定向测试、独立应用构建、浏览器双模式验收，并在 `runtime-ui/` 执行 `pnpm exec vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json` 与 `pnpm build`；公共包与应用还需各自 typecheck/build。区分既有诊断；当前 scripts 无独立 lint 命令，实施时复核。此次仅更新设计并核对文档差异，尚未运行实现测试、构建或浏览器验收。

本轮设计不涉及运营端 `ui/`、业务页面重设计、后台主题管理、全量历史模块迁移或替换已有微前端框架。实际应用/模板标识、试点覆盖的业务路由及生产部署地址在试点接入时核实；这些不能用猜测值进入实现。

## Add a Theme

1. Add a new item to `styleTokens` in `src/utils/theme-config.ts`.
2. Keep the object typed by `ThemeStyleToken`; missing required Ant Design token fields must fail TypeScript.
3. Provide Ant Design seed/map token fields first. Only fields accepted by Ant Design Vue should be written at the top level.
4. Add `layout` only when the theme needs shell layout differences.
5. Add `cssVars` for shell and custom page variables. Do not put Ant Design Vue token fields in `cssVars`.

```ts
newTheme: {
  label: '新主题',
  colorPrimary: '#1677FF',
  colorInfo: '#1677FF',
  colorSuccess: '#52C41A',
  colorWarning: '#FAAD14',
  colorError: '#FF4D4F',
  colorBgBase: '#FFFFFF',
  colorBgLayout: '#F5F5F5',
  colorBgContainer: '#FFFFFF',
  colorBgElevated: '#FFFFFF',
  colorTextBase: '#000000',
  colorText: '#1A1A1A',
  colorTextSecondary: '#6B7280',
  colorBorder: '#D9D9D9',
  colorBorderSecondary: '#F0F0F0',
  borderRadius: 6,
  borderRadiusLG: 8,
  borderRadiusSM: 4,
  boxShadow: '0 6px 16px 0 rgba(0, 0, 0, 0.08)',
  boxShadowSecondary: '0 2px 8px rgba(0, 0, 0, 0.06)',
  fontFamily: 'AliRegular, sans-serif'
}
```

## Menu Variants

`layout.menuVariant` controls the visual shell menu variant.

| Variant | Behavior |
| --- | --- |
| `classic` | Existing menu style. This is the default when no variant is set. |
| `compact-search` | Compact white menu with a search input and left active indicator. |

Use `compact-search` when a theme should match the second menu style:

```ts
layout: {
  menuVariant: 'compact-search',
  showMenuSearch: true,
  siderWidth: 224
}
```

The search input is visual-only. It does not filter menu data.

## Layout CSS Variables

Menu variants are styled through CSS variables in `cssVars`.
Set only the variables that differ from the defaults.

```ts
cssVars: {
  '--layout-menu-bg': '#FFFFFF',
  '--layout-menu-padding': '0.5rem 0.625rem',
  '--layout-menu-item-height': '2rem',
  '--layout-menu-item-radius': '0.375rem',
  '--layout-menu-item-active-bg': '#F1F2F4',
  '--layout-menu-item-active-color': '#1D1F24',
  '--layout-menu-item-active-line': 'var(--primary-color)',
  '--layout-menu-search-bg': '#F6F7F9',
  '--layout-menu-search-border': '#E6E7EB'
}
```

`applyThemeStyle()` writes default values for these variables before applying the active theme. This prevents variables from one theme leaking into another when users switch themes.

## Typography And Spacing Tokens

### Project Sidebar Child Indicators

The project sidebar's nested group indicators (for example, 素材库) follow the same inactive gray as sibling leaf indicators. Only `ant-menu-submenu-selected` activates a group indicator with `--layout-menu-item-active-color`; expanding, collapsing, hovering, or focusing the group does not activate it. Top-level module icons keep their existing style.

Implementation scope: `src/style/layout.less`, reusing the existing ProLayout / Ant Design Vue selection classes without changing route matching or `openKeys`. Single-file Less rendering, seven selector / color / scope assertions, and `git diff --check` passed. Browser verification is pending because the browser connector reports `Codex auth token is unavailable`: check an unrelated selected route and each resource child route with the group both expanded and collapsed, including hover / focus. No Vue / TypeScript changed; lint, typecheck, and a full build were not run for this style-only patch to avoid unnecessary resource usage. If release verification requires a full build, run `rtk pnpm -C runtime-ui build` from the workspace root.

Text color tokens follow the product typography rules:

| Usage | Token | Value |
| --- | --- | --- |
| 标题以及主要文本 | `--text-color` | `#1A1A1A` |
| 次要文字 / 文本描述 | `--text-color-secondary` | `#6B7280` |
| 辅助文字 / 禁用 | `--text-color-disabled` | `#9CA3AF` |

Legacy text tokens such as `--jet-theme-text`, `--jet-theme-text-title`, `--jet-theme-text-secondary`, `--jet-theme-text-description`, `--jet-theme-text-disabled`, and `--ink-*` remain as compatibility aliases during migration.

Font size tokens keep `0.75rem` (12px) as the minimum. Prefer semantic aliases in page code:

| Usage | Token | Value |
| --- | --- | --- |
| 特殊强调标题 | `--fs-display`, `--fs-h1` | `1.5rem` |
| 板块内容标题 | `--fs-h2` | `1.375rem` |
| 特殊标题 / 自定义标题 | `--fs-h3` | `1.125rem` |
| 文案标题 / 弹窗标题 | `--fs-h4` | `1rem` |
| 主要内容文字 / 按钮文字 / 导航文字 | `--fs-body` | `0.875rem` |
| 小号正文 / 紧凑说明 | `--fs-sm` | `0.8125rem` |
| 提示文字 / 标签文字 / 次要文字 | `--fs-caption`, `--fs-meta`, `--fs-label`, `--fs-tiny` | `0.75rem` |
| 兼容标题别名 | `--fs-title`, `--fs-title-4` | `1.125rem`, `1rem` |

Spacing tokens use a 0.25rem (4px) scale. Prefer `--space-*` instead of ad hoc pixel values, and keep newly added spacing values as multiples of 4.

## Responsive Ant Design Vue Tokens

Ant Design Vue component sizes are scaled by `src/hooks/useResponsiveAntdToken.ts` before they are passed to `ConfigProvider` in `src/App.vue`.
The hook only affects Ant Design Vue theme tokens; `html` font size is controlled by the media queries in `src/style.css`, and JetLinks page styles should consume `--fs-*` / `--space-*` rem variables.

Default screen profiles are:

| Profile | CSS viewport | html font size | AntDV scale |
| --- | --- | --- | --- |
| 1K | `< 2048px` | `16px` | `1` |
| 2K | `>= 2048px` | `22px` | `1.33` |
| 4K | `>= 3840px` | `32px` | `2` |

HiDPI / DPR must not trigger Ant Design Vue component scaling. For example, a MacBook Retina Chrome viewport at `1440x900` stays in the 1K profile even when `devicePixelRatio` is `2`; only the browser CSS viewport crossing `2048px` or `3840px` changes the profile.

The responsive token currently overrides `fontFamily`, `sizeUnit`, `controlHeight`, `borderRadius`, `borderRadiusSM`, `borderRadiusLG`, and `lineWidth`. `fontSize` is intentionally kept at the Ant Design Vue base value because typography is already enlarged by the root `rem` media queries; multiplying the AntDV font token would double-scale text such as Tabs labels. Font family is passed to Ant Design Vue as `var(--jet-theme-font-family)`, while theme style tokens should store the concrete font stack such as `AliRegular, sans-serif`.

Update `src/style.css`, `src/hooks/useResponsiveAntdToken.ts`, and this README together when the 1K / 2K / 4K scale needs to change.

## Consistency Contract

`ThemeStyleToken` separates three responsibilities:

- Ant Design Vue token fields: required top-level fields such as `colorPrimary`, `colorBgContainer`, `colorText`, `borderRadius`, and `boxShadow`.
- JetLinks shell layout: optional `layout`, for menu variants and shell size decisions.
- CSS variables: optional `cssVars`, for JetLinks design primitives and shell-only variables.

`App.vue` passes only `pickAntdToken(themeStyleToken)` to Ant Design Vue. This prevents non-AntDV fields such as `label`, `layout`, or `cssVars` from being treated as component theme tokens.

`applyThemeStyle()` resets all known theme CSS variables before applying the selected theme. If a variable exists only in one theme, switching away from that theme removes it unless a default value is defined in `defaultThemeCssVars`.

Allowed `cssVars` names are constrained by `ThemeStyleCssVarName`. Prefer existing families:

- `--jet-theme-*` for JetLinks public theme variables.
- `--layout-*` for shell menu layout.
- `--chrome-*`, `--canvas`, `--bg`, `--line`, `--ink-*`, `--accent*` for existing design primitives.
- `--primary-color*` and `--text-color*` for the preferred theme and typography token names.
- `--space-*`, `--fs-*`, `--r-*`, `--shadow-*`, `--ring-*` for shared primitive scales.

## Less Variable Migration

Runtime theme styles must not depend on Less compile-time theme variables. Use the JetLinks CSS variables instead:

| Legacy Less variable | Runtime variable |
| --- | --- |
| `@primary-color` | `var(--primary-color, #1677FF)` |
| `@primary-color-hover` | `var(--jet-theme-primary-hover, #4096FF)` |
| `@primary-color-active` | `var(--primary-color-active, #0958D9)` |
| `@primary-2` or weak primary backgrounds | `var(--primary-color-1, #E6F4FF)` |

For old Ant Design CSS variables, prefer JetLinks first and keep Ant Design as a fallback:

```css
color: var(--primary-color, var(--ant-color-primary, #1677FF));
background: var(--primary-color-1, var(--ant-color-info-bg, #E6F4FF));
```

## Rules

- Do not put API requests or menu filtering in theme config.
- Do not mix Ant Design Vue token names into `cssVars`.
- Do not add new `@primary-color` usages for runtime theme styles.
- Prefer CSS variables over theme-specific selectors for JetLinks shell and page primitives.
- Add a new `menuVariant` only when CSS variables cannot describe the visual difference.
- Keep `styleTokens` as the runtime source of truth, even if theme files are split later.
