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

#### 插槽

| 名称 | 说明 |
| --- | --- |
| `toolbar-actions` | 独立顶栏中的附加操作，与章节模板、领域提示并列。 |
| `toolbar-right` | 编辑工具栏右侧的附加内容，默认位于预览／全屏按钮之前，随编辑器进入全屏；只读／空预览时显示在预览区域顶部右侧。 |

`toolbar-right` 复用 `md-editor-v3` 的公开 `defToolbars` 扩展点；自定义工具栏索引 `0` 保留给文件上传，`1` 保留给右侧内容。自定义 `toolbars` 可显式放置 `1`；省略时自动插入到 `=` 右侧，没有 `=` 时在末尾建立右侧区域。未传入插槽时不调整现有工具栏。

传入右侧插槽时，右侧操作区保持完整宽度；窄屏仅由左侧格式工具区承接横向滚动，键盘聚焦格式按钮时会滚入可视区。未传插槽的页面沿用原有布局。

~~~vue
<MarkdownEditor v-model="content">
  <template #toolbar-right>
    <a-segmented v-model:value="language" :options="languageOptions" size="small" />
  </template>
</MarkdownEditor>
~~~

运行时生产用法：`modules/authentication-manager-ui/views/application-center/Template/Save/DocumentPane.vue`，语言选择复用已有 i18n 文案，文档草稿仍由业务页管理。

#### Rules

- disabled=true 或 readonly=true 时只显示预览；空内容会显示 CloudEmpty。
- 图片插入为 ![]()，其他文件插入为 []()，上传协议由组件内部统一处理。
