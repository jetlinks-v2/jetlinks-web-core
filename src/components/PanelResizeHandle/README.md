# PanelResizeHandle

Grid 工作区的面板分界线，从 core 组件入口具名导出，不做全局注册。父级持有 `v-model` 宽度，传入 `container` 工作区元素和已翻译的 `aria-label`。`side` 表示被调整面板的位置，默认 `right`；左侧面板使用 `left`，相应改变拖动和方向键的增减方向。默认根布局覆盖在第二列起点，其他轨道组合可通过根节点公开的 `class` / `style` 定位；`EqualHeightColumns` 已内置左侧调宽组合。

`limits` 可指定 `min`（默认 320）、`max`（640）、`contentMin`（360）及 `initial`（360）。有效尺寸受当前容器剩余空间约束，并保留调用者声明的 `min`；外部尺寸或约束变化后回写合法值。空间无法同时容纳两区时，宿主负责调整有效最小值或切回单栏。组件不决定断点、不管理折叠、业务草稿或偏好存储。`orientation="vertical"` 调整高度，使用指针 Y 和上 / 下方向键；此时 `side="left"` 表示上区，`right` 表示下区。默认 `horizontal` 调整宽度。新建纯分区布局优先使用已组合它的 [Splitter](../Splitter/README.md)。

```vue
<div ref="workspace" :style="{ display: 'grid', gridTemplateColumns: `minmax(0, 1fr) ${panelWidth}px` }">
  <main>主区</main>
  <PanelResizeHandle v-model="panelWidth" :container="workspace" aria-label="调整属性面板宽度" />
  <aside style="grid-column: 2; grid-row: 1">属性</aside>
</div>
```

- 右侧面板向左拖动增宽，左侧面板向右拖动增宽；方向键沿相同方向每次调节 16px，Home／End 使用边界，双击恢复初始宽度。
- 鼠标空闲时只显示连续细分界线；hover 显示轻量把手，键盘聚焦、拖动或菜单打开时仅高亮中央把手，焦点环也位于把手周围，整条细线保持弱化。把手属于可拖动的 separator，不叠放独立菜单按钮。点击分割条、触屏轻触或键盘 Enter / Space 打开标准 Popover 调整尺寸；拖动结束的合成 click 不打开菜单。触屏设备保持把手可见，达到边界时对应动作禁用。
- 动作弹层内按 Esc 关闭弹层并将焦点交回分割条。
- Esc、指针取消或意外丢失指针捕获会回到本次拖动前宽度；正常抬起提交当前宽度，卸载释放捕获。
- 分界线提供独立 `separator` 的方向、尺寸范围与当前值；弹层动作不嵌套在会吞掉子语义的 separator 内。调用者的 `aria-label`、`aria-controls`、`title` 等属性落到分界线，`class` / `style` 保留在布局根节点。

展开动作区沿当前主题环境，按钮与分界线均保留键盘焦点。复用该组件不代表整个宿主已经通过完整可访问性验收。

`drag` 事件提供 `PanelResizeDragEvent`：`phase` 为 `start/move/end/cancel`，`initialSize` 为本次拖动开始时的合法尺寸，`requestedSize` 为按方向归一化、尚未钳制的请求尺寸。宿主可据此实现越界预览，面板尺寸更新仍遵循原边界。正常松手才发送 `end`；取消、捕获丢失、约束 / 方向变化及卸载发送 `cancel`，释放捕获不会额外发送一次结束事件。该类型通过 core 根入口导出，折叠状态由 `Splitter` 等布局 owner 管理。
