# EditDialog 使用说明

基于 schema 的通用编辑弹窗，负责表单校验、请求参数转换和保存状态。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `title` | 弹窗标题 | `string` | - |
| `layout` | 表单布局 | `string` | vertical |
| `schema` | 表单字段 schema | `Array` | [] |
| `data` | 编辑初始数据 | `object` | {} |
| `handleRequestData` | 请求前参数转换 | `Function` | - |
| `request` | 保存请求 | `Function` | - |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `close` | 关闭弹窗 | `()` |
| `save` | 保存成功 | `()` |

#### 用法

~~~vue
<EditDialog
  title="编辑设备"
  :schema="schema"
  :data="record"
  :request="saveRecord"
  @save="reload"
/>
~~~

#### Rules

- schema 与 Form.vue 的字段约定保持一致。
- request 未传入时只执行表单校验并由调用方接管保存。
