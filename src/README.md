# `@jetlinks-web-core` 能力文档导航

本目录是 JetLinks 前端 core 层的能力入口。本文只做分类导航；具体 Props、参数、返回值、状态和副作用以分类索引、源码导出和生产用法为准。

## 阅读顺序

1. 根据任务类型打开下面对应的分类索引。
2. 从分类索引选择 1～3 个候选能力，再打开候选目录或文件旁的说明文档。
3. 用对应的 `index.ts` 核验根入口导出；文档、目录名和全局注册名都不能单独证明 API 可用。
4. 查看目标页面或相邻生产代码，确认当前版本的真实调用方式。
5. 文档与源码或生产代码冲突时，以源码导出和生产代码为准；文档缺失不代表能力不存在。

## 分类索引

| 任务类型 | 索引 | 事实源 | 说明 |
| --- | --- | --- | --- |
| 项目级组件、页面壳和交互封装 | [components/README.md](components/README.md) | [components/index.ts](components/index.ts) | 组件场景映射、注册名、具名导出和单组件 README |
| 可复用响应式逻辑 | [hooks/README.md](hooks/README.md) | [hooks/index.ts](hooks/index.ts) | Hook 用途、根入口/深层路径和副作用边界 |
| 通用函数、运行时和数据转换 | [utils/README.md](utils/README.md) | [utils/index.ts](utils/index.ts) | 工具按场景分组，标记根入口与深层路径 |
| 跨页面共享状态 | [store/README.md](store/README.md) | [store/index.ts](store/index.ts) 及各 store 源文件 | Pinia store 的职责、状态范围和导出事实 |
| 模板指令 | [directive/README.md](directive/README.md) | [directive/index.ts](directive/index.ts) | 指令安装、菜单条件渲染及编译边界 |
| core 页面和页面族 | [views/README.md](views/README.md) | `views/**`、路由入口和相邻页面 | 页面目标、入口、状态流和可复用能力 |
| 智能体契约与能力扩展 | [首页智能体能力扩展](../docs/首页智能体能力扩展.md) | `layout/components/AiChat/agentConversationContracts.ts`、`generalAgentExtensions.ts` | 业务工具、工作流和展示语义注册；UI provider 按公共契约接入，不反向依赖具体 UI 模块 |
| 布局与侧边栏用户菜单 | [layout/components/LayoutSidebarUser.vue](layout/components/LayoutSidebarUser.vue) | [style/layout.less](style/layout.less) | 退出登录时以 `a-spin` 替换图标，并固定图标容器尺寸，保持菜单项与账户中心等高。 |
| 通知下拉面板 | [layout/components/NoticeInfo.vue](layout/components/NoticeInfo.vue) | `layout/components/Notice.vue` | 页签溢出时使用 Ant Design Tabs 自带的横向滚动；左右留白放在外层导航栏，避免影响可视容器的宽度计算。 |
| 整页高度与滚动 | [layout/FullPage.vue](layout/FullPage.vue) | `layout/components/RouteContentSurface/index.vue`、`components/ContentPanel/index.vue` | 页面高度、祖先底部间距及窗口缩放；生产入口包括角色页和组织页。 |

侧边栏用户菜单验证：`LayoutSidebarUser.vue` 的模板、脚本及 `style/layout.less` 独立编译通过，`git diff --check` 通过。全量 `vue-tsc` 仍有其他文件的既有错误，目标组件未报错；当前没有 lint 脚本。`pnpm -F jetlinks-web-core build` 完成 23,923 个模块转换后，在当前 `package.json` 的 8GB V8 堆上报 `JavaScript heap out of memory`，构建未通过，发布前需解决内存上限并重新构建。真实退出交互和两个菜单项在加载期间的等高效果仍待验证。

交付入口：退出菜单提交 `aebcab1`，构建内存配置提交 `1def30c`；PR https://github.com/jetlinks-v2/jetlinks-web-core/pull/164。

## FullPage 高度约束

高度契约：`layout/FullPage.vue` 累加组件自身的底部 `margin` 与祖先容器实际的底部 `padding`、边框，并与 `padding` prop 的预留值取较大值，再额外扣除 `extraHeight`；所有模式在窗口缩放时重新计算。`fixed=false` 继续使用最小高度并允许内容自然增长，`flex` 模式保留既有溢出补偿；各页面无需单独配置底部间距。改动仅位于运行时共享组件，不涉及业务接口、路由或运营端 `ui/`。

