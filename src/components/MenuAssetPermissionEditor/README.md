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

## 消息渠道与消息模板的数据范围

- 运营端与运行时复用 `src/utils/deployment.ts#isPrivateDeployment`：SaaS（含运营端 `cloud`）仅「所在租户」（采用菜单及可授权目录中的 `tenant` / `tenant_member`），私有化仅「全部数据」（现行 `ignore`，兼容候选目录实际提供的 `all`）。固定项只读并跳过范围批量操作；其他资产及模板的 `scopeStrategy` 保持原行为。
- 两个运行时叶子菜单在 `runtime-ui/modules/notify-manager-ui/baseMenu.json` 关联 `notifyConfig` 并启用数据权限：独立模板查询和业务模板正文按关联渠道鉴权。其他入口已声明的 `notifyTemplate` 也受固定规则约束；不变更通知记录、菜单按钮和后端权限逻辑。发布后应在目标环境同步通知菜单的两个叶子节点；前端更新不会迁移已有菜单或授权。
- `src/hooks/useMenuAssetPermissionEditor.ts` 使用候选菜单和当前入口的可授权数据，区分旧策略与候选。区域服务和运营端模板使用目标运行时菜单目录，运行时全局角色是例外（见下），项目模板受项目菜单及赋权人目录限制，应用角色再受上游模板策略限制。依赖候选目录的入口无固定候选时 `getGrantSnapshot()` 不生成可提交载荷；允许撤销对应菜单授权。旧值仅提示，用户明确保存时才写回合法固定值，菜单兼容字段与独立策略一致。模板接口仍以顶层独立策略为准。
- 验证：两端 core 的 `node --test tests/fixedNotificationScope.test.mjs` 各 6 项通过；认证模块对角色、模板、继承使用真实编辑器与 HTTP 夹具，两端各 3 项新增通过；运营端 `saas-manager-ui/tests/fixedNotificationGrants.test.mjs` 2 项、通知菜单契约 32 项及消防角色回归 4 项通过。运行时应用角色交集更新后，该模块相关测试 23 项通过；运营端扩展回归仍有既有模板 `space` 继承断言失败，且缺巡检测试所需子模块。定向 UI 样式检查通过，无独立 lint 脚本。
- 初次实现的两端整站生产构建通过，提交前对齐 `ignore` 后已补跑定向回归；从各自 `jetlinks-web-core` 执行 `node --max-old-space-size=16384 --max-semi-space-size=64 ../node_modules/vite/bin/vite.js build --outDir <隔离目录>` 可复验。两端 core/认证模块和运营端 SaaS 模块的 `pnpm exec vue-tsc --noEmit --pretty false -p <对应目录>/tsconfig.json` 无新增诊断，仍分别有 577/684、511/536 和 870 条既有诊断；待清理基线后重跑。
- 待联调：未同步真实菜单，未写入真实角色或授权。发布后用可授予/不可授予对应范围的账号验证「保存 → 重开」，同时确认 SaaS 不可访问其他租户渠道或模板。

### 运行时全局角色：保存时升级通知范围

`useGlobalRolePermissions.ts` 使用 `useMenuAssetPermissionEditor({ notificationScopeMode: 'deployment' })`。已选菜单及首次勾选的菜单都按部署固定范围；旧菜单缺少对应候选时，私有化提交 `ignore`、SaaS 提交 `tenant`。全局角色页只显示一个已选单选项：私有化「全部数据」、SaaS「租户」，不另列固定范围或旧值。打开不写库；点击保存才通过 `getGrantSnapshot()` 同步提交菜单和独立策略。部署模式不使用授权目录判断通知范围；其他模式仍在同一保存入口校验目录。该入口不再调用 `/menu/asset-accesses/grantable`，仍复核菜单及按钮权限，由原保存接口判定是否成功。撤销菜单、其他资产、应用角色和模板的规则不变。

通知订阅配置（`notifySubscriberProvider`）只在运行时全局角色页与通知配置共用上述规则。即使同一菜单还关联其他资产，批量选择也不改变这两个固定项；保存时菜单和独立策略同步更新，旧的组织或应用范围不会覆盖新值。应用角色、模板和个人通知订阅不变。

验证：固定范围、全局角色、角色资产兼容、应用角色及项目模板 5 组前端测试共 62 项通过，私有化生产构建通过。浏览器使用当前组件验证两种部署：历史角色、首次勾选及模拟保存后均只显示一个选中的 radio，不显示旧范围；相邻普通资产保留原有选项。两模块未提供独立 lint 脚本；`vue-tsc --noEmit` 仍报告既有类型问题（core 511 项、认证前端 536 项），本次修改的文件未报错。已用 HTTP 测试替身验证服务端拒绝不报成功，未在真实角色上写入授权。

## 验证入口

认证模块 `tests/globalRolePermissions.test.mjs` 执行真实 hook 与编辑器，仅替换 HTTP 等外部边界，覆盖单树展示、混合 owner、菜单及按钮交集、历史授权、保存复核与角色切换。应用角色及旧资产兼容回归继续验证未传分组的原有行为。
