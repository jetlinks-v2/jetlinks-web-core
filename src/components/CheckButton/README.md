# CheckButton 使用说明

按钮式选项组，支持单选、多选、禁用和异步变更前校验。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `value` | 当前值 | `string \| string[]` | - |
| `options` | 按钮选项 | `Array<{ label, value, disabled? }>` | [] |
| `multiple` | 是否多选 | `boolean` | false |
| `columns` | 栅格列数 | `number` | 3 |
| `beforeChange` | 变更前钩子 | `(value) => boolean \| Promise<boolean>` | - |
| `disabled` | 禁用 | `boolean` | false |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `update:value` | 值变化 | `(value)` |
| `change` | 值变化 | `(value, option)` |
| `select` | 选中选项 | `(value, option)` |

#### 用法

~~~vue
<CheckButton
  v-model:value="state"
  :options="options"
  :before-change="checkBeforeChange"
/>
~~~

#### Rules

- beforeChange 返回 false 或 Promise<false> 时阻止选择。
- 组件会同步触发表单项 change，适合放入 a-form-item。
