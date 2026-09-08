# ContentPanel

统一内容区块容器：默认使用 80% 透明度的白色背景、16px 内边距、16px 圆角和 16px 元素间隔。标题可选，支持通过属性传入或使用同名插槽自定义；未提供标题时不会渲染标题区。

```vue
<ContentPanel title="设备概览">
  <DeviceOverview />
</ContentPanel>
```

不需要内边距时可传入 `0`：

```vue
<ContentPanel :padding="0">
  <DeviceOverview />
</ContentPanel>
```

```vue
<ContentPanel>
  <template #title>
    <a-space>
      <span>设备概览</span>
      <a-tag>实时</a-tag>
    </a-space>
  </template>
  <DeviceOverview />
</ContentPanel>
```

| 属性                    | 类型 | 默认值 | 说明                          |
|-----------------------| --- | --- |-----------------------------|
| `title`               | `string` | `''` | 可选标题；`#title` 插槽存在时优先使用插槽内容。 |
| `padding`             | `number` | `16` | 区块内边距，单位为 px；可传入 `0`。       |
| `title` 插槽            | `slot` | - | 自定义标题内容；标题为 18px、600 字重。    |
| `titleRightRender` 插槽 | `slot` | - | 自定义标题右侧内容。                  |
| 默认插槽                  | `slot` | - | 区块内容。                       |

组件可通过全局组件名 `ContentPanel` 使用，也可从 `@jetlinks-web-core/components` 按需导入。

页面中需要承载一组内容时，优先使用此组件；只有需要图标标题栏、指标或实体摘要语义时才使用 `SectionCard` 或 `CardBox` 的专用变体。
