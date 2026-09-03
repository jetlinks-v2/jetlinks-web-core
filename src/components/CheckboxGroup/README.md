# CheckboxGroup 使用说明

带默认 view 选项的权限复选框组。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `options` | 复选框选项 | `CheckboxOptionType[]` | [] |
| `value` | 选中值 | `CheckboxValueType[]` | [view] |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `change` | 选项变化 | `(value: CheckboxValueType[])` |

#### 用法

~~~vue
<CheckboxGroup
  v-model:value="permissions"
  :options="permissionOptions"
/>
~~~

#### Rules

- value 为空时会归一化为 [view]，适合权限动作默认保留查看权限。
