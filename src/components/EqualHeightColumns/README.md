# EqualHeightColumns 使用说明

双栏等高布局，限制子面板高度并允许各自内部滚动。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `height` | 容器高度 | `number \| string` | 100% |
| `gap` | 列间距 | `number \| string` | var(--space-4) |
| `leftWidth` | 左列宽度 | `CSS grid track` | 1fr |
| `rightWidth` | 右列宽度 | `CSS grid track` | 1fr |
| `align` | 纵向对齐 | `CSS align-items` | stretch |

#### 事件

- 无自定义事件。

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
