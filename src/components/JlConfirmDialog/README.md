# JlConfirmDialog 使用说明

统一确认弹窗，提供 info、warn、danger 语义色和确认/取消操作。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `open` | 是否打开 | `boolean` | 必填 |
| `title` | 标题 | `string` | - |
| `message` | 提示内容 | `string` | 必填 |
| `confirmText` | 确认按钮文案 | `string` | 确认 |
| `cancelText` | 取消按钮文案 | `string` | 取消 |
| `tone` | 语义色 | `info \| warn \| danger` | warn |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `confirm` | 确认操作 | `()` |
| `cancel` | 取消操作 | `()` |
| `update:open` | 弹窗状态变化 | `(open: boolean)` |

#### 用法

~~~vue
<JlConfirmDialog
  v-model:open="visible"
  title="删除项目"
  message="删除后无法恢复，确定继续吗？"
  tone="danger"
  @confirm="remove"
/>
~~~

#### Rules

- message 支持有限 HTML 渲染，传入内容必须来自可信来源。
- 使用 tone 表达风险级别，不在 message 中重复堆叠颜色说明。
