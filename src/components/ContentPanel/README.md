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
| `background`          | `boolean` | `true` | 为 `false` 时保留留白与圆角，但背景透明、去掉模糊与阴影。 |
| `fill`                | `boolean` | `false` | 为 `true` 时面板转为 flex 列容器（`flex: 1; min-height: 0`）并跳过空的标题区占位，供布局壳层撑满可用高度。 |
| `title` 插槽            | `slot` | - | 自定义标题内容；标题为 18px、600 字重。    |
| `titleRightRender` 插槽 | `slot` | - | 自定义标题右侧内容。                  |
| 默认插槽                  | `slot` | - | 区块内容。                       |

组件可通过全局组件名 `ContentPanel` 使用，也可从 `@jetlinks-web-core/components` 按需导入。

页面中需要承载一组内容时，优先使用此组件；只有需要图标标题栏、指标或实体摘要语义时才使用 `SectionCard` 或 `CardBox` 的专用变体。

## 布局壳层中的统一包裹

**项目布局**（`ProjectLayoutPage` → `BasicLayoutShell`）会用 `ContentPanel` 包裹路由内容，页面代码不需要自己包裹：

- 页面**没有**自己写 `ContentPanel` → 壳层面板生效，页面获得统一的白底、圆角、阴影与内边距。
- 页面**还写着** `ContentPanel` → 会出现双层卡片。页内面板要**逐页删除替换**，
  删掉后页面自动获得布局面板。壳层不判断页面内容（壳层跨路由常驻，按页面内容推断的状态会泄漏到下一个页面）。

租户端虽然复用同一个 `BasicLayoutShell`，但**不包裹**面板；应用端 `ApplicationLayoutPage` 自己决定是否包裹。
判定入口统一在 `src/layout/hooks/useRouteContentPanel.ts` 的 `CONTENT_PANEL_LAYOUT_VARIANTS`，
非项目布局不解析任何页面声明。

不需要面板、或只需要布局不要背景与阴影的页面，由所属模块在 `index.ts` 的
`getContentPanelOverrides()` 里声明（键为路由 `name`／`path`）：

```ts
// modules/authentication-manager-ui/index.ts
const getContentPanelOverrides = () => ({
  'project/Overview': false,                      // 不套面板，页面自绘背景
  'resources/Dashboard': { background: false },   // 要布局对齐，但不要白底与阴影
})
```

**代码侧声明，改完随代码生效，不需要重新初始化菜单**（`baseMenu.json` 只承载菜单数据，不再承载这个开关）。

需要放在**面板之外**的页面头部（返回按钮、卡片切换、页签）用 [`PageChrome`](../PageChrome/README.md)。

`fill` 模式下插槽内容成为 flex 项：自己算高度的整屏页面保持默认，
按内容高度排布并由面板滚动的页面写 `flex: 0 0 auto`。不要依赖百分比高度，壳层链路是 flex 定高。

### 路由 meta

```ts
meta: {
  contentPanel: false,                    // 不包裹面板，页面自绘背景（全屏画布 / iframe）
  contentPanel: { background: false },    // 保留留白与圆角，去掉白底、模糊与阴影
  contentPanel: { padding: 0 },           // 覆盖内边距
  contentPanel: { title: '设备概览' },      // 面板标题
}
```

契约、页面迁移清单与风险见 `docs/页面内容面板与页面头部插槽.md`。
