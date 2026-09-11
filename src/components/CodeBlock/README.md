# CodeBlock 使用说明

代码/配置展示块，支持深浅色变体、复制按钮和内联模式。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `variant` | 颜色变体 | `dark \| light` | dark |
| `label` | 标题 | `string` | - |
| `content` | 代码文本 | `string` | - |
| `copyable` | 显示复制按钮 | `boolean` | false |
| `copyTitle` | 复制按钮提示 | `string` | 复制 |
| `showCopyLabel` | 显示复制文字 | `boolean` | false |
| `inline` | 内联模式 | `boolean` | false |

#### 事件

- 无自定义事件。

#### 用法

~~~vue
<CodeBlock
  label="请求示例"
  content='{"id":"device-a"}'
  copyable
/>
~~~

#### Rules

- content 是复制操作的真实来源；默认插槽只用于展示。
- 复制失败不会改变内容，调用方可在外层提供错误反馈。
