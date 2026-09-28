# EqualHeightColumns 使用说明

双栏等高布局，限制子面板高度并允许各自内部滚动。

#### Props

| 参数 | 说明 | 类型 | 默认值            |
| --- | --- | --- |----------------|
| `height` | 容器高度 | `number \| string` | 100%           |
| `gap` | 列间距 | `number \| string` | var(--space-8) |
| `leftWidth` | 左列宽度 | `CSS grid track` | 15rem          |
| `rightWidth` | 右列宽度 | `CSS grid track` | 1fr            |
| `align` | 纵向对齐 | `CSS align-items` | stretch        |
| `collapsible` | 是否显示左列展开/收起按钮，仅在 `showLeft=true` 时生效 | `boolean` | true |
| `showLeft` | 是否显示左列；隐藏时右列铺满容器 | `boolean` | true |

#### 事件

- `collapse-change(collapsed: boolean)`：点击按钮展开/收起左列时触发。切换 `showLeft` 不触发此事件。

#### 用法

~~~vue
<EqualHeightColumns :left-width="320" right-width="1fr">
  <template #left>筛选</template>
  <template #right>内容</template>
</EqualHeightColumns>
~~~

#### Rules

- height、leftWidth、rightWidth 可使用 px、rem、百分比或 grid track。
- 左/右面板内容超出时应由面板内部处理滚动。
- `showLeft=false` 时不渲染左列和折叠按钮，移除列间距和分割线，右列占满容器宽度，不受 `leftWidth` / `rightWidth` 限制。
- `showLeft` 切回 `true` 时恢复双栏配置和此前的折叠状态。

#### 当前调整

收起按钮相对组件容器绝对定位：展开时读取左侧面板实际宽度和列间距，将中缝位置写入内联 `left`；收起时回落到容器左边缘。通过 `ResizeObserver` 及属性变更同步 `1fr`、`2fr` 等弹性 Grid 轨道的尺寸变化，不改变双栏 API、面板尺寸或按钮交互。
