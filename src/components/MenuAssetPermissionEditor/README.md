# MenuAssetPermissionEditor 使用说明

菜单资产权限编辑器，组合菜单权限与资产权限面板并输出统一配置。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `value` | 权限配置 | `MenuAssetPermissionConfig` | - |
| `menus` | 菜单树 | `MenuPermissionItem[]` | [] |
| `assets` | 资产权限定义 | `AssetPermission[]` | [] |
| `readonly` | 只读模式 | `boolean` | false |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `update:value` | 配置变化 | `(value)` |
| `change` | 配置变化 | `(value)` |

#### 用法

~~~vue
<MenuAssetPermissionEditor
  v-model="permissionConfig"
  :menus="menuTree"
  :assets="assetDefinitions"
/>
~~~

#### Rules

- 菜单与资产数据应由权限接口提供；组件不自行请求业务数据。
- readonly=true 时隐藏编辑动作但保留当前配置展示。
