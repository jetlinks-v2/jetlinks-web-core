# BatchImport 使用说明

CSV/XLSX 批量导入弹窗，负责模板下载、文件上传和导入结果反馈。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `beforeUpload` | 自定义上传前校验 | `Function` | 默认校验 csv/xlsx |
| `message` | 说明文案 | `string` | - |
| `downloadUrlBuilder` | 按类型生成模板内容 | `(type) => Promise<Blob>` | - |
| `templateName` | 下载文件名 | `string` | 导入模板 |
| `request` | 提交上传结果的请求函数 | `(url) => Observable` | - |
| `width` | 弹窗宽度 | `number \| string` | 600 |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `close` | 关闭弹窗 | `()` |
| `save` | 导入请求完成 | `()` |

#### 用法

~~~vue
<BatchImport
  template-name="设备导入模板"
  :download-url-builder="downloadTemplate"
  :request="importFile"
/>
~~~

#### Rules

- 默认只接受 text/csv 与 XLSX；需要扩展格式时提供 beforeUpload。
- request 返回的结果用于统计成功/失败数量，详情文件由组件提供下载入口。
