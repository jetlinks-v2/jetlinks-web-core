# Editable 使用说明

轻量字段编辑器，按 type 切换输入框、数字框、选择器、日期和时间范围。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `value` | 字段值 | `unknown` | - |
| `type` | 编辑控件类型 | `string \| number \| select \| date \| time \| dateRange \| timeRange` | string |
| `componentProps` | 透传底层控件 props | `object` | {} |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `update:value` | 值变化 | `(value)` |
| `change` | 值提交 | `(value)` |

#### 用法

~~~vue
<Editable v-model:value="name" type="string" />
<Editable v-model:value="state" type="select" :component-props="{ options }" />
~~~

#### Rules

- 输入类控件在 blur 时提交，选择/日期类控件在 change 时提交。
- componentProps 只透传给对应 Ant Design Vue 控件。
