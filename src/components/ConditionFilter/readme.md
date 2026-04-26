# ConditionFilter

输入框式通用筛选条件组件，适合构建类似 GitHub / YouTrack 的交互式条件筛选。

## 功能

- 单输入框内展示多个条件 Token
- 点击后先选字段，再根据字段类型选择操作符和值
- 条件类型由调用方通过字段 `search.termOptions` / `search.termTypeOptions` 指定
- 值输入支持调用方通过 `value-editor` 插槽完全接管
- 输出 `QueryParamEntity` 可直接使用的 `terms` 结构
- 同时输出线性 `where` 表达式
- 支持通过 `v-model` 的 `terms` 或 `where` 反显

## 基础示例

```vue
<template>
  <ConditionFilter
    v-model="terms"
    v-model:where="where"
    :columns="columns"
    @change="onFilterChange"
  />
</template>

<script setup lang="ts">
import ConditionFilter from '@jetlinks-web-core/components/ConditionFilter'

const terms = ref([])
const where = ref('')

const columns = [
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
<ConditionFilter v-model="terms" :columns="columns">
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
<ConditionFilter v-model="terms" :columns="columns">
  <template #value-preview="{ field, term, text }">
    {{ field?.title }}: {{ text || term.value }}
  </template>
</ConditionFilter>
```

## Props

| 名称 | 类型 | 说明 |
| --- | --- | --- |
| `columns` | `SearchItem[]` | 字段配置，复用现有 `search` 定义 |
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
