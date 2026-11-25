# PanelCollapseButton

工具栏里的无状态面板开关，从 core 入口具名导出，不全局注册。使用分区轮廓和方向箭头表达展开 / 收起，固定 32px 方形点击区域；默认无边框和底色，hover 使用平台中性色，保留 Button 的键盘焦点和原生激活行为。

```vue
<PanelCollapseButton :collapsed="collapsed" :orientation="orientation" :aria-controls="panelId"
  :label="collapsed ? '展开任务列表' : '收起任务列表'" @toggle="toggle" />
```

- `collapsed`：必填，宿主持有的实际折叠状态。
- `orientation`：`horizontal`（默认）控制左区；`vertical` 控制上区，图标相应旋转。
- `label`：可选，当前动作的已翻译名称，同时用于可访问名称和原生提示；默认使用通用“展开面板 / 收起面板”。
- `toggle`：只表达用户切换意图，不自行修改状态。`aria-controls`、`disabled`、`class` 等属性透传到 Button。

按钮负责入口视觉、名称与 `aria-expanded`；布局宿主负责按钮位置、控制关系、折叠真值、尺寸恢复、内容和焦点保留。`Splitter` 通过 `end` 插槽的 `startId` 提供受控面板 ID，`EqualHeightColumns` 沿用自身的受控区域 ID。开关不管理拖动、阴影、存储或业务状态，也不自动插入工具栏。
