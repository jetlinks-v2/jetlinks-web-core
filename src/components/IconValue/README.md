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
