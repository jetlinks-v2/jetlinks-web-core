# EqualHeightColumns

双列等高布局。宿主提供工作区高度，内容按任务自行处理滚动；组件负责左列折叠，不决定业务导航、窄屏断点或草稿存储。

## Props

| 参数 | 说明 | 默认值 |
| --- | --- | --- |
| `height` | 容器高度，`number \| string` | `100%` |
| `gap` | 列间距，`number \| string` | `var(--space-8)` |
| `leftWidth` / `rightWidth` | CSS Grid 轨道宽度 | `15rem` / `1fr` |
| `align` | 纵向 `align-items` | `stretch` |
| `collapsible` | 允许折叠；设为 `false` 时展开内容并移除入口，不覆盖保存的折叠状态 | `true` |
| `collapsed` | 可选受控折叠，支持 `v-model:collapsed`；未传入时由组件维护 | 未设置 |
| `showLeft` | 结构开关；设为 `false` 会卸载左列、隐藏入口并让右列占满 | `true` |

显式 `collapsed=false` 属于受控状态。点击仅请求新状态，宿主未接受时仍按传入值显示。外部改值、切换 `showLeft` 或 `collapsible` 不产生用户操作事件。

## 事件

- `update:collapsed(boolean)`：用户点击时请求更新折叠状态。
- `collapse-change(boolean)`：兼容原有点击通知，参数为本次请求的状态；受控宿主可能拒绝该请求。

## 插槽与入口

- `left-header`：左区的真实标题或搜索控件。折叠图标位于内容前，同一顶行使用 `var(--space-3)` 内距和 `2rem` 按钮，插槽内容为 `flex: 1; min-width: 0`，可直接放 `a-input`。同时存在 `right-header` 时仍只在左区显示入口。
- `right-header`：主区标题／搜索工具栏。只有未提供 `left-header` 时，折叠入口才位于该工具栏前部，随主区起点移动；收起后左列归零，`right` 填满工具栏下方空间。
- `left` / `right`：两列内容。都未提供头部插槽时，左区内部增加仅含折叠按钮的紧凑顶行，不生成标题、不覆盖内容；`collapsible=false` 时不增加这条空顶行。

左区入口模式收起后，保留同样内距和按钮所需的窄区，展开、收起前后按钮坐标稳定。没有独立于左区的额外控制列。

```vue
<EqualHeightColumns v-model:collapsed="navigationCollapsed" left-width="15rem">
  <template #left-header><a-input v-model:value="navigationSearch" placeholder="搜索对象" /></template>
  <template #left>对象导航</template>
  <template #right-header>搜索与当前范围</template>
  <template #right>当前对象内容</template>
</EqualHeightColumns>
```

折叠保持左列内容及左头部控件的实例、输入和滚动位置；隐藏内容退出焦点顺序和辅助技术阅读。焦点原在被隐藏的左区正文或头部控件时才移回折叠入口，右区焦点不受影响。展开状态与被控制区域沿真实按钮关联，不依赖 hover。

`showLeft=false` 与折叠不同：左列被卸载，草稿／选择等必要状态由宿主持有；宿主还须提供窄屏对象选择入口及相应焦点恢复。切回 `true` 时恢复此前折叠偏好。不要把临时窄屏模式直接写回 `collapsed`。

原 props、内容插槽和点击事件仍兼容，入口按头部插槽归属唯一呈现。需要调宽时组合 `PanelResizeHandle` 等适用能力，折叠按钮不显示拖动光标；布局过渡尊重减少动态效果偏好。
