# SelectableListCard

通用内容列表卡片。内容完全由默认插槽提供，`active` 仅负责选中视觉和无障碍状态。

```vue
<SelectableListCard :active="item.id === selectedId" @click="selectedId = item.id">
  <ChannelListItem :item="item" />
</SelectableListCard>
```

| 属性 / 事件 | 类型 | 说明 |
| --- | --- | --- |
| `active` | `boolean` | 显示主题色 20% 到主题背景的渐变与主题色 20% 边框。 |
| `disabled` | `boolean` | 禁止鼠标与键盘点击。 |
| `click` | `(nativeEvent) => void` | 点击或键盘触发时回调。 |
| 默认插槽 | `slot` | 卡片内部内容。 |
