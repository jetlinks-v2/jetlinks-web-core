# Splitter

平台双面板布局，参考 [Ant Design Splitter](https://ant.design/components/splitter-cn/) 的分割条交互，使用 Vue 和平台 token 实现；不是 Ant Design Vue 官方组件。从 core 组件入口具名导入 `Splitter`，不做全局注册。

```vue
<Splitter v-model:size="navigationSize" collapse-on-drag :min="160" :max="360" :end-min="320" resize-label="调整导航宽度">
  <template #start>导航或列表</template>
  <template #end="{ collapsed, toggle }">
    <header>
      <a-button type="text" :aria-expanded="!collapsed" :aria-label="collapsed ? '展开导航' : '收起导航'" @click="toggle">
        <AIcon :type="collapsed ? 'MenuUnfoldOutlined' : 'MenuFoldOutlined'" />
      </a-button>
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

`start` 和 `end` 为内容插槽。`end` 额外提供 `{ collapsed, toggle }`，由调用方将唯一折叠入口融入真实工具栏；组件不额外创建空头部或在分界线叠放折叠图标。布局可以嵌套，但一次只管理两个面板。上下分区需由宿主提供确定高度，默认填满容器。

`update:size` 与 `resize` 传递新的 px 尺寸。受控模式下调用方可以拒绝请求；外部合法尺寸变化不反射通知。更改 `defaultSize` 或方向会重设未受控的尺寸。边界始终受可用空间约束；空间无法同时容纳两个最小尺寸时，优先预留 `endMin`，起始面板允许小于 `min`。折叠不清除尺寸、不销毁内容实例，隐藏内容退出键盘访问；隐藏区域内的焦点返回末端面板，已在可见区域的焦点不变。折叠本身不触发尺寸通知。

分割条复用 [PanelResizeHandle](../PanelResizeHandle/README.md)：默认连续细线，hover 显示轻量把手；拖动结束不会打开菜单。点击、触屏轻触或键盘 Enter / Space 打开标准 Popover 调整尺寸，Esc 关闭并归还焦点；方向键、Home / End、双击重置和拖动取消使用同一边界。

启用 `collapseOnDrag` 后，请求尺寸小于有效最小尺寸的一半时显示“松开收起”；拖动期间面板保持合法最小尺寸，不跳到 0。拖回中点以上撤销意图，松手才通过既有 `update:collapsed` 请求折叠，并保留本次拖动前的展开尺寸。只有确认后的收起 / 展开使用平台快速过渡，普通调宽不加缓动；过渡期间固定内容尺寸以避免文字反复重排，并遵循减少动态效果设置。受控宿主可拒绝请求。Esc、指针取消、捕获丢失和约束变化撤销意图；方向切换或卸载不提交折叠。键盘尺寸操作保留原边界，工具栏提供展开入口。分割条只强调中央把手，整条细线保持弱化。

阈值依据参考 [VS Code SplitView 的半最小尺寸吸附](https://github.com/microsoft/vscode/blob/main/src/vs/base/browser/ui/splitview/splitview.ts) 与 [react-resizable-panels 的默认中点阈值](https://github.com/bvaughn/react-resizable-panels/blob/main/README.md#panel)，折叠过渡参考 [Ant Design Splitter](https://ant.design/components/splitter/)。保留拖动约束、以提示预览意图并在释放时确认，是本组件沿既有提交契约的组合选择。

组件不决定业务断点、不存储用户偏好、不管理抽屉。窄屏切换单栏或抽屉由宿主按任务选择。已有左右头部布局继续使用 `EqualHeightColumns`，它与 Splitter 共用分割条，不需要为替换名称而迁移。
