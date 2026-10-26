# AMapComponent 使用说明

高德地图容器，负责按系统配置加载地图 SDK，并通过插槽承载标记、行政区和路线等地图图层。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `style` | 地图容器样式 | `CSSProperties` | 宽高 100% |
| `class` | 容器 class | `string` | - |
| `AMapUI` | 是否加载 AMapUI，可传版本号 | `string \| boolean` | false |
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

#### 高德异常提示（M 级，已确认居中方案）

1. 目标：采用用户确认的居中提示，在地图区域展示异常图标、标题、可获取的错误码和描述；错误码下方单独展示高德返回的 `info` 原文（如 `INVALID_REQUEST`，以实际返回值为准，为空时隐藏），再提示“请前往高德地图官网查看错误码说明。”；不提供刷新按钮，未知错误使用统一文案。
2. 范围：由 `jetlinks-web-core/src/components/AMapComponent` 维护，调整 `AMap.vue`、本目录加载与生命周期逻辑、core 中英文词条及相关测试。设备地图、设备详情和坐标选择器等现有调用方通过共享组件获得相同反馈。
3. 保持边界：不修改 `/geo/object/device/_search/geo.json`、Token、权限、点位和聚合逻辑，不修改运营端 `ui/`；不将正常无点位视为高德异常，不通过重置全局 SDK 实例影响其他地图。
4. 实施：在本目录 hook 管理加载状态、错误信息及事件清理；接入 SDK 加载 Promise、地图错误回调与 AMapUI 脚本失败，组件使用 Ant Design 图标和反馈组件展示居中提示；初始化持续未完成时显示超时提示，成功完成后清理超时状态。保留现有正常地图插槽和调用契约。
5. 风险：用户确认 `1013` 来自高德，但尚无完整错误载荷，不预设其含义；仅当 SDK 暴露错误码时展示该码。[高德 JS API 错误码描述](https://lbs.amap.com/api/javascript-api-v2/guide/abc/errorcode)列出了 `info` 返回值；响应中的字段是否被 SDK 透传仍需实测，展示实际可读取的 `info`，不按错误码硬编码映射。仅写入控制台且不触发错误事件的情况，需要通过初始化超时提示兜底；已初始化后 SDK 未暴露的内部错误无法承诺识别。保持现有 `init` 事件、图层插槽和 `setBounds` 能力，并验证多个地图实例互不干扰。
6. 验证：覆盖携带错误码（含模拟 `1013`）与 `info` 的回调、`info` 为空及长文本换行、SDK/AMapUI 加载失败、未知错误、初始化超时、正常加载与卸载清理；运行相关地图回归、SFC 编译和类型检查，记录构建/lint 结果及真实高德环境仍待联调的范围。实现与验证完成后在本文档回填实际结果。
