# TermsCascader 使用说明

动态查询条件构建组件，支持字段选择、操作符选择、多类型值输入。

## 单个用法

```vue
<template>
  <TermsCascader
    v-model:value="terms"
    :builtinOptions="builtinParams"
  />
</template>

<script setup>
import { transformTree } from '@jetlinks-web-core/utils'
import { useTermsParseConText } from '@jetlinks-web-core/components/TermsCascader/hooks'

const options = ref([])
const optionsMap = ref(new Map())
const terms = ref({
  column: undefined,
  termType: undefined,
  value: {
    source: 'fixed',
    value: undefined
  }
})
// 注入参数数据
useTermsParseConText({ options: options, map: optionsMap });

const onLoad = () => {
  // 解析参数数据
  const { tree, map } = transformTree(columnsData, {
    filedNames: {
      title: 'name',    // 显示字段
      key: 'id',        // 唯一键
      children: 'children'
    },
    handleNode: (node) => {
      // 自定义节点处理（可选）
      node.fullName = `${node.parentName}.${node.name}`
    }
  })

  options.value = tree
  optionsMap.value = map
}

onLoad()

</script>
```

## Props

| 参数 | 类型 | 说明 |
|------|------|------|
| value | `Object` | v-model 绑定值 |
| builtinOptions | `Array` | 内置参数选项 |
| builtinOptionsMap | `Map` | 内置参数 Map |
| showValueType | `Boolean` | 显示值类型选择 |
| fieldNames | `Object` | 字段映射配置 |

## 数据结构

### 输入数据（columnsData）

```typescript
const columnsData = [
  {
    id: 'device.id',
    name: '设备ID',
    dataType: 'string',
    termTypes: [
      { id: 'eq', name: '等于' },
      { id: 'like', name: '包含' }
    ],
    functions: [],  // 聚合函数
    others: {},     // bool/elements 配置
    children: []    // 子字段
  }
]
```

### 输出值（terms）

```typescript
{
  column: 'device.id',
  termType: 'eq',
  value: {
    source: 'fixed',  // fixed|builtin|context|time
    value: '123'
  }
}
```

## transformTree 重点

**所有树形数据必须使用 `transformTree` 处理**，它会：
- 字段映射（title/key/children）
- 生成 Map 索引（快速查找）
- 添加路径信息（__sourcePath__）
- 自定义节点处理（handleNode）

```typescript
// ✅ 正确
const { tree, map } = transformTree(data)
useTermsParseConText({ options: tree, map })

// ❌ 错误
useTermsParseConText({ options: data, map: new Map() })
```

## 值类型（source）

| 类型 | 说明 | value 格式 |
|------|------|-----------|
| fixed | 固定值 | `string/number/array` |
| builtin | 内置参数 | `string` (参数 key) |
| context | 上下文 | `string` (context.xxx) |
| time | 时间计算 | `{ type, value }` |

## 操作符类型

`TermTypeSelect.vue` 通过 Select 的 `change` 事件，仅在 `termType` 实际变化时转换参数值；重复选择同一操作符保留原值，包括区间的两个端点，且不触发参数更新和条件变更事件。不同操作符之间沿用现有转换规则。该行为由运行时共享组件维护，覆盖 `modules/data-collector-ui/views/data-collect/components/Config/AbnormalJudgment.vue` 的异常判断输入。

验证：使用实际组件与 Ant Design Select 在 Chromium 中复现原问题；修复后，区间、含零或空端点、单值、布尔及对象共 8 组输入各重复选择 3 次，原值和事件计数均保持不变，另有 3 组实际操作符切换验证通过。在 `runtime-ui/jetlinks-web-core/` 执行 `pnpm exec vite build --outDir /tmp/collector-termtype-fix-build -- --module-name data-collector-ui` 通过，保留既有导出、sourcemap 与分块等告警；在 `runtime-ui/` 执行 `pnpm exec vue-tsc --noEmit -p modules/data-collector-ui/tsconfig.json` 仍有 478 条既有诊断，修改前后输出完全一致。差异空白检查通过，工作区和采集模块未配置 lint 脚本。完整业务页面与真实后端保存尚未联调，需通过 `pnpm dev` 在点位高级配置中输入 `300`、`500` 并连续选择“在…之间”，确认数值及保存结果；修复既有类型错误后重跑上述 typecheck。

```typescript
// 数组类型（value 为数组）
['in', 'nin', 'contains_all', 'contains_any', 'not_contains']

// 区间类型（value 为 [start, end]）
['btw', 'nbtw']

// 空值类型（无需 value）
['isnull', 'notnull']

// 时间偏移
['time_gt_now', 'time_lt_now']
```

## 完整示例

```vue
<template>
  <TermsCascaderGroup
    v-model:value="terms"
    :builtinOptions="builtinParams"
    :builtinOptionsMap="builtinParamsMap"
  >
  </TermsCascaderGroup>
</template>

<script setup>
import { transformTree } from '@jetlinks-web-core/utils/comm'
import { useTermsParseConText } from '@jetlinks-web-core/components/TermsCascader/hooks'

// 准备列数据
const columns = [
  {
    id: 'id',
    name: '设备ID',
    dataType: 'string',
    termTypes: [
      { id: 'eq', name: '等于' },
      { id: 'like', name: '包含' },
      { id: 'in', name: '在...中' }
    ]
  },
  {
    id: 'state',
    name: '状态',
    dataType: 'object',
    termTypes: [{ id: 'eq', name: '等于' }],
    others: {
      elements: [
        { text: '在线', value: 'online' },
        { text: '离线', value: 'offline' }
      ]
    }
  }
]

const options = ref([])
const optionsMap = ref(new Map())
const terms = ref({
  column: undefined,
  termType: undefined,
  value: {
    source: 'fixed',
    value: undefined
  }
})

// 注入参数数据
useTermsParseConText({ options: options, map: optionsMap }); 

const onLoad = () => {
  // 解析参数数据
  const { tree, map } = transformTree(columnsData, {
    filedNames: {
      title: 'name',    // 显示字段
      key: 'id',        // 唯一键
      children: 'children'
    },
    handleNode: (node) => {
      // 自定义节点处理（可选）
      node.fullName = `${node.parentName}.${node.name}`
    }
  })

  options.value = tree
  optionsMap.value = map
}

// 内置参数
const builtinParams = [
  { label: '当前用户', value: 'userId' },
  { label: '当前时间', value: 'timestamp' }
]
const builtinParamsMap = new Map(builtinParams.map(i => [i.value, i]))

onLoad()
</script>
```

## 注意事项

1. **必须配合 `TermsCascader.Group` 使用**（提供上下文）
2. **数据源必须用 `transformTree` 处理**
3. 操作符类型决定了 value 的数据结构
4. `others.bool` 和 `others.elements` 自动转换为选项
5. `termTypes` 和 `functions` 都来自列定义
