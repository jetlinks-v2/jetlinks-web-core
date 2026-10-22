# ConditionFilter

输入框式通用筛选条件组件，适合构建类似 GitHub / YouTrack 的交互式条件筛选。

从当前版本开始，推荐使用独立的 `fields` schema；`columns` 仍保留为兼容旧 `SearchItem` 的接法。

## 功能

- 单输入框内展示多个条件 Token
- 点击后先选字段，再根据字段类型选择操作符和值
- 条件类型由调用方通过字段 `search.termOptions` / `search.termTypeOptions` 指定
- 未显式指定 `termTypeOptions` 时，组件会按字段类型自动补齐常用条件（如字符串的包含/等于/为空）
- 值输入支持调用方通过 `value-editor` 插槽完全接管
- 输出 `QueryParamEntity` 可直接使用的 `terms` 结构
- 同时输出线性 `where` 表达式
- 支持通过 `v-model` 的 `terms` 或 `where` 反显
- 支持 `terms` 分组 AST，并在路由中自动兼容 `v1` / `v2` 编码
- 选项面板的 `label/name/description/icon` 支持字段名或函数回调

## 树形选项回显

树形选项按原始值递归查找 `children`，Token 与 Tooltip 显示从根节点到匹配节点的完整层级，例如 `一级组织/二级组织/三级组织`；多选显示各节点的完整路径。产品列表“所属组织”的二级、三级节点也使用此规则，避免回显原始查询 JSON。Owning module 为运行时前端 `jetlinks-web-core`，实现入口为 `src/components/ConditionFilter/option-display.ts#findOptionPathByValue` 与 `ConditionFilter.vue#getOptionLabel`、`hasResolvedOptionValues`。

递归查找保留祖先路径，回显按 `/` 拼接；标签回显与已解析选中值判断使用同一查找结果。保留节点值、树数据、查询转换与组件 API；未匹配值保持原有回退显示。改动仅在 `runtime-ui/jetlinks-web-core`，产品业务页面和运营端 `ui/` 未修改。

验证：`node --test tests/conditionFilterScheduling.test.mjs` 的 11 项回归全部通过，原实现已复现二级节点回显 JSON；回归覆盖一级至三级路径与 Tooltip、多选、静态和异步选项、已加载子节点识别、`0` / `false`、未匹配值回退及查询输出值保持一致。本地 `http://192.168.35.97:9201/#/resources/devices/products` 实际选择三级组织回显 `一级组织/二级组织/三级组织`。

`pnpm --dir runtime-ui --filter jetlinks-web-core build -- --module-name device-manager-ui` 生产构建通过（11,074 个模块，仍有既有资源路径、CSS 注释和大包告警），`git diff --check` 通过。修改前后执行 `pnpm exec vue-tsc -p tsconfig.json --noEmit` 均为相同的 556 个既有诊断（忽略行号位移），未新增错误；完整类型检查仍受这些错误阻断，修复后需在 `runtime-ui/jetlinks-web-core` 重跑同一命令。工作区未提供 lint 脚本；完整工作区生产打包未执行，发布前可在同目录执行 `pnpm build`。

## 快速输入候选

文本关键词从一个非空字符开始生成快捷筛选候选，单字符数字、中文和英文均可使用。匹配文本字段名称时仍优先选择字段；空白输入仅显示字段列表，不生成带值条件。条件操作符及提交结构保持原有语义。

实现入口为 `runtime-ui/jetlinks-web-core/src/components/ConditionFilter/ConditionFilter.vue#getFieldQuickSuggestion`，Owning module 为运行时前端 `jetlinks-web-core`；关系配置页使用该公共能力，其他运行时页面的文本快捷候选同步支持单字符。运营端 `ui/` 不在本次修改范围。

验证：关系配置页输入 `1`、`测`、`x` 和 `12` 均显示文本候选，输入 `正` 保留字段名称匹配，空白输入不生成带值候选；选中“正向关系名称包含 1”正常生成条件，选中“包含 4”返回暂无数据，清空后恢复原记录。`node --test tests/conditionFilterScheduling.test.mjs` 的 9 项回归全部通过；组件脚本、模板、样式编译及 `git diff --check` 通过。修改前后执行 `pnpm exec vue-tsc -p tsconfig.json --noEmit` 均有相同的 556 个既有诊断（忽略行号位移），未新增错误。工作区无 lint 脚本；完整生产构建未执行，发布前需在 `runtime-ui/jetlinks-web-core` 执行 `pnpm build` 验证。

## 基础示例

