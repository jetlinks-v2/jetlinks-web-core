# QuickFilterSidebar 使用说明

带分组快捷项和 ConditionFilter 条件编辑的侧栏筛选器。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `title` | 侧栏标题 | `string` | - |
| `variant` | 侧栏变体 | `QuickFilterSidebarVariant` | list |
| `allowDeselect` | 允许取消选中 | `boolean` | false |
| `sections` | 快捷筛选分组 | `QuickFilterSidebarSection[]` | [] |
| `fields` | 条件字段 | `ConditionFilterField[]` | [] |
| `modelValue` | 条件值 | `ConditionFilterTerm[]` | [] |
| `openKeys` | 受控展开分组 | `string[]` | - |
| `defaultOpenKeys` | 默认展开分组 | `string[]` | [] |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `select` | 选择快捷项 | `(sectionKey, item)` |
| `update:modelValue` | 条件变化 | `(terms)` |
| `change` | 筛选变化 | `(payload)` |
| `update:openKeys` | 展开分组变化 | `(keys)` |
| `toggleSection` | 展开状态变化 | `(key, opened)` |
| `headerAction` | 点击分组动作 | `(sectionKey, actionKey)` |
| `itemAction` | 点击项动作 | `(sectionKey, actionKey, item)` |

#### 用法

~~~vue
<QuickFilterSidebar
  v-model="terms"
  :sections="sections"
  :fields="fields"
  v-model:open-keys="openKeys"
/>
~~~

#### Rules

- openKeys 传入数组时为受控模式；不传则由 defaultOpenKeys 初始化内部状态。
- 快捷项与通用条件最终都汇总为 ConditionFilterTerm[]。
