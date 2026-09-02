# MetricCards 使用说明

指标卡组，支持 strip/auto 布局和可选交互态。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `items` | 指标项 | `MetricCardItem[]` | [] |
| `activeKey` | 当前指标 key | `string \| number` | - |
| `interactive` | 是否可点击 | `boolean` | false |
| `layout` | 布局 | `strip \| auto` | strip |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `itemClick` | 点击指标 | `(item)` |

#### 用法

~~~vue
<MetricCards
  :items="metrics"
  interactive
  :active-key="activeMetric"
  @item-click="onMetricClick"
/>
~~~

#### Rules

- interactive=true 时支持键盘 Enter/Space 操作。
- 指标项应有真实数据源和决策用途，不使用占位统计。
