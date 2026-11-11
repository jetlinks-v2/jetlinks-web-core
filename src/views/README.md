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

## 初始化角色授权

初始化角色的菜单查询与角色详情共用 `src/api/system/menu.ts#getMenuGrantDetail`，通过 `/menu/role/{roleId}/_grant/detail` 读取。`init-home/Role/index.vue` 从 `result.menus` 匹配预置菜单，缺少菜单数组时不提交授权；顶层 `assetAccesses` 是已保存策略，不作为菜单树或预置授权候选。保留初始化角色原有的预置权限及保存载荷。

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

运行时个人中心提供“基本信息 / 个人令牌 / 消息中心 / 通知设置”四个入口。路由为 `/account/center?tab=<key>`，入口为 `account/center/index.vue`；SaaS 的 `modules/saas-runtime-ui/views/PersonCenter/index.vue` 复用同一页面。

### 导航与布局

- `useCenter.ts` 负责当前用户资料、四页导航和辅助弹窗。`query.tab`、Store 页签和顶部消息定位保持兼容；旧 `Security`、`Sso`、`BindThirdAccount` 链接回到基本信息，`HomeView` 继续遵循应用用户限制。
- 优先通过 `useOptionalProjectSecondaryMenu` 注册“个人中心 / 消息”两组菜单；无框架菜单时使用 `ProjectSecondaryMenu`。分组使用 Ant `Menu/SubMenu`，一级使用用户和消息图标，二级使用系统 `icon-yuandian`，展开、选中与悬停继承公共菜单样式。
- 四页共用 `centerLayout.less` 的内容宽度、左右边距和响应式规则。基本信息与个人令牌共用摘要布局及本地插图，插图延伸到摘要边缘并由右向左渐隐；窄屏隐藏装饰图。
- `FullPage` 监听异步 `PageChrome` 的高度变化，消息页签出现后重新计算可用内容高度，避免额外外层滚动条。

### 页面与数据

| 页面 | 主要实现 | 行为与数据边界 |
| --- | --- | --- |
| 基本信息 | `components/BasicInfo.vue`、`useBasicProfile.ts`、`components/LoginMethods/` | 当前用户身份摘要、组织资料及登录方式；缺少角色、所属部门或职位时只提示实际缺项。姓名就地编辑，头像支持公共裁剪组件 |
| 个人令牌 | `components/PersonalToken/` | API 请求头与安全说明、有效令牌列表、默认收起的失效分组；不展示 API 请求地址。详情、新建、编辑、重新生成及撤销复用既有接口 |
| 消息中心 | `components/StationMessage/` | 依真实 provider 和注册数据源分为通知/公告；通过 `ConditionFilter` 筛选内容、类型、状态和时间，支持详情、行操作及批量已读/未读 |
| 通知设置 | `components/Subscribe/` | 按真实消息类型和接收渠道显示勾选矩阵；列头显示渠道图标与配置入口，勾选即时保存，失败保留原选择并允许重试 |

### 公共组件与交互契约

- 姓名使用公共 `InputEditable` 的文字入口：Enter 或失焦保存、Esc 取消，异步保存失败保留输入。资料和头像通过 `PUT /user/detail` 保存；头像复用 `ImageUpload` 的 `value/update:value` 与 `cropperProps`，执行 1:1 裁剪。
- 登录方式使用 Ant 列表和按钮。手机号、邮箱资料不等于已验证登录身份；只有 `/user/identity/_me` 返回身份时才显示已验证。联系方式修改弹窗复用 `AccountInfo/useContactInfo.ts`，身份验证逻辑保留在 `ContactDialog/useIdentityBinding.ts`。
- 第三方账号由 `useSsoBindings.ts` 加载，`BindThirdAccount/SsoAuthorization.vue` 承接授权弹层。扫码绑定后读回真实状态；卸载时清理订阅和监听。配置链接遵循当前用户菜单权限，缺失状态和时间不推断补齐。
- 密码弹窗复用公共表单与页脚，`EditPassword/usePasswordValidation.ts` 区分当前密码校验失败与请求失败；强度和实际提交仍由现有服务端契约决定。
- 令牌权限保留跟随账号、只读和自定义模式，以及原 Scope、dimensions、attributes、ID/sourceId。编辑不轮换凭证；独立“重新生成”入口确认后使用 `revokeAccessTokens=true`，保留原名称、说明和 Scope，仅更新有效期。新建及重新生成支持预设、自定义时间和永不过期。
- 有效与失效令牌复用 `TokenCard.vue`。说明为空或只有空白时显示“未配置说明”；临期天数按本地自然日计算，未知状态不伪装为有效。完整凭证只在创建或重新生成后的成功弹窗展示，撤销失败保留记录。
- 消息使用 `j-pro-table`、`buildQueryFilter` 和当前用户消息接口，先按后端能力过滤可用 provider。筛选不隐含追加未读条件；批量只提交选中 ID，“全部标为已读”只处理当前分类。独立数据源的详情确认和类型筛选继续遵循其注册契约。
- 通知接收账号与第三方登录绑定分别管理。渠道名称与通知渠道页共用 `/notify/channel/providers` 的 `i18nName / name`；钉钉/微信接收账号按通知器 ID 匹配。站内信不悬浮显示当前用户名，其余渠道保留实际接收账号提示。保存保留既有 topicConfig、默认订阅和其他渠道选择，查询失败不写回空配置。
- 中、英、日资源同步维护。保留通过 `src/router/globModules.ts` 收集的旧 `index.vue` 页面及对外 API，兼容既有动态路由和相邻模块；内部废弃组件不作为兼容入口保留。

### 后端能力边界

- 当前未实现原型中的“最多 10 个有效令牌”限制。失效分区只能展示查询接口仍返回的过期/停用记录；撤销接口直接删除记录，无法提供已撤销历史、撤销时间、令牌尾号或最近使用记录。
- 告警严重/一般过滤和免打扰缺少已确认的个人偏好持久化与投递契约，页面不提供不能实际生效的偏好开关。未声明个人订阅支持的 WebHook 等渠道继续由服务端策略决定。
- 手机号/邮箱弹窗当前保存用户资料，尚未串联原型中的验证码绑定流程。完整流程需要运行环境提供 mobile/email 验证提供商，并统一身份验证、旧身份替换与联系方式资料同步；现有身份确认只写入身份记录。密码修改后的跨设备下线仍需真实账号联调。

### 验证与部署

本次整理仅做静态引用和差异检查，按用户要求未重新运行测试、lint、类型检查、构建或浏览器验收。相关用例保留在 `account/center/*.test.mjs`、联系方式和令牌组件的相邻测试中，由后续验收执行。

发布需要更新运行时前端静态资源；无新增后端服务重启或数据迁移要求。完整检查可在 `runtime-ui/` 执行 `pnpm exec vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json` 与 `pnpm build`；当前 core 未配置独立 lint 脚本。
