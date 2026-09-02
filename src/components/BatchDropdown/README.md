# BatchDropdown 使用说明

批量操作下拉菜单，按权限过滤操作，并在选中需要二次处理的动作后打开批量内容区。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `actions` | 批量动作定义 | `BatchActionsType[]` | [] |
| `isCheck` | 是否处于批量内容状态 | `boolean` | false |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `update:isCheck` | 批量状态变化 | `(value: boolean)` |
| `change` | 批量状态变化 | `(value: boolean)` |

#### 用法

~~~vue
<BatchDropdown
  v-model:isCheck="isBatch"
  :actions="batchActions"
/>
~~~

#### Rules

- 动作项可配置 permission、onClick 或 popConfirm；没有处理函数的动作会进入批量内容状态。
- 可通过 ref 调用 reload() 清理当前动作并退出批量状态。
