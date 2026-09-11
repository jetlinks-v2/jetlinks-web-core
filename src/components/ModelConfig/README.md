# ModelConfig 使用说明

模型文件与格式配置工作区，管理目录树、模型定义、manifest、批量上传和扩展配置页签。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `model` | 模型上下文 | `ModelConfigModel` | - |
| `files` | 文件列表 | `ModelFile[]` | [] |
| `filesLoading` | 文件加载态 | `boolean` | false |
| `availableFormats` | 可用格式 | `FormatDetail[]` | [] |
| `showAddFile` | 显示新增文件 | `boolean` | true |
| `showManifest` | 显示 manifest | `boolean` | true |
| `extraConfigTabs` | 扩展配置页签 | `array` | [] |
| `batchUploadOwners` | 批量上传归属 | `array` | [] |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `load-files` | 请求加载文件 | `(payload)` |
| `save-config` | 保存模型配置 | `(payload)` |
| `add-file` | 新增文件 | `(payload)` |
| `batch-add-file` | 批量新增文件 | `(payload)` |
| `add-file-close` | 关闭新增文件面板 | `()` |
| `save-file` | 保存文件 | `(payload)` |
| `replace-file` | 替换文件 | `(payload)` |
| `preview-file` | 预览文件 | `(payload)` |
| `delete-file` | 删除文件 | `(file)` |

#### 用法

~~~vue
<ModelConfig
  :model="model"
  :files="files"
  :available-formats="formats"
  @save-config="saveModel"
/>
~~~

#### Rules

- 文件内容、格式和 manifest 的类型以组件内导出类型为准。
- 批量上传与新增文件请求通过 props 回调接入，组件不固定业务 API。
