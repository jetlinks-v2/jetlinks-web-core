# `@jetlinks-web-core/utils` Utils 索引

本文件是 utils 的轻量导航。先按业务场景选择候选，再核验 [index.ts](index.ts)、工具源码和生产用法。只有 `index.ts` 明确导出的文件才可作为 `@jetlinks-web-core/utils` 根入口事实；其余能力需使用已有深层路径证据。

## 查询、路由与菜单

| 文件/能力 | 根入口 | 主要用途 |
| --- | --- | --- |
| `encodeQuery.ts`：`paramsEncodeQuery`、`encodeQuery`、`handleParamsToString` | 是 | 旧查询参数、`terms[]/sorts[]` 编码和固定条件字符串化 |
| `menu.ts`：`handleMenus`、`handleAuthMenu`、`routerFallback` | 是 | 菜单树、动态路由、按钮权限映射和页面回退 |
| `modules.ts`：模块读取与注册 | 是 | 模块菜单、初始化页和包配置 |
| `project-runtime.ts` | 是 | 项目运行态识别、路径标准化和跳转地址 |
| `application-scope.ts` / `application-access.ts` | 是 | 业务应用 Scope、入口参数和访问引导 |
| `project-path.ts` | 否 | 项目路径解析；使用深层路径前核验生产用法 |

## 请求、运行态与结果

| 文件/能力 | 根入口 | 主要用途 |
| --- | --- | --- |
| `request-context.ts`：`getBaseApi`、`getRequestHeaders`、`getUploadHeaders` | 否 | API base、请求头和上传请求上下文 |
| `context.ts`：`initRequest` | 否 | 请求上下文初始化 |
| `project-storage.ts` | 是 | 项目级 token、域名、API 地址和 Scope 存储 |
| `business-application-runtime.ts` | 是 | 业务应用运行态判定 |
| `deployment.ts`：`isPrivateDeployment()` | 是 | 无参数、无副作用，返回当前构建是否为私有化部署的 boolean；读取构建时的 `VITE_APP_DEPLOYMENT` |
| `service-result.ts`：`ok`、`err` | 是 | 纯函数式服务结果包装 |
| `ai-client-tool-request.ts` | 是 | AI 客户端工具静默请求上下文 |

通过 `import { isPrivateDeployment } from '@jetlinks-web-core/utils'` 导入，使用 `if (isPrivateDeployment()) { /* 私有化部署逻辑 */ }` 判断。`pnpm build:private` 设置 `VITE_APP_DEPLOYMENT=private`，未配置时默认 `saas`；切换部署方式需重新构建。覆盖顺序为命令行参数 > 进程环境变量 > 根目录环境配置 > core 环境配置 > 默认值。此判断独立于 `VITE_APP_ENVIRONMENT` 的 saas/cloud 业务环境，目前由业务模块按需接入。

## 资产、媒体与资源

| 文件/能力 | 根入口 | 主要用途 |
| --- | --- | --- |
| `assetAccess.ts` | 是 | 资产类型、支持项和选择值归一化 |
| `edge-media.ts` | 是 | 边缘媒体代理、设备媒体路径和媒体 URL |
| `public-asset.ts` | 是 | 公共资源 URL 解析 |
| `comm.ts`：`getImageUrl`、`downloadJson` 等 | 是 | 下载、图片地址和通用集合/树处理 |

## 注册、并发与上传

| 文件/能力 | 根入口 | 主要用途 |
| --- | --- | --- |
| `module-registry.ts` | 否 | 模块资源注册中心；跨模块调用优先通过公开注册能力 |
| `components-registry.ts` | 否 | 页面组件/动作注册表 |
| `concurrency-control.ts`：`ConcurrencyControl` | 是 | 受控并发任务 |
| `upload-file-chunk/` | 是 | 分片大小、文件哈希和分片上传 |

## 校验、主题与基础函数

| 文件/能力 | 根入口 | 主要用途 |
| --- | --- | --- |
| `validate.ts` / `regular.ts` | 是 | 手机号、密码、IP、URL、Cron 等校验 |
| `document.ts` | 是 | 动态脚本加载 |
| `utils.ts` | 是 | Tab 回传、批量行处理和通用运行时辅助 |
| `theme-color.ts` / `theme-style.ts` | 是 | 主题色、主题风格 token 和持久化 |
| `theme-config.ts` | 否 | 主题 token 原始配置；优先通过 `theme-style.ts` 使用 |
| `consts.ts` / `menuBadge.ts` | 否 | Core 内部常量和菜单徽标辅助；不要仅凭文件名作为公共 API |

## 使用约束

- 查询编码、请求上下文、项目 Scope、媒体代理和模块注册都带有运行态边界；使用前必须读源码或对应说明，不能只复制函数名。
- 工具函数应保持纯函数边界；涉及 localStorage、环境变量、请求头、路由或全局注册的能力，要在调用处明确其副作用。
- 新增公共工具时同步更新本索引，标注根入口/深层路径、输入输出和副作用；复杂工具可在同目录增加单文件 README。
