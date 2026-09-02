# ChatTextArea 使用说明

支持拖拽/粘贴文件上传与快捷发送的对话输入框。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `isLoading` | 发送或处理中的加载态 | `boolean` | false |
| `inputHeight` | 输入区高度 | `number` | 148 |
| `uploadCategories` | 允许的文件类别 | `string[]` | video/document/image/audio |
| `textareaPlaceholder` | 输入提示 | `string` | 内置提示 |
| `disabledWithValueTextareaPlaceholder` | 有文件且禁止输入时的提示 | `string` | - |
| `originFiles` | 待上传文件 | `File[]` | [] |
| `uploadedFiles` | 已上传文件 | `File[]` | [] |
| `isClearAll` | 是否清空全部状态 | `boolean` | false |
| `defaultInput` | 初始文本 | `string` |  |
| `isInputDisabled` | 禁止输入 | `boolean` | false |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `send` | 发送消息和文件 | `(message, files)` |
| `update:inputHeight` | 高度变化 | `(height)` |
| `update:inputMessage` | 输入值变化 | `(message)` |

#### 用法

~~~vue
<ChatTextArea
  v-model:input-height="height"
  :upload-categories="['image', 'document']"
  @send="sendMessage"
/>
~~~

#### Rules

- 文件大小和扩展名按类别校验：图片 10M、文档 50M、音频 100M、视频 200M。
- 发送事件只负责把消息交给业务层，上传请求由组件内部统一处理。
