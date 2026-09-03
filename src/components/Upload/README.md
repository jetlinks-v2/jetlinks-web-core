# Upload 使用说明

文件与图片上传组件族：ProUpload、ImageUpload、UploadCropper。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `modelValue/value` | 文件地址或文件列表 | `string \| File[]` | - |
| `accept` | 接受的 MIME 类型 | `string` | - |
| `types` | 允许的 MIME 类型数组 | `string[]` | 图片默认 jpeg/png |
| `size` | 单文件大小上限 MB | `number` | 2 |
| `maxCount` | 最大文件数 | `number` | 1 |
| `disabled` | 禁用 | `boolean` | false |
| `publicAccess` | 是否公开访问 | `boolean` | false |
| `isUpload` | 是否真正上传 | `boolean` | true |
| `listType` | 列表样式 | `text \| picture \| picture-card` | text |
| `bgImage` | 背景图 | `string` | - |
| `borderStyle` | 边框样式 | `CSSProperties` | - |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `update:modelValue/update:value` | 上传结果变化 | `(url \| fileList)` |
| `change` | 上传状态变化 | `(value)` |
| `remove` | 移除文件 | `(file)` |
| `cropVisibleChange` | 裁剪弹窗变化（ImageUpload） | `(visible)` |

#### 用法

~~~vue
<ImageUpload v-model="imageUrl" :size="5" />
<ProUpload v-model:value="files" :max-count="3" />
~~~

#### Rules

- 上传请求、请求头和文件地址转换沿用 core 的统一上传工具。
- ImageUpload 默认支持图片裁剪；File 上传使用 value 事件，ImageUpload 使用 modelValue。
- 大小限制按 MB 校验，types 优先于 accept 的默认限制。
