# IconValue 使用说明

统一图标值展示与编辑：IconValueView 用于展示，IconValueEditor 支持颜色、字体图标和图片。

颜色扩展：`IconValueEditor` 提供 `color` 插槽（`value`、`updateValue`），允许调用方接入已有调色板；未提供插槽时沿用默认颜色输入。默认颜色区独立为 `IconValueColorEditor.vue`，维护颜色与色块文字草稿，字体、图片和持久化契约不变。应用模板的新增／编辑是该插槽的使用入口。

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
- `IconValueView.vue`、`IconValueEditor.vue` 与选择器复用 `IconLibrary/useIconfontSymbols.ts`，兼容已加载的裸 iconfont symbol ID，例如 `icon-tongzhiguanli`。按完整 ID 匹配，不限制前缀；资源异步加载或 symbol 增删、改名时更新展示与回显。多个卡片、编辑器及选择弹窗共享一份列表和一个监听器，最后一个消费者卸载时释放。
- 纯解析器不读取 DOM；直接调用时使用 `parseIconValue(value, loadedSymbolIds)` 提供 iconfont 列表。`font:` 格式无需列表即可识别，历史裸 ID 无需迁移；裸 ID 对应资源缺失时仍回退为文本缩写。
- 颜色使用 `color:<颜色>[:标签]`，图片使用 URL 或 `img:<URL>`；普通文本及未知图标名继续显示缩写。

#### 验证

在 `ui/jetlinks-web-core/` 下执行：

```shell
node --test tests/iconValue.test.mjs tests/iconLibrary.test.mjs
pnpm exec tsc --target ES2022 --module ESNext --moduleResolution Bundler --lib ES2022,DOM --strict --skipLibCheck --noEmit --types node src/components/IconValue/iconValue.ts src/components/IconLibrary/useIconfontSymbols.ts
pnpm exec vue-tsc --noEmit -p tests/tsconfig.icon-library.json
```

20 项检查通过（含浏览器父测试），覆盖格式分类、真实 SVG 渲染、编辑器裸图标回显与 `font:` 输出、默认颜色/标签及颜色插槽、400 个实际 symbol、任意前缀、资源异步加载、改名/移除及多个消费者的监听释放。解析器、共享 hook、展示组件及选择弹窗的定向严格类型检查和两个变更 Vue 文件的样式门禁通过；工作区无独立 lint 脚本，未执行全量类型检查。在 `ui/` 执行 `pnpm --filter saas-manager-ui build` 通过，保留既有 `input` 输出选项、CSS 注释、混合导入及分块体积告警。

已登录的 `/operation/base/Service` 页面刷新后，“视频中心”当前配置的 `#icon-gongzuotai` 正常显示，不再回退为 `IC`；“基础服务”的 `StepForwardOutlined` 保持正常。此次浏览器复验只读取展示，保存接口沿用业务模块既有验证边界。
