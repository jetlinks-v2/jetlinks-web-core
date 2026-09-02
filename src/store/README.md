# `@jetlinks-web-core/store` Store 索引

本文件是 Pinia store 的轻量导航。使用前先判断状态生命周期，再核验 [index.ts](index.ts)、目标 store 源码和相邻页面用法。`index.ts` 的导出范围是当前根入口事实，未导出的 store 或辅助文件不能自动视为 `@jetlinks-web-core/store` 公共 API。

## 根入口导出的 Store

| Store | 文件 | 主要状态/职责 | 典型消费者 |
| --- | --- | --- | --- |
| `useAuthStore` | `auth.ts` | 登录态、认证相关状态 | 路由守卫、登录和认证流程 |
| `useUserStore` | `user.ts` | 当前用户信息 | 页面头部、个人中心、权限上下文 |
| `useMenuStore` | `menu.ts` | 菜单、动态路由和面包屑 | 布局、路由和侧栏 |
| `useSystemStore` | `system.ts` | 系统配置、布局模式和主题相关配置 | 全局布局和系统设置 |
| `useApplication` | `application.ts` | 应用运行态信息 | 应用上下文和页面初始化 |
| `useBusinessApplicationStore` | `businessApplication.ts` | 业务应用列表、当前应用和 Scope | 业务应用切换和菜单上下文 |
| `useAIStore` | `ai.ts` | AI 相关会话/运行态状态 | AI 入口和客户端工具交互 |
| `useRouteLoadingStore` | `route-loading.ts` | 路由切换 loading | 页面壳和路由过渡 |

## 深层路径或辅助能力

| 文件/能力 | 当前事实 | 使用边界 |
| --- | --- | --- |
| `verify.ts`：`useVerifyStore` | 未由 `index.ts` 导出 | 校验缓存和二次校验流程；沿用已有深层导入 |
| `department.ts`：`useDepartmentStore` | 未由 `index.ts` 导出 | 组织部门数据；仅在已有生产用法范围内使用 |
| `menuHelpers.ts` / `menuFilters.ts` / `menuRouteTarget.ts` / `menuRuntime.ts` | 工具/运行时文件，不是根入口 Store | 菜单装配和运行时扩展；先核验调用方和参数契约 |
| `module-override.ts`：`withModuleStoreOverride` | 未由 `index.ts` 导出 | 模块覆盖 Store 定义；不要绕过现有覆盖机制直接复制 Store |

## 状态边界

- 弹窗开关、临时输入、一次性表单草稿优先留在组件或 composable；跨页面共享、路由守卫依赖、全局配置和权限上下文才进入 Store。
- 通过 `storeToRefs` 消费响应式 state，动作从 Store 实例调用；不要在页面复制同一请求或直接改动 Store 内部状态。
- 服务端数据由 Store action 统一拉取时，说明缓存、刷新和错误策略；涉及项目/业务应用 Scope 时同时核验对应 utils 与请求拦截器。
- 新增或稳定调整 Store 时同步更新本索引，说明状态范围、action、副作用和持久化边界。
