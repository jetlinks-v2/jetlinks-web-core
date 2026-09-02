# IconLibrary 使用说明

图标选择弹窗，支持图标库、类型切换和自定义 z-index。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `type` | 当前图标值 | `string` | - |
| `zIndex` | 弹窗层级 | `number` | - |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `change` | 图标变化 | `(value)` |
| `update:type` | 图标值变化 | `(value)` |
| `visibleChange` | 弹窗显示变化 | `(visible)` |

#### 用法

~~~vue
<IconLibrary v-model:type="iconName" @change="onIconChange" />
~~~

#### Rules

- 图标值应保存稳定的图标名称，不保存渲染组件实例。
- 需要在表单中嵌入时使用 update:type 绑定。
