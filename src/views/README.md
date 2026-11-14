# Core 页面与页面族索引

本文件只索引 `jetlinks-web-core/src/views` 下的页面入口和页面族，不把每个内部 `.vue` 组件都当成路由页面。使用页面能力时，先核验路由配置、入口文件、相邻页面和实际 API；页面说明不能替代这些事实源。

## 页面入口

| 页面族 | 主要入口 | 业务/运行态职责 | 说明 |
| --- | --- | --- | --- |
| 账号中心 | `account/index.vue`、`account/center/index.vue` | 用户资料、密码、绑定、通知、个人 Token | [四入口个人中心](#账号中心)：复用账号、身份、SSO、令牌与通知能力 |
| 认证结果 | `account/identity-result/index.vue` | 身份认证结果展示 | 页面级反馈和回跳 |
| 数据能力实验室 | `data-capability/lab/index.vue` | 数据能力调试和验证 | 使用前核验能力注册中心与请求契约 |
| 初始化首页 | `init-home/index.vue`、`init-home/Basic/index.vue` | 首次初始化项目、基础信息、菜单和角色 | 具备初始化流程状态，不等同普通管理页 |
| 登录与重登录 | `login/index.vue`、`relogin/index.vue` | 登录、记住登录和会话恢复 | 登录页支持模块通过 `--jet-login-bg-image` 设置默认背景；私有化基础配置的自定义图优先。依赖认证、验证码和请求重连流程 |
| 微应用 | `mirco/iframe/index.vue`、`mirco/SubAppRedirect/index.vue` | 微应用 iframe 和跳转 | 核验宿主传参、路由和安全边界 |
| OAuth | `oauth/index.vue`、`oauth/WeChat.vue` | OAuth 授权与回调 | 依赖授权 API 和回跳参数 |
| 场景页 | `scene/index.vue`、`scene/Detail.vue` | 场景列表、创建引导和详情 | 先查看相邻页面组合，不把它当成通用 CRUD 模板 |
| 分享授权 | `share/authorize/index.vue` | 分享资源授权 | 核验分享上下文和权限动作 |
| Token 跳转 | `TokenJump/index.vue` | 带 Token 的入口跳转 | 入口参数和登录初始化边界 |
| 校验弹窗/页面 | `verify/index.vue` | 二次身份校验 | 通常由请求错误链路触发，不单独复制请求逻辑 |
| 错误页 | `Error/403.vue`、`Error/404.vue` | 无权限和路由不存在反馈 | 使用统一错误态和回退约定 |

## 基础配置与初始化共享布局

登录外观预览通过 `PlatformLoginPreview.vue` 复用实际登录页的 `login/components/LoginPageLayout.vue`、标题和账号表单，并按桌面比例缩放。真实登录与预览共用布局样式；预览不启动认证流程。此次布局对齐的验证见 [PlatformSettings 文档](../components/PlatformSettings/README.md)。

运行时 `/system/Basis` 与 `/init-home` 共享纵向卡片、逐行配置和登录页 / 顶栏草稿预览。设置页逐项保存，初始化页统一校验提交；窄屏外观字段与预览上下排列。SaaS 支持修改页签图标，仅对平台 `admin` 超管开放备案信息和登录背景，`base-path` 始终隐藏；私有化将 `base-path` 标为“接口基础地址”。主题及菜单布局不再作为本页编辑项，已有配置原样保留。组件契约见 [PlatformSettings](../components/PlatformSettings/README.md)。

Owning modules：`runtime-ui/jetlinks-web-core` 的 `src/components/PlatformSettings`、`src/hooks/usePlatformSettings.ts`、`src/hooks/useSystemPlatformSettings.ts`、`src/views/init-home`；`runtime-ui/modules/authentication-manager-ui/views/system/Basis`；`runtime-ui/modules/saas-runtime-ui/components/Tenant`。字段注册契约移到 core 公共入口，原入口兼容转导出；core 不导入 SaaS 业务。保存沿用 `front` / `amap` / `paths`，合并当前变更，保留隐藏字段、未知字段、主题和布局；失败保留草稿，成功后回读失败只刷新，不重复写入。

初始化保留 `submitBasic()`，按基础配置 → 菜单 → 角色 → 角色分组 → 初始数据 → 初始化标记顺序执行。`useInitialization.ts` 控制互斥、失败提示和按钮恢复；`Role/useInitializationRoles.ts`、`initData/useInitializationData.ts` 保留原有内容和载荷，修正异常导致 Promise 不结束、中间接口失败仍继续写入的问题。任一步失败停止后续步骤，已完成的接口写入不会回滚。

SaaS 自定义域名由 `saas-runtime-ui` 追加到 `system/basis:basic` 的 `basic` 之后，以摘要卡片和 `JlDrawerShell` 呈现。`useTenantDomain.ts` 与 `TenantDomainWizard.vue` 复用于摘要抽屉和旧域名页面，保留 `system/Domain` 别名。解析校验、证书上传、生效检测仍使用既有分步保存接口；关闭抽屉清除本地文件选择并刷新摘要，重新打开恢复服务器进度。删除二次确认；写入后刷新失败仅提供状态刷新。初始化不追加域名步骤。

验证（2026-11-12）：core 的 `node --test tests/platformSettings.test.mjs tests/inlineEditForm.test.mjs` 23 项通过，SaaS 的 `node --test modules/saas-runtime-ui/tests/tenantDomain.test.mjs` 6 项通过。覆盖保存/取消/失败重试/并发互斥、未知及隐藏字段保留、地图成对编辑、扩展渲染一次、初始化次序及每个接口失败中止、域名分步恢复。修改的 Vue SFC 均不超过 300 行；Vue、样式编译和中/英/日文案检查通过。

浏览器使用真实页面、组件和上传裁剪组件，配置及域名 API 使用模拟实现：私有化 / SaaS × 设置页 / 初始化页 × 1440 / 1280 / 390px 共 12 组均无页面横向溢出；预览草稿、取消、失败重试、地图编辑/清除确认、裁剪及上传期间禁止初始化、字段隐藏、只读权限、域名抽屉恢复/证书上传/删除确认、实际初始化宿主失败中止及成功跳转均通过。现有 9200 服务未登录会跳转登录页；未写入真实初始化、DNS 或证书接口，真实环境联调仍需管理员在可重置环境验证。

构建与静态检查：`pnpm build`、`pnpm build:standalone` 通过；根目录、runtime、core 和 authentication 模块的 `git diff --check` 通过。分别执行 `pnpm exec vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json`、`pnpm exec vue-tsc --noEmit -p modules/authentication-manager-ui/tsconfig.json`、`pnpm exec vue-tsc --noEmit -p modules/saas-runtime-ui/tsconfig.json`，全量检查仍分别有 511、540、382 条既有诊断（包括旧播放器、表格及路由类型）；本次共享组件、配置/初始化 hooks、页面适配器和域名组件没有诊断。全量类型检查尚未通过，需修复既有问题后重跑上述命令。运行时未配置独立 lint 或 `check:ui-style` 脚本；构建仍提示既有大包、三张资源图片解析警告及 visualization player 未构建（部署导出不可用）。本次不新增后端接口或迁移；按用户要求提交到当前分支，不推送或部署。

## 初始化角色授权

初始化角色的菜单查询与角色详情共用 `src/api/system/menu.ts#getMenuGrantDetail`，通过 `/menu/role/{roleId}/_grant/detail` 读取。`init-home/Role/useInitializationRoles.ts` 从 `result.menus` 匹配预置菜单，缺少菜单数组时不提交授权；顶层 `assetAccesses` 是已保存策略，不作为菜单树或预置授权候选。保留初始化角色原有的预置权限及保存载荷。

验证：`runtime-ui/modules/authentication-manager-ui` 中 `node --test tests/roleGrantDetail.test.mjs` 的 6 项回归通过，包含初始化角色的真实 setup/API 调用与预置菜单 ID 匹配；改动 API 的定向类型检查、权限模块生产构建和差异检查通过。未执行真实初始化写入、独立 lint 或全量 core 类型/构建检查；初始化页面仍需本地环境验收，全量复核命令为 `pnpm exec vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json` 与 `pnpm build`。

## 页面说明约定

新增或稳定调整的 core 页面，建议在页面目录增加 `README.md`，并在本索引挂载入口。至少说明：目标用户、进入后的第一任务、成功标准、入口/路由、关键 API 或数据源、Store/Hook、权限与回跳边界，以及不应借鉴的页面模式。

页面内部的 `components/`、`types.ts`、`constants.ts` 和局部 hook 是实现细节；只有形成跨页面稳定复用契约时，才提升到 `src/components`、`src/hooks`、`src/utils` 或 `src/store` 并更新对应分类索引。

## 会话续登

账号登录和重登录表单的回车与按钮都走原生表单提交，由 Ant Design Vue 校验后触发 `finish`。
不能调用表单实例未公开的 `submit()` 方法，也不另加键盘处理绕过校验。重登录请求、加密和验证码刷新归属
`relogin/components/useReloginForm.ts`，组件保留字段与布局。

`relogin/index.ts` 提供程序化入口 `openRelogin`，由 `src/main.ts` 传入请求初始化的 `handleReconnect`。入口负责独立 Vue 应用的创建、平台 Pinia 与国际化实例接入，以及成功、取消或异常后的卸载和容器清理。成功返回登录结果，由请求库重试原请求和等待队列；取消时先清除 token 和二次校验缓存、发起登录页跳转，再抛出 Axios `CanceledError`，使原请求和整个等待队列结束。不能以 `null` 返回取消结果，否则请求库直接清空等待队列，已排队的 Promise 会一直等待。弹窗仅通过 Modal 的 `cancel` 事件完成关闭，退出副作用统一由程序化入口执行。

无 token 时，`openRelogin` 直接拒绝创建弹窗；`src/package.ts` 的 `initAxios.tokenExpiration` 在私有化续登模式下比较失败请求携带的 token 与当前 token，取消旧凭证请求的迟到 401，避免退出后或新登录会话再次被旧请求打断。之后的新会话仍可正常续登，SaaS 保留直接跳转登录页的行为。范围仅为 runtime core，使用请求库公开回调，不修改依赖、后端或路由配置，也不依赖可视化模块。

验证：`node --test tests/relogin.test.mjs` 的 9 项测试通过，复用真实 Vue 生命周期、Pinia、国际化、`initAxios` 和已安装的 `AxiosService`，覆盖资源清理、并发取消、退出及新登录后的迟到 401、成功续登重试、下一会话续登和 SaaS 行为；`node scripts/test-application-runtime.mjs` 的 135 个场景通过。在 9202 私有化服务的隔离浏览器 origin 上，使用真实弹窗、登录页和三个后端 `/user/detail` 401 验证：退出一次后原请求与排队请求均取消，进入登录页后放行挂起响应，三个请求均结束且弹窗总打开次数保持 1、当前弹窗数为 0；未提交真实账号登录。

静态与编译检查：续登入口、弹窗和请求初始化的定向 Vite 生产编译、`git diff --check` 通过。`pnpm exec vue-tsc --noEmit -p tsconfig.json` 仍有 549 项既有诊断；编译进程以只读源码覆盖方式对照修复前版本，同为 549 项，无新增错误位置或错误类型（原有 `handleReconnect` 可选类型错误的对象摘要随回调签名变化）。当前未配置 lint 脚本；完整 `pnpm build:standalone` 未重跑，下文记录的既有 8GB 堆内存不足限制仍需发布前验证。

## 账号中心

个人中心提供“基本信息 / 个人令牌 / 消息中心 / 通知设置”四个入口。路由为 `/account/center?tab=<key>`，入口为 `account/center/index.vue`；运营端 `ui/modules/saas-manager-ui/views/personalCenter/index.vue` 与运行时 `runtime-ui/modules/saas-runtime-ui/views/PersonCenter/index.vue` 均复用各自工作区的 core 页面。

### 导航与布局

- `useCenter.ts` 负责当前用户资料、四页导航和辅助弹窗。`query.tab`、Store 页签和顶部消息定位保持兼容；旧 `Security`、`Sso`、`BindThirdAccount` 链接回到基本信息，`HomeView` 继续遵循应用用户限制。
- 优先通过 `useOptionalProjectSecondaryMenu` 注册“个人中心 / 消息”两组菜单；无框架菜单时使用 `ProjectSecondaryMenu`。分组使用 Ant `Menu/SubMenu`，一级使用用户和消息图标，二级使用系统 `icon-yuandian`，展开、选中与悬停继承公共菜单样式。
- 分组菜单通过公共 `--layout-menu-item-active-line-width` 变量关闭旧紧凑菜单的侧边选中线，选中背景、文字和图标沿用公共样式。
- 四页共用 `centerLayout.less` 的内容宽度、左右边距和响应式规则。个人令牌保留摘要插图并向卡片边缘渐隐；基本信息依据原型采用无额外插图区的资料布局。
- 基本信息采用单对象详情工作区：无需主筛选，首屏为“左侧姓名/账号/账号 ID，右侧头像 → 角色/组织/创建时间/最近登录 → 登录方式列表”。资料使用 `ContentPanel` 和 `Descriptions`，四个资料项使用语义图标，登录方式的普通图标使用统一浅色方形背景；姓名使用 `InputEditable` 就地编辑，头像使用 `ImageUpload` 裁剪，密码与联系方式使用现有弹窗，登录绑定操作在各行右侧；保持中等信息密度和现有侧栏，不增加统计卡或额外侧栏。
- `FullPage` 监听异步 `PageChrome` 的高度变化，消息页签出现后重新计算可用内容高度，避免额外外层滚动条。

### 页面与数据

| 页面 | 主要实现 | 行为与数据边界 |
| --- | --- | --- |
| 基本信息 | `components/BasicInfo.vue`、`useBasicProfile.ts`、`components/LoginMethods/` | 按原型纵向展示姓名、账号和账号 ID，右侧展示头像；下方展示角色、组织、创建时间和最近登录，登录方式沿用真实数据与操作。最近登录来自 `/user/detail` 的 `loginInfo.loginTime`，可能是本次登录，缺失或无效时显示 `—`。与系统统一使用“组织”称谓，职位入口已隐藏且不在个人中心展示，保留历史字段与关联；姓名就地编辑，头像支持公共裁剪组件 |
| 个人令牌 | `components/PersonalToken/` | API 请求头与安全说明、有效令牌列表、默认收起的失效分组；不展示 API 请求地址。详情、新建、编辑、重新生成及撤销复用既有接口 |
| 消息中心 | `components/StationMessage/` | 依真实 provider 和注册数据源分为通知/公告；通过 `ConditionFilter` 筛选内容、类型、状态和时间，支持详情、行操作及批量已读/未读 |
| 通知设置 | `components/Subscribe/` | 按真实消息类型和接收渠道显示勾选矩阵；列头显示渠道图标与配置入口，勾选即时保存，失败保留原选择并允许重试 |
| 联系方式 | `components/ContactDialog/`、既有 `AccountInfo/useContactInfo.ts` | 手机号/邮箱统一使用脱敏旧值、新值空白输入和验证码表单，底部统一提交；身份验证方式加载失败或未启用时明确提示并阻止提交，不退回未经验证的资料保存 |
| 安全设置 | `components/SecuritySettings.vue`、`useSecuritySettings.ts` | 复用原密码流程与服务端校验；读取真实密码更新时间，并通过当前用户操作日志接口展示最近 10 条已记录的账号登录 |
| 单点登录 | `components/BindThirdAccount/` | 列表显示接口返回的入口、绑定状态、绑定时间；保留微信/钉钉扫码绑定、其他入口跳转绑定与解绑 API，页面卸载清理授权订阅及窗口监听 |

### 消息中心内容与边界

- 方案：保留平台统一 ConditionFilter，补齐原型的消息类型、已读状态和时间选项。消息内容支持“包含”等现有文本条件；时间提供今天、近 7 天、近 30 天，移除对应条件即查询全部。界面继续使用平台现有筛选、列表和详情组件。
- 列表按真实通知 provider 归组；公告能力通过业务模块注册元数据发现，通道列表为空时也保留公告收件箱，数据继续由当前用户通知接口限定范围。core 不直接依赖公告模块，保留顶部通知跳转与消息详情注册扩展。
- “类型”筛选与表头使用同一文案。普通通知候选仍按 /notifications/providers 与 /notify/channel/all 合并；公告通过已注册接收源的 typeFilter 元数据使用真实 type 列及公告编辑页同一套选项，筛选不再提交 SystemBulletin 分类作为类型。列表优先展示接收接口的 type/typeText，并兼容历史枚举及快照；core 不写死公告类型值或文案。
- 筛选沿用平台的 ConditionFilter 和后端查询契约，进入消息中心及切换通知/公告时默认不附加筛选；主动从具体来源进入时只回填来源，不暗加未读条件。列表按状态、类型、标题与摘要、时间和操作组织。真实存在的已读 / 未读接口支持单条、所选和全部标记；缺少接口的删除不展示。
- 核心组件：资源中心同款 PageChrome flush + SlantedTabs、ConditionFilter、j-pro-table、j-badge-status 和既有详情弹窗。操作就近放在列表或页签工具区；沿用平台样式与中英文文案。
- 通知与公告共用 `NotificationRecord` 的列展示：状态列为公共徽标及其内边距预留宽度，状态文字保持单行；类型使用公共省略组件，长名称截断显示，窄屏继续通过表格内部横向滚动访问各列。
- 此前验证：三个个人中心定向测试文件共 47 项、公告注册测试 1 项通过，覆盖类型目录补全与去重、查询失败重试、通道缺失时的公告入口、平台筛选字段、自然日时间转换、类型与状态条件组合、顶部跳转和已读操作；组件脚本、模板及样式检查通过。本地登录环境已确认“类型”字段的真实候选、平台筛选入口和一条未读公告；未执行全量 lint、类型检查或构建，真实消息批量操作仍需业务环境验收。
- 本次局部调整：复用 PageChrome flush 与 SlantedTabs，不另写页面壳层；进入页面与切换分类均不恢复旧筛选，不默认追加未读条件。表格将 scroll.y 显式设为 false，避免共享表格回退到 100% 纵向滚动后生成多余横向容器；保留 x=820，使窄屏仍能访问其他列。标题列采用固定布局的截断，长内容不撑宽整表，筛选器取消不必要的最小宽度。
- 本次验证：messageCenterView.test.mjs 与 personalCenterFlows.test.mjs 共 42 项通过；3 个改动 Vue/TypeScript 文件的脚本、模板、样式与词条检查、差异空白检查通过。当前 9200 登录态已确认统一页签、默认空条件和宽屏空表无横向条。另用真实页面/表格/筛选组件及隔离的 registry/HTTP 响应完成 13 项检查：空表及长标题有数据时宽度均为 1328/1328px；切换分类、返回原分类与主动清除均不带隐含状态条件；390px 窄屏无整页横向溢出，表格内按需滚动。不执行全量 lint/typecheck/build，真实消息批量写入沿用既有边界，未在本轮操作；发布只更新运行时前端资源。
- 未实现：现有当前用户消息查询没有可靠的标题与正文联合搜索或消息删除能力；页面不展示这些原型操作。

待接入辅助逻辑：`account/center/components/StationMessage/components/NotificationRecord/components/useNotificationDetail.ts` 收拢详情加载、扩展组件就绪、确认及卸载后的迟到响应保护。现有 `ViewDialog.vue` 尚未引用此 hook，当前详情和已读行为保持原实现；接入时需验证加载失败、关闭弹窗、注册详情就绪与确认失败的边界，不能将文件入库视为功能已启用。当前完成 TypeScript 语法转译和差异检查，未执行该 hook 的行为回归、完整类型检查或构建。

### 通知设置接收方式

Owning module 为 `runtime-ui/jetlinks-web-core`，入口为 `account/center/components/Subscribe/{index.vue,useNotificationSettings.ts}`。渠道或消息模板未配置时，表头统一显示“去绑定”，空单元格及不完整配置的提示同步使用该文案，中、英、日资源保持一致；移除原不可用通知文案及管理员变体。不增加无权限按钮的禁用或提示逻辑，沿用现有菜单导航；邮箱、手机号与第三方接收账号绑定继续使用原流程。

可用渠道及订阅选择仍以 `/notify/channel/all` 和个人订阅接口为准。`src/api/account/notificationSubscription.ts#getNotificationNotifierConfigs_api` 通过现有 `/notifier/config/_query/no-paging` 只查询 `id/type/provider`，用于区分渠道和模板缺失，不读取通知器凭据或替代订阅数据。渠道缺失进入 `system/MessageNotification/Channels`，渠道已配置但模板缺失进入 `system/MessageNotification/Templates`，通过 `channel=type:provider` 定位对应页面。钉钉/微信个人接收使用工作通知，群机器人/服务号不能冒充；已有业务绑定优先使用真实通知器提供商。渠道查询失败保留重试反馈，不按空配置跳转，也不阻断已加载订阅的保存。

公共 `src/hooks/useNotificationConfigNavigation.ts` 保留独立标签打开及返回刷新。模板入口仅有一个待配置业务时携带真实记录 ID，多业务或多资产范围时进入模板目录选择；继续传递 `topicProvider/channelProvider`。不修改后端接口、订阅保存契约、通知发送、通知模块或运营端 `ui/`，不新增单元格按钮。模板接收页及迁移边界见 [通知模块说明](../../../modules/notify-manager-ui/README.md)。

验证（2026-11-13）：core 中执行 `node --test src/views/account/center/personalCenterFlows.test.mjs src/views/account/center/notificationSettingsView.test.mjs`，65/65 通过，覆盖五类渠道缺失、仅模板缺失、具体业务/多范围、接收账号绑定、真实提供商及枚举字段、查询失败/无效响应、返回刷新和保存重试。浏览器使用真实 Vue、公共表格、Ant Design、页面、API 封装及导航 hook，验证五类渠道各自的渠道/模板共 10 次实际新标签跳转、返回刷新、联系方式事件、查询字段及三语文案；接口使用隔离响应，无脚本错误或真实业务网络请求。截图及报告位于 `/tmp/notification-binding-browser/`，本轮未将完整移动端布局作为验收项。

在 `runtime-ui/` 执行 `pnpm build --outDir /tmp/notification-binding-build` 通过（1 分 54 秒，包含 visualization player），保留已有资源路径、循环分块、CSS 注释和包体积警告。`pnpm exec vue-tsc --noEmit --pretty false -p jetlinks-web-core/tsconfig.json` 修改前后均为 513 项既有诊断，忽略行列后完全一致，无新增；全量类型检查尚未通过，修复既有问题后需重跑该命令。工作区无独立 lint 脚本，变更差异空白检查通过。真实登录账号与后端未联调；通过 `pnpm dev` 在 `/account/center?tab=Subscribe` 复验渠道配置、模板配置及个人接收账号绑定后的返回刷新。

### 公共组件与交互契约

- 基本信息中的角色和组织使用首项标签及剩余数量保持单行，鼠标移入或点击可在弹层中查看完整列表；长名称在摘要中省略，弹层内完整展示并限制高度。实现位于 `account/center/components/BasicInfo.vue`；页面交互待用户验收。
- 姓名使用公共 `InputEditable` 的图标入口：鼠标悬停或键盘聚焦时显示编辑图标，点击后进入输入框；Enter 或失焦保存、Esc 取消，异步保存失败保留输入。资料和头像通过 `PUT /user/detail` 保存；头像复用 `ImageUpload` 的 `value/update:value` 与 `cropperProps`，执行 1:1 裁剪；鼠标悬停或键盘聚焦时在头像中央显示更换图标。
- 登录方式使用 Ant 列表和按钮。手机号、邮箱资料不等于已验证登录身份；只有 `/user/identity/_me` 返回身份时才显示已验证。联系方式的列表、弹窗说明和通知接收提示统一经 `contactPresentation.ts` 脱敏，修改弹窗不预填旧值，用户主动输入的新值用于验证与保存。`ContactDialog/useContactDialog.ts` 组合资料与验证逻辑，共用一个联系方式字段和一组底部操作；验证码只用于发起验证的原始地址，验证或保存失败不关闭弹窗。身份确认成功后资料保存失败，当前个人中心页内按账号保留待保存的新值；关闭重开弹窗后重新输入同一个值可补存资料，不重复消费验证码，保存成功或账号切换即清除，不写入浏览器存储。旧身份管理保留在既有账号资料页，绑定弹窗不再叠加独立身份管理表单。
- 第三方账号由 `useSsoBindings.ts` 加载，`BindThirdAccount/SsoAuthorization.vue` 承接授权弹层。扫码绑定后读回真实状态；卸载时清理订阅和监听。配置链接遵循当前用户菜单权限，缺失状态和时间不推断补齐。
- 登录配置入口按 `useBasicLayoutVariant` 区分：运营端显示“系统管理 › 应用管理”并跳转 `system/Apply`，项目/应用端显示“开放与集成 › 单点登录”并跳转 `system/ThirdPartyLogin`；无对应菜单权限时仅显示说明文字，中、英、日资源同步。
- 密码弹窗复用公共表单与页脚，`EditPassword/usePasswordValidation.ts` 区分当前密码校验失败与请求失败；强度和实际提交仍由现有服务端契约决定。
- 令牌权限保留跟随账号、只读和自定义模式，以及原 Scope、dimensions、attributes、ID/sourceId。编辑不轮换凭证；独立“重新生成”入口确认后使用 `revokeAccessTokens=true`，保留原名称、说明和 Scope，仅更新有效期。新建及重新生成支持预设、自定义时间和永不过期。
- 有效与失效令牌复用 `TokenCard.vue`，左侧依次展示名称与权限、脱敏令牌与有效期、说明三个层次；令牌与有效期使用公共分隔线分组，说明过长时省略。右侧撤销操作相对整行垂直居中；窄屏时下层信息可自然换行，页面效果待用户验收。脱敏值使用公共 Typography 的等宽普通文本，令牌和有效期使用图标并在移入时显示各自提示，说明单独以文字展示，不使用代码框。说明为空或只有空白时显示“未配置说明”；剩余 7 天内的有效令牌，其日期文字与日历图标跟随公共 Typography 的 `warning` 状态，页面不覆盖颜色，剩余天数按本地自然日计算，未知状态不伪装为有效。完整凭证只在创建或重新生成后的成功弹窗展示，撤销失败保留记录。
- 令牌详情沿用公共 `JlDrawerShell`：垂直标签的 `Descriptions` 先展示脱敏令牌及一次性展示提示、说明，再将创建时间与过期时间并排；临期剩余天数使用框架警告文字。权限作为独立下方区段，标题旁显示权限模式，继续复用原权限搜索、列表及底部编辑/重新生成操作。
- 消息使用 `j-pro-table`、`buildQueryFilter` 和当前用户消息接口，先按后端能力过滤可用 provider。筛选不隐含追加未读条件；批量只提交选中 ID，“全部标为已读”只处理当前分类。独立数据源的详情确认和类型筛选继续遵循其注册契约。
- 通知接收账号与第三方登录绑定分别管理。渠道名称与通知渠道页共用 `/notify/channel/providers` 的 `i18nName / name`；钉钉/微信接收账号按通知器 ID 匹配。站内信不悬浮显示当前用户名，其余渠道保留实际接收账号提示。保存保留既有 topicConfig、默认订阅和其他渠道选择，查询失败不写回空配置。
- 中、英、日资源同步维护。保留通过 `src/router/globModules.ts` 收集的旧 `index.vue` 页面及对外 API，兼容既有动态路由和相邻模块；内部废弃组件不作为兼容入口保留。

### 后端能力边界

- 当前未实现原型中的“最多 10 个有效令牌”限制。失效分区只能展示查询接口仍返回的过期/停用记录；撤销接口直接删除记录，无法提供已撤销历史、撤销时间或最近使用记录。列表与详情仅在 `PersonalTokenInfo.accessTokenHint` 有值时展示脱敏标识，界面统一称为“令牌”；后端保留实际主凭证的前 10 位与后 4 位，中间使用 `****`。新建/重新生成更新标识，普通编辑保留、单独重置清空，临时凭证不覆盖标识。旧接口或历史无标识记录不展示该行，不使用记录 ID 替代。须配套升级鉴权模块及 `s_personal_token.access_token_hint` 可空列。
- 告警严重/一般过滤和免打扰缺少已确认的个人偏好持久化与投递契约，页面不提供不能实际生效的偏好开关。未声明个人订阅支持的 WebHook 等渠道继续由服务端策略决定。
- 手机号/邮箱弹窗先检查 mobile/email 身份提供商，未启用或查询失败时禁止发送与提交。提供商存在不代表渠道一定可用：验证码实际发送仍依赖对应通知器、验证码模板和通知服务；发送接口失败时显示对应错误，不进入倒计时或报告成功。先确认身份，再保存用户资料的两个请求无法形成服务端原子事务，保存失败时保留已确认状态供重试。既有登录身份不自动解绑，原子替换旧身份仍需统一后端契约。密码修改后的跨设备下线仍需真实账号联调。

### 验证与部署

静态引用核对和差异检查通过；按用户要求，本次未重新运行测试、lint、类型检查、构建或浏览器验收。相关用例保留在 `account/center/*.test.mjs`、联系方式和令牌组件的相邻测试中，由后续验收执行。

发布需要更新使用该 core 的前端静态资源；无新增后端服务重启或数据迁移要求。完整检查可在对应的 `ui/` 或 `runtime-ui/` 工作区执行 `pnpm exec vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json` 与 `pnpm build`；当前 core 未配置独立 lint 脚本。

四页改版与清理的实现提交：`d18caf91`，入口为 [PR #232](https://github.com/jetlinks-v2/jetlinks-web-core/pull/232)；运营端配置入口、菜单和联系方式绑定修复的实现提交：`a666b910`，入口为 [PR #233](https://github.com/jetlinks-v2/jetlinks-web-core/pull/233)。目标分支均为 `2.20`。
