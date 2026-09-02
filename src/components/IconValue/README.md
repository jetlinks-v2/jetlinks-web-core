# IconValue 使用说明

统一图标值展示与编辑：IconValueView 用于展示，IconValueEditor 支持颜色、字体图标和图片。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `value/modelValue` | 图标值或编辑值 | `string \| null` |  |
| `size/previewSize` | 展示或预览尺寸 | `number` | 48/56 |
| `fallbackText/previewFallback` | 无值时文本 | `string` |  |
| `round/roundPreview` | 圆形展示 | `boolean` | false |
| `safeColors` | 允许的颜色列表 | `string[]` | - |
| `enableCropUpload` | 启用裁剪上传 | `boolean` | true |
| `texts` | 编辑器文案覆盖 | `Partial<IconValueEditorTexts>` | {} |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `update:modelValue` | 图标值变化 | `(value)` |
| `cropVisibleChange` | 裁剪弹窗显示变化 | `(visible)` |
| `libraryVisibleChange` | 图标库显示变化 | `(visible)` |

#### 用法

~~~vue
<IconValueView :value="iconValue" />
<IconValueEditor v-model="iconValue" :enable-crop-upload="false" />
~~~

#### Rules

- IconValueEditor 的图片上传会使用统一上传契约和裁剪配置。
- 业务状态、权限和持久化由调用方负责。
