# `@jetlinks-web-core/hooks` Hook 索引

本文件是 hooks 的轻量导航。使用前按下表定位候选，再核验 [index.ts](index.ts)、Hook 源码和相邻生产用法。表中“根入口”指 `@jetlinks-web-core/hooks` 的当前 `index.ts` 导出；不是根入口的文件只能按已有生产用法使用深层路径。

## 运行态、平台与路由

| 能力 | 入口文件 | 根入口 | 适用场景 |
| --- | --- | --- | --- |
| `usePlatformContext` / `usePlatform` / `isIotPlatform` | `usePlatform.ts` | 是 | 提供或读取平台上下文、处理平台差异渲染 |
| `useMircoAppData` | `useMircoApp.ts` | 否 | 读取微应用宿主传入的数据；使用深层路径前核验生产导入 |
| `useProjectRouter` | `useProjectRouter.ts` | 是 | 项目运行态下解析项目 ID、路径和跳转 |

## 页面回传、注册与权限

| 能力 | 入口文件 | 根入口 | 适用场景 |
| --- | --- | --- | --- |
| `useTabSaveSuccess` / `useTabSaveSuccessBack` | `useTabSaveSuccess.ts` | 是 | 新开 Tab 保存后回传、保存后返回 |
| `useRegistryOptions` / `useRegistryVNodeMerge` | `useRegistryComponentsMerge.ts` | 是 | 合并基础配置与运行时注册项，支持节点插入/替换 |
| `useMenuAssetPermissionEditor` | `useMenuAssetPermissionEditor.ts` | 是 | 菜单资产权限编辑器的状态和动作编排 |

`useTabSaveSuccess` 保留历史 `isSaaS` 地址分支。仅非微应用的固定项目部署，或启用项目存储且经 `isProjectRuntime()` 确认的项目入口，复用 `utils/project-runtime.ts` 生成新 Tab 地址。普通独立部署目录、云端边缘代理、租户端和微应用保持历史跳转规则；菜单参数、`sourceId` 和保存回传保持现有契约。历史依据为 `d4dd389`（修复 SaaS 可视化跳转）；后续项目上下文改为从 pathname 获取，而 cloud 项目入口不能继续只依赖 `isSaaS` 判断。

项目编码为空的跳转修复：`VITE_APP_RUNTIME_SCOPE=project` 且未配置 `VITE_APP_PROJECT_CODE` 时，新标签优先使用配置编码，为空则从当前 pathname 读取项目编码，避免编辑器素材库引导丢失 `/<项目编码>/` 后进入根登录页。修改入口为 `useTabSaveSuccess.ts`，继续复用 `createProjectRuntimeHref` 的部署路径规则。组件、模型空态和图片、模板面板的已有调用共用此修复。

验证：`rtk proxy node runtime-ui/jetlinks-web-core/scripts/test-tab-save-success.mjs` 在修复前复现 project 模式输出根路径，修复后 15 种部署配置、86 项断言通过，覆盖 cloud / SaaS 的 project / auto 模式、配置编码优先、私有化基础目录、根入口、微应用、查询编码与保存回传；既有 `test-project-runtime-href.mjs` 的 6 种部署配置、108 项断言通过。Hook TypeScript 语法与 `git diff --check` 通过；现有 9200 Vite 返回 200 并加载项目编码回退。9000 浏览器复现原按钮进入 `/#/login`，手动保留项目路径可正常打开对应组件素材库；该环境尚未部署本次修复。无新增依赖，无需重启后端；更新运行时前端后复验编辑器按钮及图片、模型入口。按本机性能约束未执行全量 lint/typecheck/build，core 未配置独立 lint 脚本；待执行 `pnpm -C runtime-ui exec vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json` 和 `pnpm -C runtime-ui build`。

验证：在仓库根执行 `rtk proxy node --test ui/jetlinks-web-core/tests/useTabSaveSuccess.test.mjs`，14 项通过，覆盖 cloud / SaaS 项目及根入口、普通部署子目录、租户运行态、固定项目 base、两类边缘代理、cloud / SaaS 微应用、无 hash 和模板预览，同时检查查询编码与保存回调。测试执行实际 Hook、运行态、路径和环境判断源码，浏览器及菜单 store 使用替身。收窄后浏览器再次验证模板编辑保留项目路径，作品名称、画布及配置正常加载。

