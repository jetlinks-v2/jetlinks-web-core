# ChipGroup 使用说明

横向 chip 选项组，支持 wrapped 与 inline 两种容器样式。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `modelValue` | 当前选项 key | `string` | - |
| `options` | chip 选项 | `ChipOption[]` | - |
| `label` | 左侧标签 | `string` | - |
| `disabled` | 禁用 | `boolean` | false |
| `styleVariant` | 容器样式 | `wrapped \| inline` | wrapped |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `update:modelValue` | 选项变化 | `(key: string)` |

#### 用法

~~~vue
<ChipGroup
  v-model="activeKey"
  label="类型"
  :options="[{ key: 'all', label: '全部', count: 3 }]"
/>
~~~

#### Rules

- options 的 key 必须唯一；count、dot 和 variantClass 只影响展示。
