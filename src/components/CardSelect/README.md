# CardSelect 使用说明

网格卡片选择器，支持单选、多选、图标、横纵布局和清空。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `options` | 卡片选项 | `CardOption[]` | [] |
| `value` | 当前值 | `string \| number \| (string \| number)[]` | - |
| `multiple` | 是否多选 | `boolean` | false |
| `type` | 卡片方向 | `vertical \| horizontal` | horizontal |
| `float` | 图标/内容浮动方向 | `left \| right` | left |
| `column` | 列数 | `number` | 3 |
| `noColumn` | 是否取消栅格容器 | `boolean` | false |
| `showImage` | 显示图标 | `boolean` | true |
| `showSubLabel` | 显示副标题 | `boolean` | true |
| `allowClear` | 允许清空 | `boolean` | false |
| `disabled` | 禁用 | `boolean` | false |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `update:value` | 值变化 | `(value)` |
| `change` | 值变化 | `(value, options)` |
| `select` | 选中选项 | `(value, option)` |

#### 用法

~~~vue
<CardSelect
  v-model:value="selected"
  :options="[{ label: '设备', value: 'device', iconUrl: icon }]"
/>
~~~

#### Rules

- options 至少包含 label、value、iconUrl；选项可单独设置 disabled。
- 单选且 allowClear=false 时，重复点击当前项不会清空。
