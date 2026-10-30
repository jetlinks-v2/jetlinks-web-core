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
| 布局与侧边栏用户菜单 | [layout/components/LayoutSidebarUser.vue](layout/components/LayoutSidebarUser.vue) | [style/layout.less](style/layout.less) | 头像摘要、主/子账号标签与纵向快捷入口；退出加载保持各行等高。 |
| 通知下拉面板 | [layout/components/NoticeInfo.vue](layout/components/NoticeInfo.vue) | `layout/components/Notice.vue` | 消息与未读摘要、通知/公告分类、紧凑消息列表和统一消息中心入口；正文按视口限高滚动。 |
| 整页高度与滚动 | [layout/FullPage.vue](layout/FullPage.vue) | `layout/components/RouteContentSurface/index.vue`、`components/ContentPanel/index.vue` | 页面高度、祖先底部间距及窗口缩放；生产入口包括角色页和组织页。 |

当前用户菜单的实现与验证边界见下文“顶部用户菜单”。

历史交付入口：退出菜单提交 `aebcab1`，构建内存配置提交 `1def30c`；PR https://github.com/jetlinks-v2/jetlinks-web-core/pull/164。

## 顶部用户菜单

运行时 `layout/components/LayoutSidebarUser.vue` 使用 240px 紧凑纵向下拉：顶部以头像配合姓名、账号两行身份摘要，账号下方集中展示主/子账号与用户类型标签，角色在有数据时补充展示；下方依次提供个人中心、消息中心、个人令牌，退出登录独立分隔。复用 Ant Design Vue 下拉、按钮和角标、项目 `AppTag` 与主题 token，保留 `sidebarUserMenu` 扩展位，长账号与角色名称单行省略。

账号判断复用 `/user/detail` 返回的 `type.id` 及 `store/user.ts` 的 `isSubAccount`：`subAccount` 显示“子账号”，其他情况沿用既有“主账号”逻辑；标签使用现有中英文词条。摘要将账号与用户类型、角色拆行展示，避免长项目账号挤掉用户类型。接口 type.name 使用中性标签完整显示并允许换行，主/子账号使用蓝色标签；两者集中在账号下方，角色只省略自身长名称；与主/子账号标签或用户类型同名的信息不重复展示。后端接口与权限规则无需调整。

`layout/components/useLayoutSidebarUser.ts` 承接展示派生、入口导航和退出状态；消息角标复用 `useHeaderNotice.ts` 写入 `store/user.ts` 的未读结果，不另建查询或实时订阅。入口沿用 `account/center` 路由及 `CenterTabKey`，每次导航同时携带规范化的 query.tab 与兼容旧入口的 params.tabKey；BindThirdAccount 映射为 BasicInfo。内容及 Store 由个人中心的 URL 监听统一同步，避免同页导航清空 query 后被框架侧栏恢复为默认页，也避免 Store 与路由竞争更新。项目覆盖页复用 core 个人中心，显式导航继续清除旧通知上下文。按用户要求，本次直接修复，未重复复现或运行检查/构建。

验证：两处 Vue 脚本与模板、相关 TypeScript 语法、布局 Less 和中英文词条检查通过，差异空白检查通过。使用实际菜单组件、菜单 hook、AppTag、项目个人中心和 Ant Design Vue，在同一个浏览器页完成 30 项隔离交互检查，覆盖 240px 布局、375px 长名称、角标 0/7/99+、中英文、主/子账号标签、三个入口及重复导航、旧通知清理、退出加载等高、防重复点击、失败恢复与成功回跳；浏览器没有错误或警告。接口、Store 宿主与业务子组件使用替身，尚未进行真实主/子账号登录及后端退出联调。

顶部排版验证：实际菜单 Vue 模板、hook、AppTag 与布局 Less 的定向编译通过，差异空白检查通过。22 项浏览器组件检查通过，覆盖头像和姓名对齐、中文身份标签同排、用户类型的中性层级、长账号、375px 窄屏、长英文类型换行、主/子账号、空类型及 16/18px 根字号；补充验证长角色独立省略且不遮挡用户类型。浏览器没有错误或警告；使用隔离账号数据，真实登录态仍待验收。

