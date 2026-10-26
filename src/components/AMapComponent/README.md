# AMapComponent 使用说明

高德地图容器，负责按系统配置加载地图 SDK，并通过插槽承载标记、行政区和路线等地图图层。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `style` | 地图容器样式 | `CSSProperties` | 宽高 100% |
| `class` | 容器 class | `string` | - |
| `AMapUI` | 是否加载 AMapUI，可传版本号；显式 false 时跳过 | `string \| boolean` | true（保留既有轨迹调用的默认加载行为） |
| `center` | 初始中心点 | `number[]` | - |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `init` | 地图初始化完成 | `(mapInstance)` |

#### 用法

~~~vue
<AMapComponent style="height: 320px" @init="map => (mapRef = map)">
  <template #default><!-- 地图覆盖物 --></template>
</AMapComponent>
~~~

#### Rules

- 地图 API Key 与安全密钥来自系统配置，调用方不在组件上写入密钥。
- 通过 expose 的 setBounds(bounds) 调整视野；没有地图配置时显示统一空态。

#### 高德异常提示

- SDK 加载失败、地图 `error` 事件、AMapUI 加载失败时，在地图区域居中展示异常图标、标题和可获取的详细信息，不提供刷新按钮。
- 错误码优先读取 `infocode` / `errcode` / `code`；其下展示实际返回的 `info` 原文（如 `INVALID_REQUEST`），为空时隐藏。原始 `message` 与 `info` 不同时另行展示。所有错误都提示“请前往高德地图官网查看错误码说明。”，不会根据 `1013` 等错误码硬编码 `info`。
- 地图 SDK、底图 `complete` 事件和可选 AMapUI 均就绪后结束加载；15 秒仍未完成则显示超时提示。迟到的正常加载可以消除超时提示，明确的 SDK 错误持续显示。
- 保留 `init`、图层插槽和 `setBounds`；AMapUI 默认加载，兼容 `modules/device-manager-ui/views/device/Instance/Detail/Running/Property/Detail/PropertyAMap.vue` 中的既有轨迹用法。多个地图共用 SDK / AMapUI 脚本，各自维护异常、超时和卸载状态。
- 未配置 Key 时保留原有空态，正常无点位不视为异常。此能力由共享组件维护，设备地图、设备详情和坐标选择器等调用方继承相同反馈；不改变 GeoJSON 请求、Token、权限和点位聚合。

实现入口：`src/components/AMapComponent/AMap.vue` 负责居中展示；`useAMapLifecycle.ts` 管理加载、事件与清理；`errors.ts` 提取错误字段；`utils.ts` 管理 AMapUI 脚本及失败清理；中英文文案位于 `src/locales/lang/zh.json`、`en.json`。

#### 验证与边界

- 在 core 执行 `node --test tests/amapLifecycle.test.mjs tests/amapUiLoader.test.mjs tests/amapFeedback.test.mjs`，19 项通过，覆盖正常加载、实际错误字段、未知错误、超时、AMapUI 失败、配置切换、卸载、多实例、文案与 SFC 编译。
- 在 `modules/device-manager-ui` 执行 `node --test tests/deviceMapCluster.test.mjs tests/dashboardRuntime.test.mjs tests/deviceLocationGeoContract.test.mjs`，24 项通过。
- 使用实际 SFC、Ant Design 和 Vue-AMap 事件注册，配合外部 SDK 替身，完成居中提示、`1013 / INVALID_REQUEST`、空 `info`、320px 容器长文本换行、中英文、超时后恢复和多地图隔离的浏览器检查；组件定向 Vite 生产构建通过。
- `vue-tsc --noEmit` 仍被既有类型错误阻塞，改动前后错误位置和错误码一致，本次组件文件无新增错误。当前项目未配置 lint 脚本；全量应用构建尚未执行，可在运行时根目录执行 `pnpm build` 进一步验证所有业务模块装配。
- [高德 JS API 错误码描述](https://lbs.amap.com/api/javascript-api-v2/guide/abc/errorcode)列出了 `info` 返回值。真实高德异常回包是否被 SDK 透传仍需联调；只有可读取到字段时才展示。仅写入控制台且不触发事件的初始化失败由超时提示兜底，已初始化后 SDK 未暴露的内部错误无法保证识别。
