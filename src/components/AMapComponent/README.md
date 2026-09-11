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