```vue
<template>
  <ConditionFilter
    v-model="terms"
    v-model:where="where"
    :fields="fields"
    @change="onFilterChange"
  />
</template>

<script setup lang="ts">
import ConditionFilter from '@jetlinks-web-core/components/ConditionFilter'

const terms = ref([])
const where = ref('')

const fields = [
  {
    title: '名称',
    dataIndex: 'name',
    search: {
      type: 'string',
      termTypeOptions: ['like', 'eq', 'not'],
    },
  },
  {
    title: '状态',
    dataIndex: 'state',
    search: {
      type: 'select',
      options: [
        { label: '在线', value: 'online' },
        { label: '离线', value: 'offline' },
      ],
    },
  },
  {
    title: '创建时间',
    dataIndex: 'createTime',
    search: {
      type: 'date',
    },
  },
]

const onFilterChange = ({ filter, where }) => {
  console.log(filter.terms, where)
}
</script>
```

## 自定义值输入

值编辑弹层关闭后销毁编辑器，重新打开时根据当前条件重建；自定义编辑器应从传入值恢复选择，在卸载时丢弃未完成的异步回填。

字段使用 `search.type: 'component'` 时，自定义组件通过 `update:value` 更新值；如有自己的确认按钮，在更新值后发出无参数的 `submit` 事件。筛选器以最新值立即确认、合并待执行的自动搜索并关闭弹层。只更新值、不发出 `submit` 时，仍沿用原有输入更新策略；插槽编辑器继续使用下述 `submit` 回调。

```vue
<ConditionFilter v-model="terms" :fields="fields">
  <template #value-editor="{ field, value, setValue, submit }">
    <MyFilterValueEditor
      :field="field"
      :value="value"
      @update:value="setValue"
      @submit="submit()"
    />
  </template>
</ConditionFilter>
```

## 自定义反显文本

```vue
<ConditionFilter v-model="terms" :fields="fields">
  <template #value-preview="{ field, term, text }">
    {{ field?.title }}: {{ text || term.value }}
  </template>
</ConditionFilter>
```

## 默认条件策略

- `string`：`包含`、`不包含`、`为`、`不为`、`为空`、`不为空`；`包含`和`不包含`会在输出查询参数时自动补齐值两端的 `%`
- `number`：`为`、`不为`、`大于`、`大于等于`、`小于`、`小于等于`、`为空`、`不为空`
- `select/tree/treeSelect`：`属于`、`不属于`、`为`、`不为`、`为空`、`不为空`
- `date/time`：`处于范围`、`大于等于`、`小于等于`、`为`、`为空`、`不为空`

操作符下拉会显示一行用途说明，选中后的操作符 Token 支持悬浮查看完整解释。

### Search 字段处理兼容

以旧 `Search` 的 `columns[].search` 配置作为 `ConditionFilter` 的 `columns` 时，查询输出按以下顺序处理：`rename`、`handleValue(value, term)`、`like` / `nlike` 的 `\\` 与 `%` 转义及通配符补齐、`handleTerms(term)`。`handleParamsItem` 仍是 `ConditionFilter` 的终端自定义转换入口，配置后优先执行。

同时兼容 `format`、`options`、`first`、`sortIndex`、`defaultTermType`、`defaultValue`、`defaultOnceValue`、`termOptions`（对象或字符串数组）、`termFilter`、`componentProps`、`components` 与 `isBtw`。其中 `format` 会适配到日期组件的 `componentProps.format`；`defaultOnceValue` 仅首次初始化，`clear()` 后不会恢复；`defaultValue` 会在初始化与 `clear()` 后恢复；`span` 仅保留类型兼容，不参与新组件布局。

## 分组 AST

```ts
import type { ConditionFilterExpression } from '@jetlinks-web-core/components/ConditionFilter'

const terms: ConditionFilterExpression = [
  {
    column: 'status',
    termType: 'in',
    value: ['idle'],
  },
  {
    type: 'and',
    terms: [
      {
        column: 'name',
        termType: 'like',
        value: '123',
      },
      {
        column: 'creatorId',
        termType: 'eq',
        value: '1199596756811550720',
        type: 'or',
      },
    ],
  },
]
```

- 当前默认使用更紧凑的 `v3`
- `decodeConditionFilterQuery` 同时兼容 `v1` / `v2` / `v3`
- 可通过 `resolveConditionFilterRouteVersion(terms, fields)` 判断当前会落哪一版编码

### 路由别名

可通过 `search.routeAlias` 为字段指定更短的路由别名，以进一步压缩 `q` 参数：

```ts
{
  title: '名称',
  dataIndex: 'name',
  search: {
    type: 'string',
    routeAlias: 'n',
  },
}
```

## 选项展示回调

```ts
const fields = [
  {
    title: '创建人',
    dataIndex: 'creatorId',
    search: {
      type: 'select',
      optionPanel: {
        optionFields: {
          label: item => item.name || item.username || item.id,
          description: item => item.username,
          icon: () => 'UserOutlined',
        },
      },
    },
  },
]
```

## Props

