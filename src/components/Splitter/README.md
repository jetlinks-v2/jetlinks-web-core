# Splitter

## 与内容表面组合

`Splitter` / `ResponsiveSplitter` 负责分区、尺寸和收放，外层表面沿用 [ContentPanel 的连续工作区组合](../ContentPanel/README.md#连续分区工作区)。同一工作区只保留一个背景和外框，分区根不重复设置 border、圆角或外圈 padding；留白放在 `start` / `end` 内容内部。共享头部的结构线接到外沿，分割线从头部下沿贯穿正文；输入与内容卡片的边框保持独立。

宿主约束高度后，布局作为 `flex: 1; min-height: 0` 的正文填满，避免固定示例高度导致短屏溢出或长屏分割线悬空。独立左右头部继续使用 `EqualHeightColumns`；视觉统一不改变调宽、折叠、焦点和响应式状态的 owner。

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

## 响应式收放

需要内置抽屉时优先使用根入口具名导出的 `ResponsiveSplitter`。它组合 `Splitter`、公共握柄与 Ant Drawer，按容器主轴的 `min + endMin + 恢复槽` 判断是否能并排展示；`min` 和 `endMin` 必填，由内容确定，不按设备名称硬编码断点。方向、尺寸、折叠模型与 Splitter 一致；`panelTitle` 为已翻译的抽屉标题。

`start` 插槽提供 `{ compact, close }`，选择内容后可调用 `close(target?)` 将焦点交给下一任务；`end` 提供 `{ collapsed, toggle, compact, overlayOpen, startId }`，供宿主放置可见恢复入口。外部工具栏也可通过组件 ref 读取 `collapsed/startId` 并调用 `toggle()`。它不自动生成业务工具栏。

窄容器保留独立边缘恢复槽，鼠标12px、粗指针24px。点击或向内拖动可打开同一内容实例的临时抽屉，拖动中直接跟随指针、松手过半确认、回拉至40%撤销；短拖、Esc、捕获丢失与布局切换可取消。列表区域正常滚动，不绑定全页边缘手势；触屏工具栏与关闭动作保持44px。关闭和选择不修改宽布局偏好，变宽只恢复被自动隐藏的面板及其尺寸。抽屉预览不覆盖业务内容的输入命中区，内容通过 Teleport 转移，不重建表单或列表。

从 core 根入口具名导入 `useResponsivePanel(preference, compact)`，可与 `Splitter` 或 `EqualHeightColumns` 组合。`preference` 是宿主持有的可写折叠偏好 ref（或 writable computed）；`compact` 是只读的空间不足条件。容器尺寸由宿主测量，断点按内容所需空间选择，不在公共组件内硬编码设备宽度。

```ts
const { inlineCollapsed, collapsed, overlayOpen, setCollapsed, toggle, close } =
  useResponsivePanel(preference, compact)
```

- `inlineCollapsed` 控制原位分区：窄容器收起，否则沿用手动偏好。绑定布局的 `collapsed`，用 `@update:collapsed="setCollapsed"` 接收手动操作。
- `collapsed` 表示内容当前是否可见，供恢复按钮的图标与 `aria-expanded` 使用；窄容器中打开抽屉时为 false。
- `overlayOpen` 是临时覆盖状态；`toggle` 在宽布局修改偏好，在窄布局只打开 / 关闭临时抽屉。`close` 只关闭覆盖层。
- `drag(event, extent)` 接收 `PanelResizeHandle` 的归一化事件和抽屉主轴尺寸；`revealSize` 提供临时揭开尺寸，`revealIntent` 表示超过中点的确认意图。回拉到40%撤销，松手才打开覆盖层；取消、关闭和布局切换清除预览。
- 自动收起、关闭抽屉、选择导航项均不写回手动偏好；变宽后只恢复被自动收起的面板，手动收起仍然有效。每次切换布局都会结束临时覆盖，重新变窄不会自动弹出抽屉。

宿主负责抽屉的标题、位置、关闭、焦点和业务选择事件。使用同一个内容实例在原位分区与抽屉间移动，可通过 Vue Teleport 保留草稿、选中项、滚动和内部状态；避免用 `v-if / v-else` 重建两份内容。窄布局不显示无实际调宽空间的分隔器，可复用折叠握柄作为边缘恢复入口，并将其命中区独立占位，避免覆盖内容。恢复宽布局时保留调宽结果，后台布局变化不抢走主区焦点。

公共验收页直接使用 `ResponsiveSplitter`，临时抽屉只覆盖本工作区。`SplitterPreview.vue` 仅负责业务内容、选择和工具栏位置；内容转移、焦点与原尺寸保留由公共组合组件负责。

设计依据：[Fluent Drawer](https://fluent2.microsoft.design/components/web/react/core/drawer/usage) 区分原位与覆盖式辅助面板及响应式收放；[Fluent Drawer best practices](https://github.com/microsoft/fluentui/blob/master/packages/react-components/react-drawer/stories/src/Drawer/DrawerBestPractices.md) 展示按可用空间切换两种模式；[APG Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) 说明弹层焦点、关闭和返回入口的关系。断点、手动偏好保留和具体覆盖范围是结合平台场景的选择。
