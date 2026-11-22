# MenuAssetPermissionEditor 使用说明

菜单与数据权限双栏编辑器。调用方通过 `useMenuAssetPermissionEditor` 加载数据、维护草稿并取得保存快照；组件不自行请求业务接口。

## 组件接口

- `context: MenuAssetPermissionEditorContext`：必填，传入编辑器 hook 返回的上下文。
- `columns`、`ownerLabels`：可选列配置与分组名称覆盖。
- `showAssetPermissions`、`showAssetBatch`：控制资产面板与批量设置，默认开启。
- `height`、`leftWidth`、`rightWidth`：双栏尺寸。
- `readonly`：禁用编辑，保留授权状态回显。
- 插槽沿用 `menu-header-extra`、`column`、`asset-header-extra`、`asset-title-extra`、`asset-control`。

## 可选菜单分组

`reset({ menus, grantedMenus?, assetAccesses?, grantableAssets?, assetTypes?, menuGroups? })` 中的 `menuGroups` 接收 `MenuPermissionGroupDefinition[]`：

```ts
{
  key: 'template:template-id',
  label: '应用模板名称',
  menus: [{ id: 'menu-id', buttonIds: ['view', 'save'] }],
}
```

未传 `menuGroups` 时仍按 owner 分组，单组隐藏页签。显式传入时按定义顺序展示，空组隐藏，单组也显示名称；空数组表示没有可编辑菜单。菜单树和按钮候选始终由 `menus` 提供，分组不会创建菜单或授权。

同一菜单可出现于多个组，各组只投影允许的按钮并共享原始授权状态。必要祖先保留层级，但不会因展示或勾选子节点而新增祖先权限。单节点、全选及按钮批量操作均只写回当前组允许的范围；隐藏的兄弟、按钮和未分组菜单保持原值。菜单无可操作按钮时仍支持单独勾选菜单。`showMenuGroups` 是可选上下文标记，用于单组名称展示；只需单组菜单树时可在传入的展示上下文中关闭该标记。显式分组可通过 `visibleOwner` 限制投影节点的 owner，其他 owner 的祖先不展示，其符合条件的后代提升到最近的可见层级，原始草稿不变。

`getSnapshot()` 从完整原始草稿生成，不从分组视图生成。页签 key、名称和投影元数据不会进入菜单载荷；取消授权所需的完整 owner 状态树由业务调用方沿既有保存协议生成。资产策略继续使用角色/调用方传入的配置，分组不继承模板策略。

运行时角色页在业务模块负责`iot` 菜单与登录用户有效权限求交集、失败重试和保存前复核，公共编辑器不理解模板、应用实例或接口权限。运营端 core 副本及区域绑定抽屉未接入该扩展。

## 消息渠道与消息模板的数据范围（方案待确认）

- 目标：在运营端与运行时授权编辑器中，消息渠道 `notifyConfig`、消息模板 `notifyTemplate` 的范围按部署环境固定。SaaS 仅「所在租户」，私有化仅「全部数据」；不是两个可切换的选项，也不按前端目录区分环境。其他资产保持原行为。
- 入口：复用两端 `src/utils/deployment.ts` 的 `isPrivateDeployment()`，在 `src/hooks/useMenuAssetPermissionEditor.ts` 管理显示、单项、批量和保存快照。核对 `runtime-ui/modules/notify-manager-ui/baseMenu.json` 的两个叶子菜单（现为 `unsupported`）与真实授权资产映射；独立模板 CRUD 按关联渠道 `notifyConfig` 鉴权。此次仅调整前端授权配置，不更改后端鉴权、菜单按钮或直接迁移存量授权。
- 保存与兼容：固定范围须在当前可授权范围内。缺少该范围时提示并阻止保存涉及该资产的授权，不回退、不补授；批量设置不得覆盖固定值。历史范围不符时展示差异，只有用户明确保存后才写回合法固定值，尤其避免私有化静默扩大至 `all`。
- 验证：两端分别覆盖 SaaS、私有化、缺少固定范围、历史值不符及非通知资产；对照单项、批量、菜单和顶层保存快照、重新打开后的回显，并记录类型检查、构建和交互结果。

## 验证入口

认证模块 `tests/globalRolePermissions.test.mjs` 执行真实 hook 与编辑器，仅替换 HTTP 等外部边界，覆盖单树展示、混合 owner、菜单及按钮交集、历史授权、保存复核与角色切换。应用角色及旧资产兼容回归继续验证未传分组的原有行为。
