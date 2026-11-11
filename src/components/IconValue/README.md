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

#### 值格式与兼容

- 字体图标使用 `font:<图标名>`，例如 `font:StepBackwardOutlined`；配套的 `IconValueEditor` 通过 `v-model` 输出该格式。
- `iconValue.ts` 兼容 `IconLibrary` 输出的有效 Ant Design 裸图标名，例如 `StepBackwardOutlined`。兼容范围限定为当前图标包实际导出的 `Outlined`、`Filled`、`TwoTone` 图标，已有数据无需迁移。
- 颜色使用 `color:<颜色>[:标签]`，图片使用 URL 或 `img:<URL>`；普通文本及未知图标名继续显示缩写。
- 在 `jetlinks-web-core/` 下执行 `node --test tests/iconValue.test.mjs`：5 项回归通过，覆盖格式分类、真实图标 SVG 渲染、编辑器裸图标回显与选择后输出 `font:` 值。
- `iconValue.ts` 定向严格类型检查通过：`pnpm exec tsc --target ES2022 --module ESNext --moduleResolution Bundler --lib ES2022,DOM --strict --skipLibCheck --noEmit --types node src/components/IconValue/iconValue.ts`。显式限定 Node 类型，避免工作区隐式加载缺失的 `uts` 类型。
