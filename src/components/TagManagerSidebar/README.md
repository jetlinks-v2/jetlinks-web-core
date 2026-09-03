# TagManagerSidebar 使用说明

标签分类管理侧栏，支持选择、增删改、拖拽排序和权限控制。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `selectedTagIds` | 已选标签 ID | `string[]` | [] |
| `permission` | 权限前缀 | `string` | - |
| `client` | 标签管理客户端 | `TagManagerSidebarClient` | 必填 |
| `texts` | 文案覆盖 | `Partial<TagManagerSidebarTexts>` | {} |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `update:selectedTagIds` | 选择变化 | `(ids: string[])` |
| `change` | 标签或分类变化 | `(payload)` |
| `refresh` | 请求刷新 | `()` |

#### 用法

~~~vue
<TagManagerSidebar
  v-model:selected-tag-ids="selectedTagIds"
  permission="tag"
  :client="tagClient"
/>
~~~

#### Rules

- client 负责分类/标签的查询、保存、删除和排序请求。
- permission 会拼接 :update/:delete 动作权限；texts 只覆盖用户可见文案。
