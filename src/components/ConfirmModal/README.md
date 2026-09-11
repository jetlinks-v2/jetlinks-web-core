# ConfirmModal 使用说明

基于 Modal.confirm 的轻量确认按钮，点击后打开确认提示。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `title` | 确认标题 | `string` | - |
| `onConfirm` | 确认回调 | `Function \| object` | - |
| `show` | 是否显示触发器 | `boolean` | true |
| `disabled` | 禁用触发 | `boolean` | false |
| `className` | 触发器 class | `string` | - |
| `toolTip` | 提示配置 | `object` | - |

#### 事件

- 无自定义事件。

#### 用法

~~~vue
<ConfirmModal title="删除设备？" :on-confirm="removeDevice">
  <a-button danger>删除</a-button>
</ConfirmModal>
~~~

#### Rules

- 确认回调返回 Promise 时，Modal 会等待其完成。
- 触发器内容通过默认插槽传入，调用方负责提供最终用户可见文案。