浏览器验证：`modules/authentication-manager-ui/views/system/Role/index.vue` 和 `Department/index.vue` 的根节点高度从 `903px` 恢复为视口高度 `899px`，角色页维持默认非 `flex` 配置，组织页两个嵌套 `FullPage` 均正确取高。角色页在 `1536×899`、`1440×800`、`1280×720` 下根节点溢出均为 `0px`，表格内部滚动、分页和左栏收起/展开正常。已有 `Role/Detail/index.vue` 的 `flex` 模式根节点无溢出；`Menu/index.vue` 的 `fixed=false` 模式使用 `767px` 最小高度，长内容自然增长至 `819px`，未裁切内容。

编译与类型验证：`pnpm -F jetlinks-web-core build -- --module-name authentication-manager-ui` 通过（53.70 秒），`git diff --check` 通过；`FullPage.vue` 为 135 行。`pnpm exec vue-tsc --noEmit -p modules/authentication-manager-ui/tsconfig.json` 仍报告改动前相同的 605 项工作区诊断，输出逐字一致，`FullPage.vue` 无诊断；当前未配置 lint 脚本。

## 通知页签滚动

通知入口的通道查询、未读角标和实时事件由 `layout/components/useHeaderNotice.ts` 管理。
接口失败时保留已有角标，在通知面板提示失败并提供重试；空通道才显示空态，不将后台请求拒绝留作未捕获异常。

运行时 `layout/components/NoticeInfo.vue` 将页签栏的左右内边距放在 `.ant-tabs-nav`，保持 `.ant-tabs-nav-wrap` 的实际可视宽度与 Ant Design 测量结果一致。通知类型超出可视范围时，使用 Tabs 自带的横向滚动、滚轮和溢出菜单访问右侧页签。通知查询、角标、Tab 切换与“查看更多”逻辑保持原有行为，不涉及接口或运营端 `ui/`。

验证：在 `1536×899` 的现有开发页面上，5 个通知页签可向左、向右滚动，也可通过纵向滚轮横向移动；滚动位移为 `0～-72px`，最右侧“业务监控”完整可见，两端页签切换正常，弹层宽度仍为 `384px`。组件模板、TypeScript 转译、scoped LESS 编译及独立 Vite 生产构建通过，`git diff --check` 通过。`pnpm exec vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json` 报告 556 项工作区既有诊断，`NoticeInfo.vue` 无诊断；当前未配置 lint 脚本。完整应用生产构建未执行，发布前待运行 `pnpm -F jetlinks-web-core build`。

## 文档维护约定

- 新增或稳定调整的公共能力，先在对应分类索引增加一行，再在能力目录或文件旁增加简要说明。
- 单项说明至少写清：解决的问题、适用/不适用场景、实际导入路径、关键参数或返回值、副作用、最小示例和一个生产用法定位。
- 需要区分根入口、全局注册和深层路径时，明确标注“根入口导出”“全局注册名”或“仅深层路径”。
- 页面说明只描述终端用户任务、页面入口、关键状态和真实数据来源；不要把临时排查记录或设计草稿放入这里。

## 独立通知接收数据源

业务模块可在 `notification-provider:default` 注册项的 `props` 中提供 `metadata()` 和 `dataSource`。`metadata()` 返回 `{ provider, name, type: { id, name } }`，只参与消息接收分类；订阅设置继续查询真实通道配置。分类内的 Provider 共用一个数据源，独立数据源使用自己的分类标识。

`dataSource` 提供 `query(params)`、`unreadCount(params)`、`changeState('_read' | '_unread', ids)`、`readAll()`，可选 `queryNoPaging(params)` 与 `count(params)`；查询返回兼容通知记录的分页响应，未读数返回 `{ count, overflow }`。个人中心、铃铛已读操作和角标通过 `layout/components/noticeListHandler.ts` 分派；未注册的数据仍使用原通知接口。多分类未读汇总会排除普通收件箱中的已接管 Provider，避免重复统计。已有 `listHandler` 可继续控制铃铛列表顺序，数据源失败不会回退为另一份收件箱数据。

数据源可声明 `confirmOnDetail: true`，让个人中心原有详情确认按钮调用该数据源的 `changeState('_read', [id])`；确认成功才关闭，关闭和取消不确认。未声明时保持原有仅关闭行为。可选 `subscribe(listener): unsubscribe` 将业务模块的状态变化通知接收入口；`useNoticeDataSourceChanges(() => providers, refresh)` 仅通过 `@jetlinks-web-core/layout/components/noticeListHandler` 深层导入，在分类切换或 Vue Scope 释放时取消订阅。core 不保存业务确认数据；存储隔离、跨标签页事件和具体状态语义由注册模块负责。生产消费者为 `NoticeInfo.vue`、个人中心 `NotificationRecord/index.vue` 与各端顶栏实现。
