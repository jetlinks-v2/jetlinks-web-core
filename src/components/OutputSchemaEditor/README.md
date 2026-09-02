# OutputSchemaEditor 使用说明

输出字段契约编辑器，支持字段类型、枚举值、数值范围和只读查看。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `modelValue` | 输出字段列表 | `OutputSchemaField[]` | [] |
| `readonly` | 只读模式 | `boolean` | false |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `update:modelValue` | 字段变化 | `(fields: OutputSchemaField[])` |

#### 用法

~~~vue
<OutputSchemaEditor v-model="outputSchema" :readonly="readonly" />
~~~

#### Rules

- 字段 key 必须稳定且唯一；enum 类型才填写 enumValues，number 类型才填写 min/max。
- readonly=true 时不允许新增、删除或修改字段。