| 名称 | 类型 | 说明 |
| --- | --- | --- |
| `fields` | `ConditionFieldSchema[]` | 推荐使用的独立字段 schema |
| `columns` | `SearchItem[]` | 兼容旧搜索体系的字段配置，内部会自动适配到 `fields` |
| `modelValue` | `TermsItem[]` | `QueryParamEntity.terms` 结构 |
| `where` | `string` | 线性 `where` 表达式，非空时优先用于反显 |
| `placeholder` | `string` | 空状态提示 |
| `disabled` | `boolean` | 禁用状态 |

## 事件

- `update:modelValue`：输出 `terms`
- `update:where`：输出 `where`
- `change`：输出 `{ terms, filter, where }`
- `search`：兼容旧 `Search` 回调，输出 `{ terms: [{ terms }] }`；用于只替换组件标签并保留既有 `@search` 处理函数

### 自动搜索与编辑态

自动搜索仅在有效查询条件变化时触发。新增或调整未填值条件、取消空条件只更新编辑态；填入有效值、修改或清空已生效条件，以及选择 `isnull` / `notnull` 等无值条件仍会触发搜索。手动搜索按钮仍可重复执行查询。

实现入口为 `ConditionFilter.vue` 的自动搜索监听：比较 `payload.terms` 的前后值，沿用现有查询转换与防抖机制。验证：组件脚本、模板编译与 20 项交互事件检查通过，覆盖文本、选项、范围、`0` / `false`、无值条件、删除、清空及防抖；本地设备列表选择设备名称后保持编辑框，提交“测试”后从 4 条筛选为 1 条，清空后恢复 4 条；`git diff --check` 通过。工作区无 lint 脚本；在 `jetlinks-web-core` 执行 `pnpm exec vue-tsc -p tsconfig.json --noEmit` 仍有 557 个既有错误，与修改前基线诊断完全一致（忽略行号位移），未新增错误。生产构建 `pnpm build` 在转换 23,956 个模块后触及配置的 8 GB Node 堆内存上限，以 `JavaScript heap out of memory` 退出（134）；完整生产打包尚未验证，需在资源充足的环境重跑该命令。

调用方兼容限制：`runtime-ui/modules/device-manager-ui/views/device/list/components/IotDeviceAssetSearchBar.vue` 的 `skipNextSearch` 会无条件跳过切换字段后的下一次查询；空条件不再搜索后，该标记可能误吞随后填值的首次有效搜索。页面已复现此情况，后续需改为只跳过对应的查询内容。本次范围仅为通用组件，不调整设备列表封装、后端接口、条件结构、路由编码或运营端。

#### 查询触发策略

快捷添加、日期/枚举选择、删除和外部条件同步立即查询；连续输入等待 260ms。确认动作取消待执行的输入任务并提交最新完整条件，同一轮更新合并为一次查询，相同有效条件不重复自动请求；手动搜索允许刷新。默认编辑模型在初始化时回传，供调用方追加条件时保留默认时间范围。

内部 `ConditionFilterSubmitOptions.source` 区分 `input` / `commit`，不进入查询参数；公共 `change/search` 参数保持原结构。行内文本在 Enter/失焦时确认，中文输入法 Enter 不提交中间草稿；数值面板连续修改防抖，Enter/关闭面板立即确认。远程选项关键词保持独立防抖。实现入口为 `ConditionFilter.vue` 和 `ConditionEditorPanel.vue`，回归入口为 `tests/conditionFilterScheduling.test.mjs`。

### 字段切换的选项值

实现与范围：仅在通用组件 `ConditionFilter.vue#canReuseFieldValueOnSwitch` 补齐选择型字段的值域检查，复用 `hasResolvedOptionValues` 判断旧值是否存在于目标字段的已解析选项中。不同字段的编辑器类型相同不代表选项值兼容；无法确认旧值有效时清空并打开目标字段的选项面板，多选值必须全部有效才保留。同一字段重选以及文本、数值、日期的兼容值复用保持现有行为，不改业务页面、查询结构或选项接口。

验证：组件脚本、模板编译和 13 项字段切换回归检查通过，覆盖静态与未加载的远程选项、兼容选项、部分无效的多选、单选、自定义选项值字段、`0` / `false`、同字段重选、文本/数值/日期复用以及未填值不搜索。产品列表已复现修复前的 `device` 原始值显示；修复后“设备类型 = 直连设备”切换为“网关类型”会显示“输入筛选值”并打开网关选项，重选“MQTT直连接入”后显示正确标签。`git diff --check` 通过；重新执行 `pnpm exec vue-tsc -p tsconfig.json --noEmit` 仍为与基线一致的 557 个既有错误，未新增诊断。工作区无 lint 脚本；本轮未重复全量构建，前次 8 GB 堆内存不足的限制仍适用，完整生产打包需在资源充足环境执行 `pnpm build` 验证。

## 插槽

- `value-editor`：接管值输入，组件只负责字段/操作符/提交流程
- `value-preview`：自定义 Token 中的值反显

## Expose

- `getTerms()`
- `getFilter()`
- `getWhere()`
- `setTerms(terms)`
- `setFilter({ terms })`
- `setWhere(where)`
- `clear()`
