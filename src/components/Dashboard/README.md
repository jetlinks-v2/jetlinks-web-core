# Dashboard 使用说明

仪表盘展示组件族，包含 CardItem、GaugeCard、NetWork、TimeLineEchart、TrendChart、TimeSelect 等。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `title` | 卡片标题（按子组件） | `string` | - |
| `data` | 图表/指标数据（按子组件） | `unknown` | - |
| `options` | 图表配置（按子组件） | `object` | - |
| `time` | 时间范围（TimeSelect） | `string` | - |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `change` | 时间或指标变化（按子组件） | `(value)` |

#### 用法

~~~vue
<TrendChart :data="trendData" :options="chartOptions" />
<TimeSelect v-model:value="range" @change="loadTrend" />
~~~

#### Rules

- 每个子组件的专属字段以对应 .vue 文件为准，不要把 TrendChart 的 props 传给 GaugeCard。
- 图表数据和刷新时机由页面或业务 hook 负责。
