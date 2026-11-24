# SelectOption

候选项内容组件，从 `@jetlinks-web-core/components` 具名导出。呈现可选的语义图标、主名称与次级短说明；不拥有选择状态、键盘导航、查询或提交行为，这些由 Select / Menu 等宿主承担。

Props：`label?: string | number`、`icon?: string`、`description?: string`。`icon` 插槽可替换默认图标内容。使用已有名称和元数据，说明只补充用途、差异或影响，不重复维护业务枚举文本。

```vue
<a-select v-model:value="value" :options="options" option-filter-prop="label" option-label-prop="label">
  <template #option="option">
    <SelectOption :label="option.label" :icon="option.icon" :description="option.description" />
  </template>
</a-select>
```

`options` 保留文字 `label` 与真实 `value`，确保搜索和可访问名称正确；不要把整个 label 变成只有图标的 VNode。展开态突出名称，说明采用可读的次级文字色，不使用禁用色。名称已表达图标含义时，默认图标不重复播报；自定义图标插槽由宿主保留相同语义。

紧凑选中态优先由宿主选择名称或图标 + 名称，去掉说明。组件还兼容被渲染在 Ant Select 已选值中的情况，但不能将该 CSS 兼容行为当成任意菜单或选择器都具备完整紧凑模式。

场景示例见 `src/views/interaction-examples/FormExample.vue` 与 `ConfigurationExample.vue`。没有合适语义图标或需要短说明时可省略对应 prop；不强制给每个简单枚举增加装饰。
