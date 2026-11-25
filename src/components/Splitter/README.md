# Splitter

平台双面板布局，参考 [Ant Design Splitter](https://ant.design/components/splitter-cn/) 的分割条交互，使用 Vue 和平台 token 实现；不是 Ant Design Vue 官方组件。从 core 组件入口具名导入 `Splitter`，不做全局注册。

```vue
<Splitter v-model:size="navigationSize" collapse-on-drag :min="160" :max="360" :end-min="320" resize-label="调整导航宽度">
  <template #start>导航或列表</template>
  <template #end="{ collapsed, toggle, startId }">
    <header>
      <PanelCollapseButton :collapsed="collapsed" :aria-controls="startId"
        :label="collapsed ? '展开导航' : '收起导航'" @toggle="toggle" />
      主区标题
    </header>
    主区内容
  </template>
</Splitter>
```

| 属性 | 含义 | 默认值 |
| --- | --- | --- |
| `orientation` | `horizontal` 左右分区，`vertical` 上下分区 | `horizontal` |
| `size` / `v-model:size` | 起始面板受控尺寸，单位 px；省略时内部保留拖动结果 | 未设置 |
| `defaultSize` | 未调整时的 CSS 长度或百分比，数字按 px | `30%` |
| `min` / `max` | 起始面板尺寸边界，单位 px | `0` / 无上限 |
| `endMin` | 末端面板预留尺寸，单位 px | `0` |
| `resizable` | 显示分割条，允许拖动、键盘及点击调节 | `true` |
| `collapseOnDrag` | 继续拖过最小尺寸后预览折叠，松手确认；宿主需保留展开入口 | `false` |
| `collapsed` / `v-model:collapsed` | 起始面板折叠状态；省略时由 `end` 插槽的 `toggle` 管理 | `false` |
| `resizeLabel` | 已翻译的分割条名称；省略时使用通用尺寸名称 | — |

`start` 和 `end` 为内容插槽。`end` 额外提供 `{ collapsed, toggle, startId }`，由调用方将折叠入口融入真实工具栏；`startId` 用于按钮的 `aria-controls`。入口可复用 [PanelCollapseButton](../PanelCollapseButton/README.md)，也可使用宿主已有的真实按钮；组件不额外创建空头部。上下分区需由宿主提供确定高度，并将相同 `orientation` 传给面板开关。布局可以嵌套，但一次只管理两个面板。

`update:size` 与 `resize` 传递新的 px 尺寸。受控模式下调用方可以拒绝请求；外部合法尺寸变化不反射通知。更改 `defaultSize` 或方向会重设未受控的尺寸。边界始终受可用空间约束；空间无法同时容纳两个最小尺寸时，优先预留 `endMin`，起始面板允许小于 `min`。折叠不清除尺寸、不销毁内容实例，隐藏内容退出键盘访问；隐藏区域内的焦点返回末端面板，已在可见区域的焦点不变。折叠本身不触发尺寸通知。

分割条复用 [PanelResizeHandle](../PanelResizeHandle/README.md)：默认连续细线，hover 显示轻量把手，不弹出尺寸菜单。方向键、Home / End、双击或 Enter / Space 复位和拖动取消使用同一边界。

启用 `collapseOnDrag` 后，请求尺寸小于有效最小尺寸的一半时，以面板内缘两端渐隐的柔和阴影表达收拢意图；拖动期间保持合法最小尺寸，不跳到 0。回拖到最小尺寸的 60% 时撤销意图，避免临界往返时反复闪烁。松手才请求折叠，并保留拖动前的展开尺寸；辅助技术保留“松开收起”提示。

允许调宽时，分隔器占用独立的 12px 拖拽槽；空间不足时优先保证末端内容区，拖拽槽和起始区随可用空间收紧。折叠后隐藏整条分割线，继续复用分割条的同款细握柄：hover 时浅灰，键盘聚焦或拖动时使用主题色，触屏保持可见，不额外绘制箭头或胶囊底座。普通 hover 和键盘聚焦不显示投影；只有拖动达到确认阈值时显示窄幅贴边投影：收拢预览向起始面板内部，展开预览反向投向主区边缘，两端渐隐和模糊参数保持一致。投影限制在边缘 6px 范围，不形成宽灰带、不截获输入；确认收起 / 展开时立即隐藏，避免换边淡出造成闪烁。握柄与命中区留在槽内。点击或 Enter / Space 恢复之前保留的尺寸；展开后 Enter / Space 恢复默认尺寸。

向右拖动可揭开左区，上下布局则向下拖动。展开预览可以小于最小尺寸，内容保持至少最小尺寸并裁切，预览期间不发布尺寸 / 折叠状态。展开和收拢复用同一确认阈值与回拖缓冲，仅方向相反：拉过有效最小尺寸的 50% 才显示展开投影，回拉至 40% 时撤销；辅助技术提示“松开展开”。松手按当前意图确认，展开后应用合法尺寸。尚未进入或已撤销意图、Esc、指针取消或捕获丢失均返回折叠状态，保留原尺寸和草稿。键盘增大及双击复位也可以展开；工具栏展开按钮继续恢复之前保留的尺寸。

只有确认后的收起 / 展开使用平台快速过渡，普通调宽和揭开预览直接跟随指针；过渡与揭开期间固定必要的内容尺寸，避免文字反复重排，并遵循减少动态效果设置。受控宿主可以拒绝请求。约束 / 方向变化、禁用与卸载会取消正在进行的拖动。分割条只强调中央把手，细线保持弱化；阴影不截获输入、不改变两区的尺寸约束。

阈值依据参考 [VS Code SplitView 的半最小尺寸吸附](https://github.com/microsoft/vscode/blob/main/src/vs/base/browser/ui/splitview/splitview.ts) 与 [react-resizable-panels 的默认中点阈值](https://github.com/bvaughn/react-resizable-panels/blob/main/README.md#panel)，折叠过渡参考 [Ant Design Splitter](https://ant.design/components/splitter/)。保留拖动约束、以提示预览意图并在释放时确认，是本组件沿既有提交契约的组合选择。

独立占位参考 [Split.js 的 gutter 布局](https://github.com/nathancahill/split/tree/master/packages/splitjs#gutteralign-default-center)；完全折叠后保留拖动入口的依据见 [react-resizable-panels 折叠示例](https://react-resizable-panels.vercel.app/examples/collapsible-panels)。本组件沿用现有分割把手的 12px 命中宽度，并将其计入布局预算，避免覆盖业务内容。

折叠握柄借鉴 [Apple Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets) 用抓手提示可拖动、[Apple Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars) 保留恢复入口的原则；此处沿用平台分割条的视觉语言，并非 iOS 原生侧栏样式。

组件不决定业务断点、不存储用户偏好、不管理抽屉。窄屏切换单栏或抽屉由宿主按任务选择。已有左右头部布局继续使用 `EqualHeightColumns`，它与 Splitter 共用分割条，不需要为替换名称而迁移。
