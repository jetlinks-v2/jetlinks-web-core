# AssetOwnershipCondition

受控归属条件编辑器。只负责选择、构造与回显标准条件；列表请求、默认条件及路由由使用方决定。使用同一面板选择范围、匹配方式和多个目标，确认后提交，回显如“属于组织：研发部、运维部”“未绑定任何租户”。范围选项采用图标、名称与浅色说明；除“全部可访问”置首、“无归属”置尾外，保持 Context 按策略优先级提供的顺序。展示调整不改变查询条件或权限优先级。

## 使用

```ts
import { createAssetOwnershipField, toAssetOwnershipFilterTerm } from '@jetlinks-web-core/components'

const options = { assetType: 'application', column: 'id', userId: currentUser.id }
const fields = [createAssetOwnershipField(options)]
const terms = ref([]) // ConditionFilter v-model；不设置默认条件
// 已有标准条件可通过 toAssetOwnershipFilterTerm(term) 装入该字段。
```

独立使用：`<AssetOwnershipCondition v-model:value="term" :options="options" />`。`value` 是标准 `ConditionClause`，`update:value` / `change` 返回标准条件；全部可访问返回 `undefined`。字段适配禁用该清空选项，通过删除 ConditionFilter Token 清除限制。

ConditionFilter 按需挂载的弹层使用 `resumeOnMount` 恢复既有范围、操作符和已选目标，按权限回查名称；直接挂载组件默认不请求。重复点击当前范围保留已选目标，不重置为自己。查询条件与路由仍仅保存 ID，已选用户的姓名、用户名格式由目录适配负责，core 仅消费 label。

`options` 必填 `assetType`、资产 ID 或关联资产列 `column`；可选 `userId`、`createCreatorSelector`、已加载的 `context`、`loadContext()`。多个字段使用不同 `dataIndex`，组织与租户条件通过 ConditionFilter 的 AND/OR 组合。使用方切换请求身份或 Scope 时应重建字段、更新 Context 或组件 key，避免复用旧请求上下文。

## 创建人

主动添加“创建人”时默认选中 `userId`。仅当 Context 中该范围的 `canSelectTargets === true` 且使用方提供 `createCreatorSelector` 时开放用户搜索、多选及名称回查，否则直接提交自己；既无当前用户也无法选择目标时禁用添加。工厂复用下述 `AssetDimensionSelector` 协议，core 不依赖用户 API。目录适配由使用方提供，不根据前端菜单推断权限。

```ts
const options = {
  assetType: 'application', column: 'id', userId: currentUser.id,
  createCreatorSelector: () => ({
    optionPanel: {
      loadOptions: (keyword, page) => userDirectory.search(keyword, page),
      loadSelectedOptions: ids => userDirectory.findByIds(ids),
    },
  }),
}
```

创建人条件使用 `{assetType}-creator`，单个 ID 为字符串，多个 ID 为数组。目录能力不能扩大资产权限或 Scope。已有其他用户及失效用户 ID 保留，冷回显自己为“我”，其他使用缓存名称或原 ID；只有打开目标选择后才查询目录。撤回能力或选择器时关闭面板并丢弃在途名称，不改写已提交条件。

## 维度扩展

模块在现有注册资源中声明 `assetDimensionFilters`，以 `dimensionType` 为键。core 不依赖租户、组织或自定义业务模块。

```ts
import i18n from '@jetlinks-web-core/locales'

const resources = {
  assetDimensionFilters: {
    campus: {
      icon: 'EnvironmentOutlined',
      getDescription: () => i18n.global.t('campus.ownershipDescription'),
      getOperators: (assetType: string) => ['targets', 'notTargets', 'bound', 'unbound'] as const,
      createSelector: () => ({
        optionPanel: {
          loadOptions: (keyword, page) => campusApi.search(keyword, page),
          loadSelectedOptions: ids => campusApi.findByIds(ids),
        },
      }),
    },
  },
}
// 将 resources 放入模块既有注册入口。
```

目标统一为 `{ value: string, label: string, children?, disabled? }`，候选与按 ID 回查均返回该格式。也可提供静态 `options`。`getOperators` 按资产类型声明能力；只支持绑定存在性时可省略 `createSelector`。维度可选注册 `icon` 和 `getDescription(assetType)`，省略时使用通用图标与说明；说明随当前语言同步求值，不请求目录。

自定义选择器由 `createSelector` 返回 `component` / `componentProps`，接收 `value: string[]`，通过 `update:value` 更新草稿、`submit` 确认；可通过 `options-change` 回传上述选项用于名称回显。选择器只在用户明确选择维度或打开目标时挂载。

## 请求与条件边界

- 页面初始化、字段定义创建、独立组件默认挂载、外部赋值与冷回显均不请求。点击范围入口或重新打开已有条件编辑后才调用 `/assets/access-context/{assetType}`；已有目标条件直接恢复选择面板并按 ID 回查名称，存在性条件和禁止选择目标的范围不加载目录。失败可显式重试；关闭弹层即卸载编辑器。
- 可选范围取 Context 与已注册维度能力的交集。`targets` / `notTargets` 同时要求范围 `canSelectTargets === true` 和已注册选择器；`bound` / `unbound` 不依赖目录权限。重复注册同一维度、扩展缺失或卸载时禁用编辑，保留原条件。
- 创建人构造 `{assetType}-creator`；维度目标使用 `dim-assets / targets`；已绑定和未绑定使用 `targetType / not`。不增加权限，也不改写 Scope。
- Context 提供 `unbound` 时显示“无归属”，生成 `{ column, termType: 'assets-unbound', value: assetType }`。选择即提交，不创建维度选择器或加载目录；含义为所有维度均无绑定，不要求创建人为空。按某个维度“未绑定”仍使用原有条件。
- 未绑定只表示该维度没有绑定，不能据此推断为平台数据。复杂闭包、混合维度或关系条件保留原值，不静默重建。
- 冷回显优先已有名称，缺少目录时显示维度和目标 ID；不为显示 Token 自动查接口。交互加载后更新名称。

## 后端契约

归属 Context 和绑定存在性查询依赖 [组件 PR #1655](https://github.com/jetlinks-v2/jetlinks-components/pull/1655) 与 [租户 PR #48](https://github.com/jetlinks-v2/jetlinks-tenant/pull/48)；全局无归属还需执行节点安装 `assets-unbound`，缺少该能力时 Context 不提供对应范围。指定租户、组织等目标的选择器由对应业务模块接入有权限的目录接口。
