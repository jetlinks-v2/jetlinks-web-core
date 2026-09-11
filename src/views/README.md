# Core 页面与页面族索引

本文件只索引 `jetlinks-web-core/src/views` 下的页面入口和页面族，不把每个内部 `.vue` 组件都当成路由页面。使用页面能力时，先核验路由配置、入口文件、相邻页面和实际 API；页面说明不能替代这些事实源。

## 页面入口

| 页面族 | 主要入口 | 业务/运行态职责 | 说明 |
| --- | --- | --- | --- |
| 账号中心 | `account/index.vue`、`account/center/index.vue` | 用户资料、密码、绑定、通知、个人 Token | 复用账号 Store、Tab 回传和表单组件；子目录组件按需查看 |
| 认证结果 | `account/identity-result/index.vue` | 身份认证结果展示 | 页面级反馈和回跳 |
| 数据能力实验室 | `data-capability/lab/index.vue` | 数据能力调试和验证 | 使用前核验能力注册中心与请求契约 |
| 初始化首页 | `init-home/index.vue`、`init-home/Basic/index.vue` | 首次初始化项目、基础信息、菜单和角色 | 具备初始化流程状态，不等同普通管理页 |
| 登录与重登录 | `login/index.vue`、`relogin/index.vue` | 登录、记住登录和会话恢复 | 依赖认证、验证码和请求重连流程 |
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
