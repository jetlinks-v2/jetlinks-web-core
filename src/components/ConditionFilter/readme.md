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

```vue
<ConditionFilter v-model="terms" :fields="fields">
  <template #value-editor="{ field, value, setValue }">
    <MyFilterValueEditor
      :field="field"
      :value="value"
      @update:value="setValue"
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

- `string`：`包含`、`不包含`、`为`、`不为`、`为空`、`不为空`
- `number`：`为`、`不为`、`大于`、`大于等于`、`小于`、`小于等于`、`为空`、`不为空`
- `select/tree/treeSelect`：`属于`、`不属于`、`为`、`不为`、`为空`、`不为空`
- `date/time`：`处于范围`、`大于等于`、`小于等于`、`为`、`为空`、`不为空`

操作符下拉会显示一行用途说明，选中后的操作符 Token 支持悬浮查看完整解释。

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
