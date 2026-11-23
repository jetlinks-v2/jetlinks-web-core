# Splitter

平台双面板布局，参考 [Ant Design Splitter](https://ant.design/components/splitter-cn/) 的分割条交互，使用 Vue 和平台 token 实现；不是 Ant Design Vue 官方组件。从 core 组件入口具名导入 `Splitter`，不做全局注册。

```vue
<Splitter v-model:size="navigationSize" :min="160" :max="360" :end-min="320" resize-label="调整导航宽度">
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
| `collapsed` / `v-model:collapsed` | 起始面板折叠状态；省略时由 `end` 插槽的 `toggle` 管理 | `false` |
| `resizeLabel` | 已翻译的分割条名称；省略时使用通用尺寸名称 | — |

`start` 和 `end` 为内容插槽。`end` 额外提供 `{ collapsed, toggle }`，由调用方将唯一折叠入口融入真实工具栏；组件不额外创建空头部或在分界线叠放折叠图标。布局可以嵌套，但一次只管理两个面板。上下分区需由宿主提供确定高度，默认填满容器。

`update:size` 与 `resize` 传递新的 px 尺寸。受控模式下调用方可以拒绝请求；外部合法尺寸变化不反射通知。更改 `defaultSize` 或方向会重设未受控的尺寸。边界始终受可用空间约束；空间无法同时容纳两个最小尺寸时，优先预留 `endMin`，起始面板允许小于 `min`。折叠不清除尺寸、不销毁内容实例，隐藏内容退出键盘访问；隐藏区域内的焦点返回末端面板，已在可见区域的焦点不变。折叠本身不触发尺寸通知。

分割条复用 [PanelResizeHandle](../PanelResizeHandle/README.md)：默认连续细线，hover 显示轻量把手；拖动结束不会打开菜单。点击、触屏轻触或键盘 Enter / Space 打开标准 Popover 调整尺寸，Esc 关闭并归还焦点；方向键、Home / End、双击重置和拖动取消使用同一边界。

组件不决定业务断点、不存储用户偏好、不管理抽屉。窄屏切换单栏或抽屉由宿主按任务选择。已有左右头部布局继续使用 `EqualHeightColumns`，它与 Splitter 共用分割条，不需要为替换名称而迁移。
