# ResponsiveGrid 使用说明

响应式栅格容器，支持固定列数、最小列宽、最大列宽和 auto-fill/auto-fit。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `cols` | 固定列数 | `number` | - |
| `min` | 最小列宽 | `number \| string` | 12.5rem |
| `max` | 每列最大宽度 | `number \| string` | - |
| `gap` | 栅格间距 | `number \| string` | 12 |
| `fill` | 自动填充策略 | `auto-fill \| auto-fit` | auto-fill |

#### 事件

- 无自定义事件。

#### 用法

~~~vue
<ResponsiveGrid :min="240" gap="16px">
  <EntityCard v-for="item in items" :key="item.id" />
</ResponsiveGrid>
~~~

#### Rules

- 传 cols 时忽略 min/fill，并按固定列数布局。
- 子项应允许 min-width: 0，避免长文本撑破栅格。
