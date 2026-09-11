# MetadataValueItem 使用说明

物模型元数据值编辑器，按元数据定义选择文本、数字、枚举、时间或 Monaco 输入。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `item` | 元数据项定义 | `MetadataItem` | - |
| `modelValue` | 当前值 | `unknown` | - |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `update:modelValue` | 值变化 | `(value)` |
| `change` | 值提交 | `(value)` |

#### 用法

~~~vue
<MetadataValueItem v-model="propertyValue" :item="metadataItem" />
~~~

#### Rules

- item 中的 valueType 决定编辑控件和转换规则。
- 复杂 JSON/脚本值使用内部 InputMonacoEditor，不在页面重复封装。