工作区没有独立 lint 脚本；遵循设备性能约束，本次没有运行全量 typecheck/build。发布前在 `runtime-ui/` 执行 `pnpm exec vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json` 和 `pnpm build`，并补充真实登录态验收。仅需发布运行时前端静态资源，无后端服务重启要求。

## FullPage 高度约束

高度契约：`layout/FullPage.vue` 累加组件自身的底部 `margin` 与祖先容器实际的底部 `padding`、边框，并与 `padding` prop 的预留值取较大值，再额外扣除 `extraHeight`；所有模式在窗口缩放时重新计算。`fixed=false` 继续使用最小高度并允许内容自然增长，`flex` 模式保留既有溢出补偿；各页面无需单独配置底部间距。改动仅位于运行时共享组件，不涉及业务接口、路由或运营端 `ui/`。

浏览器验证：`modules/authentication-manager-ui/views/system/Role/index.vue` 和 `Department/index.vue` 的根节点高度从 `903px` 恢复为视口高度 `899px`，角色页维持默认非 `flex` 配置，组织页两个嵌套 `FullPage` 均正确取高。角色页在 `1536×899`、`1440×800`、`1280×720` 下根节点溢出均为 `0px`，表格内部滚动、分页和左栏收起/展开正常。已有 `Role/Detail/index.vue` 的 `flex` 模式根节点无溢出；`Menu/index.vue` 的 `fixed=false` 模式使用 `767px` 最小高度，长内容自然增长至 `819px`，未裁切内容。

编译与类型验证：`pnpm -F jetlinks-web-core build -- --module-name authentication-manager-ui` 通过（53.70 秒），`git diff --check` 通过；`FullPage.vue` 为 135 行。`pnpm exec vue-tsc --noEmit -p modules/authentication-manager-ui/tsconfig.json` 仍报告改动前相同的 605 项工作区诊断，输出逐字一致，`FullPage.vue` 无诊断；当前未配置 lint 脚本。

## 顶部消息弹层

顶部未读角标使用 Badge 小尺寸，并向按钮内侧、下方偏移，为顶栏上沿留出间距；铃铛点击区域继续保持 2rem。

登录通知扩展计划：`layout/components/noticeLoginHandler.ts` 提供业务中立的 `notification-login:handlers` 注册消费入口；`useHeaderNotice.ts` 在通知通道首次初始化成功后按 provider 顺序执行一次，并只传递 provider 集合、应用上下文和刷新回调。具体公告查询、弹窗文案、详情组件和已读写入仍由业务模块负责，core 不识别 `SystemBulletin` 或调用公告接口。该扩展不在通道重试、铃铛展开或实时通知刷新时重复执行。

业务模块还可在 `notification-provider:default` 注册项中提供 `metadata()` 和 `dataSource`，为不写入通用通知收件箱的消息提供独立接收入口。`dataSource` 负责查询、未读统计、状态确认、全部确认以及可选的本地状态/实时订阅；`layout/components/noticeListHandler.ts` 将铃铛、个人中心和角标请求分派到对应数据源，未注册分类继续使用原通知接口。共享 core 不保存业务确认数据，也不识别具体公告接口、Topic 或存储键。

独立数据源可声明 `confirmOnDetail: true`，让原详情确认按钮在成功写入业务确认状态后关闭；关闭或取消不确认。`subscribe` 与 `subscribeRealtime` 都必须返回释放函数，分类变化、账号变化或 Vue Scope 销毁时由 core 取消监听。接收分类通过 `metadata()` 合并，不要求当前用户拥有对应发送通道配置；订阅设置仍只读取真实通道。

本次按现有顶部消息弹层做局部改版：保留铃铛、当前用户消息接口、实时订阅和详情接管，内容按“消息标题与未读摘要 / 通知与公告 / 紧凑摘要列表 / 进入消息中心”组织。沿用 Ant Design Tabs、Dropdown、Button 和主题色、圆角、边框；不改导航框架或后端通知规则。

