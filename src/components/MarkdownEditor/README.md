# MarkdownEditor 使用说明

Markdown 编辑/预览组件，支持图片与文件拖拽、粘贴、上传和章节模板。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `modelValue` | Markdown 文本 | `string` |  |
| `rows` | 默认行数 | `number` | 12 |
| `placeholder` | 输入提示 | `string` | - |
| `disabled` | 只读/预览态 | `boolean` | false |
| `language` | 编辑语言 | `string` | - |
| `theme` | 编辑器主题 | `light \| dark` | light |
| `toolbars` | 工具栏配置 | `ToolbarNames[]` | 默认工具栏 |
| `texts` | 文案覆盖 | `Partial<MarkdownEditorTexts>` | {} |
| `showUploadFileToolbar` | 显示文件上传工具 | `boolean` | true |
| `sectionTemplates` | 章节模板 | `SectionTemplate[]` | [] |
| `domainHint` | 领域提示 | `string` | - |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `update:modelValue` | 内容变化 | `(value: string)` |

#### 用法

~~~vue
<MarkdownEditor
  v-model="content"
  :section-templates="templates"
  domain-hint="支持 Markdown"
/>
~~~

#### Rules

- disabled=true 或 readonly=true 时只显示预览；空内容会显示 CloudEmpty。
- 图片插入为 ![]()，其他文件插入为 []()，上传协议由组件内部统一处理。
