# CrudTable 使用说明

标准管理表格组合，内置查询、分页、选择、查看/编辑/删除动作和卡片插槽。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `rowKey` | 行唯一键 | `string \| Function` | id |
| `target` | 查询目标标识 | `string` | - |
| `columns` | 表格列 | `array` | [] |
| `request` | 分页查询请求 | `Function` | - |
| `defaultParams` | 默认查询参数 | `object` | {} |
| `permission` | 权限前缀 | `string` | - |
| `mode` / `modeValue` | 展示模式配置 | `string` | modeValue: CARD |
| `actions` | 扩展操作 | `array` | [] |
| `schema` | 编辑表单 schema | `array` | [] |
| `updateRequest` / `deleteRequest` | 更新/删除请求 | `Function` | - |
| `showAdd` / `showView` / `showEdit` / `showDelete` / `showSelect` | 显示对应操作 | `boolean` | true / true / true / true / false |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `itemClick` | 点击数据项 | `(item)` |

#### 用法

~~~vue
<CrudTable
  :columns="columns"
  :request="queryPage"
  permission="device"
  show-edit
  show-delete
  @item-click="openDetail"
/>
~~~

#### Rules

- 完整属性以 CrudTable/utils.ts 的 crudTableProps 为准。
- 新页面若需要复杂动态筛选，优先用 ConditionFilter；CrudTable 保留给已有标准管理表格组合。
