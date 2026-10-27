# Upload 使用说明

文件与图片上传组件族：FileUpload、ProUpload、ImageUpload、UploadCropper。

`FileUpload` 从 `@jetlinks-web-core/components` 根入口具名导入，实际实现为 `Upload/File/index.vue`，不全局注册；`ProUpload` 与 `ImageUpload` 沿用原全局注册，属于图片上传能力。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `modelValue` | 图片地址，供图片组件使用 | `string` | - |
| `value` | 文件 ID 或 Ant Design UploadFile 列表，供 FileUpload 使用 | `string \| UploadFile[]` | - |
| `accept` | 文件选择器接受的后缀或 MIME 类型 | `string` | - |
| `types` | 允许的 MIME 类型数组 | `string[]` | 图片默认 jpeg/png |
| `size` | 单文件大小上限 MB | `number` | 2 |
| `maxCount` | 最大文件数 | `number` | 1 |
| `disabled` | 禁用 | `boolean` | false |
| `publicAccess` | 是否公开访问 | `boolean` | false |
| `isUpload` | 是否真正上传 | `boolean` | true |
| `drag` | FileUpload 开启拖拽区，保留点击选择 | `boolean` | false |
| `multiple` | FileUpload 文件选择器允许多选 | `boolean` | true |
| `btnText` | FileUpload 按钮或拖拽区标题 | `string` | 拖拽模式使用公共提示 |
| `beforeUpload` | FileUpload 通用校验通过后的业务校验，返回值沿用 Ant Design Upload | `UploadProps['beforeUpload']` | - |
| `customRequest` | FileUpload 自定义请求；未传时沿用 core 文件上传工具 | `UploadProps['customRequest']` | - |
| `listType` | 列表样式 | `text \| picture \| picture-card` | text |
| `bgImage` | 背景图 | `string` | - |
| `borderStyle` | 边框样式 | `CSSProperties` | - |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `update:modelValue/update:value` | 上传结果变化 | `(url \| fileList)` |
| `change` | 上传状态变化 | `(value)` |
| `remove` | 移除文件 | `(file)` |
| `uploadChange` | FileUpload 全过程状态，用于上传中禁用提交、失败后恢复等 | `(UploadChangeParam)` |
| `cropVisibleChange` | 裁剪弹窗变化（ImageUpload） | `(visible)` |

#### 用法

~~~vue
<script setup lang="ts">
import { ref } from 'vue'
import { FileUpload } from '@jetlinks-web-core/components'

const fileId = ref('')
const imageUrl = ref('')
</script>

<template>
  <FileUpload v-model:value="fileId" accept=".jar,.zip" drag :multiple="false" />
  <ImageUpload v-model="imageUrl" :size="5" />
</template>
~~~

#### Rules

- 上传请求、请求头和文件地址转换沿用 core 的统一上传工具。
- ImageUpload 默认支持图片裁剪；File 上传使用 value 事件，ImageUpload 使用 modelValue。
- 大小限制按 MB 校验，types 优先于 accept 的默认限制。
- FileUpload 的默认插槽可替换按钮或拖拽区内容。`value` 接收列表时保留调用方提供的文件名、地址与状态；上传成功的 `update:value` 仍返回文件 ID，移除时返回 `undefined`。`change` 保留上传完成时通知的契约；`isUpload=false` 时继续通过 `change` 返回原始文件。
- `accept` 用于选择器及拖放过滤；业务需要显式校验时提供 `beforeUpload`，可返回 `Upload.LIST_IGNORE` 拒绝文件并保留原列表。默认仍限制 2 MB，确实无前端大小上限的业务可传 `size=Infinity`。

#### 运行时协议包接入

运行时 `modules/device-manager-ui/views/link/Protocol/Save/index.vue` 通过同目录 `FileUpload.vue` 复用公共组件，`useProtocolFileUpload.ts` 适配协议文件规则：单个 `.jar/.zip` 文件、后缀不区分大小写、无额外前端大小上限，沿用原 `/file/upload` 请求，将文件 ID 与访问凭证组合为服务器可访问的地址后写入 `configuration.location`。编辑态回显现有文件，上传中禁用确认，移除后清空地址并校验必填；使用 FormItemRest 隔离过程中的文件列表变化，只在地址改变后校验。

公共组件未写入协议专属规则；运营端 `ui/`、后端接口、协议类型、能力市场安装、权限和保存数据结构不变。

验证：组件脚本、模板及四份中英文 JSON 检查通过；在 `jetlinks-web-core/` 执行 `node --max-old-space-size=8192 --max-semi-space-size=64 ../node_modules/vite/bin/vite.js build --outDir /tmp/protocol-upload-build -- --module-name device-manager-ui`，定向生产构建通过（11,043 个模块），保留既有资源路径、CSS 注释与包体积告警。公共文件上传、协议适配组件和 hook 使用真实 Vue/Ant Design 类型完成隔离严格类型检查，外部 store、工具和 API 采用类型替身；不代表整个工作区类型检查通过。

交互验证使用实际公共组件、协议适配组件和模拟上传接口，覆盖点击选择 JAR、合成拖放 JAR/ZIP、后缀大小写、3 MB 协议包、单文件限制、访问地址回填、失败后重试、异常响应不覆盖地址、编辑回显、移除必填及成功后清除提示；同时验证默认模式保留文件 ID 回填、完成事件、多选和 2 MB 限制。本地 `http://localhost:9200/#/infrastructure/access/protocols` 的真实新增弹窗已核对拖拽区、格式提示和底部按钮布局，未提交业务数据。

模块完整类型检查仍被既有 `views/device/Product/ResourcePackage/index.vue:187` 与 `views/link/Certificate/type.d.ts:2` 的 TS1005 语法错误阻断，修改前后输出一致；修复后需在 `runtime-ui/` 重新执行 `node node_modules/vue-tsc/bin/vue-tsc.js --noEmit --pretty false -p modules/device-manager-ui/tsconfig.json`。工作区与目标模块未配置独立 lint 脚本。真实后端文件上传与协议保存尚未联调。
