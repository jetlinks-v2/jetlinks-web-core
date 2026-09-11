# FormItem 使用说明

组织、职位和角色选择表单项集合：OrgList、Position、RoleList。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `value` | 选中值 | `string \| string[]` | - |
| `extraProps` | 透传查询组件配置 | `object` | {} |
| `extraData` | 补充展示数据 | `array` | [] |
| `disabledData` | 禁用或无权限数据 | `array` | [] |
| `showAdd` | 显示新增入口 | `boolean` | true |
| `disabled` | 禁用 | `boolean` | false |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `update:value` | 值变化 | `(value)` |
| `change` | 值变化 | `(value)` |

#### 用法

~~~vue
<OrgList v-model:value="orgId" :extra-data="legacyOrgs" />
<Position v-model:value="positionId" :extra-props="{ multiple: true }" />
<RoleList v-model:value="roleIds" :extra-props="{ multiple: true }" />
~~~

#### Rules

- OrgList/Position/RoleList 都通过 value 双向绑定；多选通过 extraProps.multiple 传给底层 TreeSelect。
- extraData 用于编辑时保留无权限但已选中的展示项；权限判断由组件及传入数据共同完成。
