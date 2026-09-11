# KvGrid 使用说明

键值信息栅格，适合详情页摘要和配置回显。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `items` | 键值项 | `Array<{ label, value, mono? }>` | [] |
| `cols` | 列数或堆叠模式 | `1 \| 2 \| 3 \| stacked` | 1 |
| `cellLayout` | 单元格布局 | `stack \| inline` | stack |
| `gap` | 单元格间距 | `number` | - |
| `labelWidth` | 标签宽度 | `string` | - |

#### 事件

- 无自定义事件。

#### 用法

~~~vue
<KvGrid :items="[{ label: '状态', value: '在线' }]" :cols="2" />
~~~

#### Rules

- value 可为 string 或 number；需要等宽展示时将 mono 设为 true。
- 详情页不应把普通字段渲染成无业务意义的指标卡。
