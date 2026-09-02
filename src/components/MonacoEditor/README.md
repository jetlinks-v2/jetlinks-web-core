# MonacoEditor 使用说明

Monaco 编辑器封装，适合 JSON、脚本和长文本编辑。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `modelValue` | 编辑内容 | `string \| number` | - |
| `theme` | 编辑器主题 | `string` | vs-dark |
| `language` | 编辑语言 | `string` | json |
| `codeTips` | 代码提示数据 | `array` | [] |
| `init` | 初始化回调 | `Function` | - |
| `registrationTips` | 自定义补全注册配置 | `object` | {} |
| `registrationTypescript` | TypeScript 类型注册配置 | `object` | {} |
| `blurFormat` | 失焦时格式化 | `boolean` | true |
| `readOnly` | 只读模式 | `boolean` | false |
| `options` | Monaco 配置 | `object` | {} |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `update:modelValue` | 内容变化 | `(value)` |
| `change` | 内容变化 | `(value)` |
| `blur` | 编辑器失焦 | `()` |
| `focus` | 编辑器聚焦 | `()` |
| `errorChange` | 诊断标记变化 | `(markers)` |

#### 用法

~~~vue
<MonacoEditor v-model="script" language="javascript" />
~~~

#### Rules

- 编辑器实例初始化和销毁由组件处理。
- options 只覆盖 Monaco 官方配置，不在业务侧直接操作 DOM。
