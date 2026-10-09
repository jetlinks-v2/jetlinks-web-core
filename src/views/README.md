# Core 页面与页面族索引

本文件只索引 `jetlinks-web-core/src/views` 下的页面入口和页面族，不把每个内部 `.vue` 组件都当成路由页面。使用页面能力时，先核验路由配置、入口文件、相邻页面和实际 API；页面说明不能替代这些事实源。

## 页面入口

| 页面族 | 主要入口 | 业务/运行态职责 | 说明 |
| --- | --- | --- | --- |
| 账号中心 | `account/index.vue`、`account/center/index.vue` | 用户资料、密码、绑定、通知、个人 Token | [双栏账户与消息中心](#账号中心)：复用账号 Store、既有编辑和绑定组件 |
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

## 页面说明约定

新增或稳定调整的 core 页面，建议在页面目录增加 `README.md`，并在本索引挂载入口。至少说明：目标用户、进入后的第一任务、成功标准、入口/路由、关键 API 或数据源、Store/Hook、权限与回跳边界，以及不应借鉴的页面模式。

页面内部的 `components/`、`types.ts`、`constants.ts` 和局部 hook 是实现细节；只有形成跨页面稳定复用契约时，才提升到 `src/components`、`src/hooks`、`src/utils` 或 `src/store` 并更新对应分类索引。

## 账号中心

- 目标与归属：`jetlinks-web-core` 的通用个人中心，入口为 `src/views/account/center/index.vue`、路由为 `/account/center`。参考运行时项目 `modules/saas-runtime-ui/views/PersonCenter/index.vue` 的双栏布局，默认显示消息中心；core 不依赖该覆盖模块的组件、资源或文案。
- 账户信息：`account/center/components/AccountCard.vue` 展示头像、名称、用户名、账号 ID、角色 / 组织、联系方式及第三方账号绑定状态。联系方式脱敏；详细编辑继续使用原 `components/AccountInfo/index.vue`，保留头像、名称、密码、邮箱 / 手机号验证绑定及第三方登录绑定 / 解绑操作。账户内容独立滚动，“修改密码”按钮位于面板底部的独立操作区；窄屏账户面板高度限制为可用高度与 `32rem` 的较小值，缩小窗口时继续由账户内容承担滚动。关闭编辑后刷新账户信息。
- 功能切换：右侧复用原 `components/StationMessage/index.vue`、`components/Subscribe/index.vue` 和 `components/PersonalToken/index.vue`，只提供消息中心 / 消息订阅 / 个人令牌三个主切换项。通过 `EqualHeightColumns` 和 Ant Design Vue 分段控件承载；左右两栏使用普通 `section` 组织标题、操作和内容，移除 `ContentPanel` 的卡片包裹。宽屏两栏各自滚动，窄屏堆叠并在容器内滚动。
- 首页视图：左侧移除“首页视图”按钮，`components/HomeView/index.vue` 原代码与历史 `HomeView` 页签入口继续保留；应用用户沿用原入口限制。
- 状态与兼容：`account/center/useCenter.ts` 管理数据、弹窗和路由联动，`types.ts` 定义展示契约。保持 `StationMessage` / `Subscribe` / `PersonalToken` / `BindThirdAccount` / `HomeView` 原页签参数，以及 `user.tabKey`、`user.messageInfo` 和原通知子页签联动；新通知可以切回消息中心，旧通知不会反复覆盖用户的手动选择。邮箱 / 手机号编辑继续兼容 `query.anchor`，账户能力按既有版本条件及 `authService:identity`、身份提供商和 SSO 重定向支持条件展示。
- 边界：没有修改 SaaS 覆盖页面、运营端 `ui/`、后端接口、权限模型或原首页视图 / 账户编辑组件；沿用现有 API，保留工作区已有 API 改动，个人令牌配置同步见下文。新增文案仅维护 core 的 `src/locales/lang/{zh,en}.json`。
- 行为验证：在 core 目录运行 `node --test src/views/account/center/useCenter.test.mjs`，11 项通过，覆盖账号 ID / 用户名 / 角色 / 组织 / 手机号的摘要字段、默认页签、异步加载期间的切换、历史入口、应用用户限制、通知联动、联系方式锚点、主身份与能力回退、SSO 过滤、部分失败重试、关闭编辑刷新、卸载清理和语言切换。
- 编译与静态检查：新页面及账户卡片的 Vue 模板、TypeScript 脚本和 Less 独立编译通过，中英文 JSON 校验、`git diff --check` 通过。当前项目没有 lint 脚本或 ESLint 配置。`pnpm exec vue-tsc --noEmit -p tsconfig.json` 被未改文件的类型错误阻塞；本次新增 / 修改实现文件没有类型错误，发布前仍需修复全量类型检查。
- 页面验证：使用真实页面、账户摘要、双栏组件和原账户编辑组件进行隔离浏览器验证，数据接口及右侧业务面板使用替身。验证了三个功能切换、原资料与绑定编辑入口，以及 1280px / 820px 双栏和 390px 堆叠布局；中英文切换控件、页面与编辑弹窗无横向溢出。两侧容器均为透明背景且无卡片阴影；左侧“首页视图”按钮已移除。在 1280×380 与 390×480 的小高度窗口中，账户内容滚动前后“修改密码”操作区的位置不变，并保持在账户面板底部；1280×900、820×500 英文布局和 390×844 布局复核通过。真实后端下的通知详情定位、绑定 / 解绑提交、头像 / 密码修改、首页视图保存和令牌操作仍需联调。
- 构建限制：在 `runtime-ui` 运行 `pnpm build:standalone`，转换 24,312 个模块后因当前 8GB V8 堆上限报 `JavaScript heap out of memory`，构建未完成。需在具备足够内存的环境调整进程堆上限后重新执行该命令；不能将模块转换完成视为完整构建通过。

### 个人令牌配置

- 目标与范围：`jetlinks-web-core` 的 `src/views/account/center/components/PersonalToken/` 已参考 `modules/saas-runtime-ui/views/PersonCenter/components/PersonalToken/` 同步配置弹窗、权限展示和保存反馈。文案使用 core 自有中英文资源，组件不依赖 SaaS 覆盖模块；保持个人中心双栏、底部密码按钮和原首页视图代码。
- 权限配置：直接显示可授权操作标签，替换原初始化选项和权限勾选。新增、编辑均在首次完整查询后使用当前全部可授权操作；搜索只过滤展示，不缩小保存范围。查看模式展示原令牌已授权的操作。首次完整权限未加载或加载失败时清空旧权限、禁止提交，并提供重试。
- 保存流程：编辑回填保留原记录 `id` 和 `sourceId`；“不刷新令牌保存”传递 `revokeAccessTokens=false`，保留原令牌、更新权限、刷新列表并提示权限在原令牌生效。“刷新令牌保存”传递 `true`，展示新令牌供复制，关闭成功弹窗后刷新列表。新增生成令牌，查看只读；校验与请求期间阻止重复提交和取消，失败保留输入。窄屏表单堆叠，页脚按钮和权限操作表头可换行。
- 关键入口：`components/useTokenDialog.ts` 管理回填、有效期、校验与两种保存；`components/useTokenPermissions.ts` 管理完整权限初始化、搜索、失败重试和卸载保护；`usePersonalToken.ts` 复用共享 `useRequest` 管理列表及保存反馈。`types.ts`、`components/data.ts` 定义令牌和授权范围类型，`TokenDialog.vue`、`PermissionList.vue`、`PermissionSelector.vue` 负责展示；`Success.vue` 提供一次性令牌展示和复制反馈。`src/api/account/center.ts#savePersonalToken_api` 支持可选的 `revokeAccessTokens` 查询参数，省略时沿用后端默认值；可授权范围由既有 `src/api/system/permission.ts#queryPermission_api` 获取。GET 查询复用 `paramsEncodeQuery` 将条件和排序编码为 `terms[0].column` / `sorts[0].name` 等 Spring 属性路径，并保留分页参数。
- 关键影响：与 SaaS 当前行为一致，编辑保存会同步最新全量可授权权限，可能增加原令牌未包含的操作或移除已不可授权的操作；选择刷新保存会使原令牌失效。SaaS 覆盖页面、运营端、后端、菜单和路由不在本次改动范围。
- 专项回归：在 core 目录运行 `node --test src/views/account/center/components/PersonalToken/useTokenDialog.test.mjs src/views/account/center/components/PersonalToken/permissions.test.mjs`，15 项通过，覆盖两种保存参数、原记录 ID、全量权限初始化与旧操作移除、搜索与清空、查看只读、权限失败重试、重复提交与取消保护、保存失败、新令牌反馈、中英文资源及自定义日期毫秒值；GET 查询契约验证复用真实编码工具，覆盖搜索、排序、分页与首次完整查询参数。
- 编译与静态检查：5 个修改的 Vue 组件脚本、模板和 Less 独立编译通过，中英文 JSON 校验及 `git diff --check` 通过。`pnpm exec vue-tsc --noEmit -p tsconfig.json` 在当前更新后的代码上共报告 556 项既有类型错误，本次新增 / 恢复的实现文件 0 项诊断。当前没有 lint 脚本或 ESLint 配置；完整构建此前因 8GB V8 堆上限内存不足未完成，本次未重复该已知失败的构建，待执行命令及限制见上文。
- 浏览器验证：使用真实个人中心、令牌列表、配置及权限组件，接口和部分宿主能力使用替身。新增选择 7 天有效期后生成模拟令牌，关闭成功弹窗后列表展示新记录；编辑展示最新 5 项操作，搜索后仍保留完整提交范围，两种保存均按预期反馈；查看保持原 1 项授权且不显示保存按钮。权限和保存失败重试通过。中文桌面与英文 390×844 布局通过，窄屏弹窗 `clientWidth` / `scrollWidth` 均为 358px，保存按钮完整显示。验证仅使用模拟数据，真实后端下的令牌轮换、原令牌失效及权限生效仍待联调。
- 交付引用：实现提交 [1b6a428](https://github.com/jetlinks-v2/jetlinks-web-core/commit/1b6a428247b9025bf311fb66f60252e7f1587eb0)，对应 [PR #171](https://github.com/jetlinks-v2/jetlinks-web-core/pull/171)，目标分支为 `2.20`。
