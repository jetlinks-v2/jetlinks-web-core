# SegmentPanel

通用的全高筛选面板壳：只提供标题、分段选择器和内容插槽，不处理插槽内部的数据、状态或交互。

```vue
<SegmentPanel
  v-model="activeType"
  title="通道筛选"
  :options="[
    { label: '网关', value: 'gateway' },
    { label: '空间', value: 'space' },
  ]"
>
  <ChannelList />
</SegmentPanel>
```

| 属性 / 事件 | 类型 | 说明 |
| --- | --- | --- |
| `title` | `string` | 顶部标题。 |
| `options` | `SegmentPanelOption[]` | 分段选择器选项。 |
| `modelValue` / `update:modelValue` | `string \| number` | 当前分段值，支持 `v-model`。 |
| `change` | `(value) => void` | 分段值变更时触发。 |
| 默认插槽 | `slot` | 面板内容，由业务组件完全控制。 |

`title` 与 `segmented` 均可通过同名插槽覆盖。`segmented` 插槽提供 `value`、`options` 和 `change(value)`，以便业务侧接入其他选择器后仍复用组件的 `v-model` 与 `change` 事件。

```vue
<SegmentPanel v-model="activeType" title="通道筛选" :options="typeOptions">
  <template #title>
    <PageTitle />
  </template>
  <template #segmented="{ value, options, change }">
    <a-radio-group :value="value" :options="options" @update:value="change" />
  </template>
  <ChannelList />
</SegmentPanel>
```