未逐一进入角色、部门、设备接入、告警场景、智能体等调用页面，也未实际保存模板数据；微应用宿主和其他部署模式只完成上述回归验证。TypeScript 语法与 `git diff --check` 通过。按机器性能约束未运行完整类型检查或构建，需要时在 `ui/` 执行 `pnpm exec vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json` 和 `pnpm -F jetlinks-web-core build`；当前包未配置独立 lint 脚本。

## 验证会话

| 能力 | 入口文件 | 根入口 | 适用场景 |
| --- | --- | --- | --- |
| `useCaptchaVerify<TResult, TContext>` | `useCaptchaVerify.ts` | 是 | 在当前 Vue Scope 内管理一次验证等待，与验证码组件通过事件接线 |

- `openCaptcha({ context?, signal? })` 返回 `Promise<TResult>`；同一实例不能覆盖未结束的等待，重复打开或已取消的请求会拒绝，多个实例彼此独立。
- `captchaOpen` 可用于 `v-model:open`，但开启必须通过 `openCaptcha`；`context` 是当前等待的只读上下文。成功、关闭、AbortSignal 取消及 Scope 销毁会清空上下文、移除取消监听，并只结束一次等待。销毁后不能重新打开。
- `onCaptchaSuccess(result)` 结束成功等待，`closeCaptcha(error?)` 结束取消或失败等待；验证码组件需要绑定这些事件。组件自身仍负责隔离过期请求与迟到事件。
- 不请求验证码、不验证 proof、不复制业务输入、不登录或跳转；结果与上下文使用调用方的泛型，不绑定 ALTCHA、登录 API 或其他业务模块。业务流程继续管理从获取上下文到提交请求的整体锁和取消边界。

```ts
import { useCaptchaVerify } from '@jetlinks-web-core/hooks'

const verification = useCaptchaVerify<string, { requestId: string }>()
```

生产用法：`src/views/login/hooks/useLogin.ts` 与 `modules/saas-manager-ui/views/login/hooks/useLogin.ts`；两者不再维护私有副本。专项验证入口为 `pnpm test:captcha-verify`（生命周期、类型及 Core 登录组件接线）与 SaaS 模块的 `pnpm test:login`。这组回归不代替真实后端认证集成或全站构建验证。

## 请求、订阅与图表

| 能力 | 入口文件 | 根入口 | 适用场景 |
| --- | --- | --- | --- |
| `useRequest` | `useRequest.ts` | 否 | 请求状态封装；仅沿用已有深层生产用法，不把文件存在当作根 API |
| `useWebSocket` | `useWebSocket.ts` | 是 | WebSocket 订阅和连接状态 |
| `useEcharts` | `Echarts/useEcharts.ts` | 是 | ECharts 实例生命周期、渲染错误和 resize 处理 |

## 布局、主题与响应式

| 能力 | 入口文件 | 根入口 | 适用场景 |
| --- | --- | --- | --- |
| `useHeaderTheme` | `useHeaderTheme.ts` | 是 | 计算页面头部主题状态 |
| `useResponsiveLayoutDimensions` | `useResponsiveLayoutDimensions.ts` | 是 | 根据容器和主题计算响应式布局尺寸 |
| `useResponsiveAntdToken` | `useResponsiveAntdToken.ts` | 是 | 根据屏幕档位生成响应式 Ant Design token |
| `useUiTicker` | `useUiTicker.ts` | 是 | 受控的 UI 定时刷新；使用时确认暂停和销毁边界 |
| `useElementFlight` | `useElementFlight.ts` | 是 | 在两个调用方提供的 DOM 元素之间播放贝塞尔飞行动画，并在组件卸载时清理动画节点 |

## 使用约束

- Hook 的请求、订阅、watch 和全局状态副作用必须以源码和说明文档为准，不要根据名称猜测生命周期。
- 根入口未导出的 Hook 不得因为存在 `*.ts` 文件就直接改成包根导入；先检查目标项目已有深层导入和版本构建产物。
- 新增公共 Hook 时同步更新本索引，并在文件旁说明返回值契约、主要副作用和清理方式。
