# MetaChip 使用说明

紧凑元信息 chip，支持前缀插槽、标签、值和语义色调。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `label` | 标签文本 | `string` | - |
| `value` | 值 | `string \| number` | - |
| `tone` | 颜色语义 | `default \| warn \| ok \| danger \| info` | default |

#### 事件

- 无自定义事件。

#### 用法

~~~vue
<MetaChip label="版本" value="2.12.0" tone="info" />
~~~

#### Rules

- 默认插槽优先于 label；prefix 插槽用于图标等轻量前缀。
