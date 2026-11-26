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
- 颜色使用 `color:<颜色>[:标签]`，图片使用 URL 或 `img:<URL>`；普通文本及未知图标名继续显示缩写。
- 在 `jetlinks-web-core/` 下执行 `node --test tests/iconValue.test.mjs`：6 项回归通过，覆盖格式分类、真实图标 SVG 渲染、编辑器裸图标回显与选择后输出 `font:` 值、默认颜色和标签回显以及自定义颜色插槽。
- `iconValue.ts` 定向严格类型检查通过：`pnpm exec tsc --target ES2022 --module ESNext --moduleResolution Bundler --lib ES2022,DOM --strict --skipLibCheck --noEmit --types node src/components/IconValue/iconValue.ts`。显式限定 Node 类型，避免工作区隐式加载缺失的 `uts` 类型。

#### 对象类型图标

`ObjectTypeIcon` 和 `getObjectTypeIcon(typeId)` 以权威类型 ID 解析统一的 Ant Outlined 图标，未知类型使用中性对象图标。设备、产品、设备分组、空间、地区、用户、组织、岗位、角色、告警发生和通知尝试使用同一份 `objectTypeIcons.ts`；不按展示名称或业务状态猜类型。

~~~vue
<script setup lang="ts">
import ObjectTypeIcon from '@jetlinks-web-core/components/IconValue/ObjectTypeIcon.vue'
import { getObjectTypeIcon } from '@jetlinks-web-core/components/IconValue/objectTypeIcons'
</script>
<template>
  <ObjectTypeIcon type-id="device" :size="24" />
  <AIcon :type="getObjectTypeIcon('org')" />
</template>
~~~

以上为公开的按需入口，避免仅展示类型时引入图标编辑器和上传依赖；根 components 亦具名导出。`size` 默认继承上下文字号，颜色继承正文/选中态。调用方提供类型名称或可访问标签，状态徽标、实例图片、设备子分类与视图呈现独立，不覆盖全平台的类型默认图标。已有 IconValue 字符串继续通过 `formatIconValueFont` 适配，不增加存储协议。
