# EqualHeightColumns 使用说明

双栏等高布局，限制子面板高度并允许各自内部滚动，左列可收起。

#### Props

| 参数 | 说明 | 类型 | 默认值            |
| --- | --- | --- |----------------|
| `height` | 容器高度 | `number \| string` | 100%           |
| `gap` | 列间距 | `number \| string` | var(--space-4) |
| `leftWidth` | 左列宽度 | `CSS grid track` | 15rem          |
| `rightWidth` | 右列宽度 | `CSS grid track` | 1fr            |
| `align` | 纵向对齐 | `CSS align-items` | stretch        |
| `collapsible` | 是否显示左列展开/收起按钮 | `boolean` | true           |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `collapse-change` | 左列展开状态变化 | `(collapsed: boolean)` |

#### 用法

~~~vue
<EqualHeightColumns :left-width="320" right-width="1fr">
  <template #left>筛选</template>
  <template #right>内容</template>
</EqualHeightColumns>

<!-- 不需要收起能力时显式关闭 -->
<EqualHeightColumns :collapsible="false">
  <template #left>筛选</template>
  <template #right>内容</template>
</EqualHeightColumns>
~~~

#### 收起行为

- 按钮固定在左列垂直中部、贴左列右边缘，展开显示 `DoubleLeftOutlined`，收起显示 `DoubleRightOutlined`。
- 圆角 `8px`，且**贴住的那一侧不留圆角**：展开时贴左列右边缘，故右侧为直角；收起后贴容器左边缘，故左侧为直角。
- 收起时左列宽度与 `gap` 同时归零，左列内容被裁剪，按钮回落到容器左边缘，右列占满整行；展开时恢复传入的 `leftWidth` / `gap`。
- 展开/收起带 `0.2s ease` 过渡：`grid-template-columns` / `column-gap` 插值收缩，按钮位移与之同节奏叠加，滑动过程连续无跳变。
- 展开状态由组件内部维护，父级只需按需监听 `collapse-change`。

#### Rules

- height、leftWidth、rightWidth 可使用 px、rem、百分比或 grid track。
- 左/右面板内容超出时应由面板内部处理滚动。
- 收起按钮不参与列宽计算，不会挤压右列；左列内容宽度不应依赖它自身的可见宽度。
- `leftWidth` 非长度轨道（如 `1fr`）时无法插值，展开/收起会退化为瞬时切换，不会报错或错位。
