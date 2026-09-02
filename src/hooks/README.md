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

## 使用约束

- Hook 的请求、订阅、watch 和全局状态副作用必须以源码和说明文档为准，不要根据名称猜测生命周期。
- 根入口未导出的 Hook 不得因为存在 `*.ts` 文件就直接改成包根导入；先检查目标项目已有深层导入和版本构建产物。
- 新增公共 Hook 时同步更新本索引，并在文件旁说明返回值契约、主要副作用和清理方式。