实现入口为 layout/components/Notice.vue、NoticeInfo.vue、NoticeItem.vue；查询、分类、失败重试和跳转归属 useHeaderNotice.ts，分类工具与消息类型归属 noticeUtils.ts。分类依据与消息中心相同的真实 provider 目录及公告注册元数据；整行打开原详情流程，底部进入当前分类的消息中心。列表限高滚动，未读数量继续复用用户 Store，空态与请求失败分别反馈。 底部入口使用 Ant Design RightOutlined，箭头按主题小字号渲染并继承链接颜色，与文字通过 inline-flex 和统一间距居中对齐；图标自身使用 1em 方形 flex 容器与零行高，消除内联 SVG 基线预留导致的垂直偏移。垂直对齐验证直接加载 9200 当前源码及平台字体：默认字号下 SVG 与文字中心偏差为 0px，18px 根字号及 390px 窄屏下约 0.008px；当前登录态页面已目视确认。弹层默认沿用 Ant Design 的 document.body 挂载，避免顶部栏的图标颜色、字号及行高进入消息正文；显式 getPopupContainer 仍优先采用调用方容器。此前隔离预览未覆盖顶部栏的真实样式边界。补充验证已直接在用户使用的 localhost:9200 登录页签中完成：修改前按钮为蓝色、箭头最终为黑色 18px，默认挂载恢复后，运行页面的箭头显示为与文字一致的蓝色小图标，弹层仍正确对齐铃铛。该修复只改变默认挂载边界，无需重启后端。

验证：headerNotice.test.mjs 与 noticeUtils.test.mjs 共 17 项通过，覆盖真实分类、无通道公告、目录部分失败、未读数量保留、列表失败重试、迟到响应、原详情接管和消息中心导航。5 个改动 Vue/TypeScript 文件的脚本、模板、Less、中英文词条与行数检查通过，noticeUtils.ts 定向严格 TypeScript 检查与差异空白检查通过。隔离浏览器以真实消息组件及 Ant Design、模拟接口完成 20 项检查，包含 380px 桌面弹层、390px/500px 高窗口、中英文、摘要与标题截断、独立滚动、底部入口固定、整行点击、分类跳转、错误/空态及重试；控制台无警告或错误。

顶部“通知”和“公告”页签统一查询当前用户的有效未读接口，最多请求 12 条；业务注册的历史列表加载器不参与顶部查询，公告标题与摘要仍由注册文本解析器补齐。已读历史进入消息中心查看，不追加到未读弹层中。未读查询修复的定向验证：headerNotice.test.mjs 与 noticeUtils.test.mjs 共 24 项通过，覆盖注册加载器存在时也不追加已读历史、无未读时保留空列表以及原详情入口；差异空白检查通过。当前登录页有待确认的公告弹窗，未操作其已读状态，真实弹层列表仍待刷新验收。未配置独立 lint 脚本，按设备性能约束未执行全量 typecheck 或构建；真实后端消息收取及各业务详情仍需登录环境验收。发布前在 runtime-ui 执行 pnpm exec vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json 和 pnpm build；上线仅更新运行时前端资源，无后端重启要求。

## 弹窗样式边界

`style/components.less` 的表单弹窗内边距、标题分隔线和底部栏样式只适用于 `.ant-modal:not(.ant-modal-confirm)`；确认、警告、信息等静态弹窗沿用 Ant Design 的标准留白和按钮布局，统一圆角仍读取主题变量。普通表单弹窗继续保留原有标题、正文和底部栏规则。

## 文档维护约定

- 新增或稳定调整的公共能力，先在对应分类索引增加一行，再在能力目录或文件旁增加简要说明。
- 单项说明至少写清：解决的问题、适用/不适用场景、实际导入路径、关键参数或返回值、副作用、最小示例和一个生产用法定位。
- 需要区分根入口、全局注册和深层路径时，明确标注“根入口导出”“全局注册名”或“仅深层路径”。
- 页面说明只描述终端用户任务、页面入口、关键状态和真实数据来源；不要把临时排查记录或设计草稿放入这里。
