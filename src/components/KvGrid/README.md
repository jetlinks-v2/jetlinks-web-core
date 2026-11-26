# KvGrid 使用说明

键值信息栅格，适合详情页摘要和配置回显。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `items` | 键值项 | `Array<{ label, value, mono? }>` | [] |
| `cols` | 列数或堆叠模式 | `1 \| 2 \| 3 \| stacked` | 2 |
| `cellLayout` | 单元格布局 | `stack \| inline` | stack |
| `gap` | 单元格间距（px） | `number` | 10 |
| `labelWidth` | inline 模式标签宽度 | `string` | 4.75rem |

#### 事件

- 无自定义事件。

#### 用法

~~~vue
<KvGrid :items="[{ label: '状态', value: '在线' }]" :cols="2" />
~~~

#### Rules

- value 可为 string 或 number；需要等宽展示时将 mono 设为 true。
- 详情页不应把普通字段渲染成无业务意义的指标卡。
- 默认插槽可提供 `.kv-cell`，其直接子节点使用 `dt` / `dd`；插槽和数组项共用标签、值、分隔线及布局样式，不需要调用方复制 CSS。
