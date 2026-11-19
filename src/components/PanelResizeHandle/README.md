# PanelResizeHandle

二列 Grid 工作区的右侧分界线，从 core 组件入口具名导出，不做全局注册。父级持有 `v-model` 宽度并用于第二列，传入 `container` 工作区元素和已翻译的 `aria-label`；分界线与右栏共同定位在第二列第一行，以覆盖方式命中，不额外占一列。

`limits` 可指定 `min`（默认 320）、`max`（640）、`contentMin`（360）及 `initial`（360）。有效宽度受当前容器剩余空间约束；外部宽度或约束变化后回写合法值。容器不足以容纳两栏时，父级负责切回单栏并隐藏分界线。组件不决定断点、不管理折叠、业务草稿或偏好存储。

```vue
<div ref="workspace" :style="{ display: 'grid', gridTemplateColumns: `minmax(0, 1fr) ${panelWidth}px` }">
  <main>主区</main>
  <PanelResizeHandle v-model="panelWidth" :container="workspace" aria-label="调整属性面板宽度" />
  <aside style="grid-column: 2; grid-row: 1">属性</aside>
</div>
```

- 向左拖动增宽右栏；左右方向键每次调节 16px，Home／End 使用边界，双击恢复初始宽度。
- 分界线中部有常驻“调整面板宽度”按钮，打开标准 Popover 后可直接点击“缩窄面板”“加宽面板”“恢复默认宽度”。达到边界时对应按钮禁用，不要求拖动或记忆键盘快捷键。
- 动作弹层内按 Esc 关闭弹层并将焦点交回触发按钮。
- Esc、指针取消或意外丢失指针捕获会回到本次拖动前宽度；正常抬起提交当前宽度，卸载释放捕获。
- 分界线提供独立 `separator` 的方向、宽度范围与当前值；点击按钮是其兄弟节点，不嵌套在会吞掉子语义的 separator 内。调用者的 `aria-label`、`aria-controls`、`title` 等属性落到分界线，`class` / `style` 保留在布局根节点。

展开动作区沿当前主题环境，按钮与分界线均保留键盘焦点。复用该组件不代表整个宿主已经通过完整可访问性验收。
