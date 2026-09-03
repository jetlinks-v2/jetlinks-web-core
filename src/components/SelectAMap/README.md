# SelectAMap 使用说明

地图坐标选择器，支持手动输入、地图点选和 POI 搜索。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `point` | 经纬度字符串 | `string` |  |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `update:point` | 坐标变化 | `(point: string)` |
| `change` | 坐标变化 | `(point: string)` |

#### 用法

~~~vue
<SelectAMap v-model:point="point" />
~~~

#### Rules

- point 格式为 lng,lat，例如 106.55,29.56。
- 地图服务配置来自系统设置；选择后组件会同时触发 update:point 与 change。
