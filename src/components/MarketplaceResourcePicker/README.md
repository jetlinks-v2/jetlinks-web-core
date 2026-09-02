# MarketplaceResourcePicker 使用说明

市场资源选择器，提供分类侧栏、标签过滤、资源卡片和 Markdown 详情。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `typeOptions` | 资源类型 Tab | `ResourceTypeOption[]` | 必填 |
| `showTypeTabs` | 是否显示类型 Tab | `boolean` | true |
| `defaultType` | 固定资源类型 | `string` | '' |
| `fetchTagClassifiers` | 标签查询函数 | `TagClassifiersFetcher` | 内置请求 |
| `fetchResources` | 资源分页查询函数 | `MarketplaceResourceFetcher` | 内置请求 |
| `labels` | 文案覆盖 | `MarketplaceResourcePickerLabels` | {} |
| `defaultKeyword` | 初始搜索关键字 | `string` | '' |
| `selectionMode` | 选择模式 | `none \| single \| multiple` | none |
| `modelValue` | 选中的资源 ID | `string \| string[] \| null` | - |
| `pageSize` | 每页数量 | `number` | 12 |
| `pageSizeOptions` | 分页选项 | `string[]` | ['12','24','48'] |
| `showPagination` | 显示分页器 | `boolean` | false |
| `enableVersionSelect` | 启用版本选择 | `boolean` | false |
| `version` | 当前版本 | `string \| null` | - |
| `fetchVersions` | 版本查询函数 | `FetchCapabilityVersions` | 内置请求 |
| `panelHeight` | 固定面板高度 | `string` | - |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `update:modelValue` | 选中资源变化 | `(id \| id[])` |
| `update:version` | 版本变化 | `(version)` |
| `change` | 选中记录变化 | `(record)` |
| `card-click` | 点击资源卡片 | `(record)` |

#### 用法

~~~vue
<MarketplaceResourcePicker
  v-model="resource"
  :type-options="typeOptions"
  selection-mode="single"
  :fetch-resources="fetchResources"
/>
~~~

#### Rules

- 资源查询和标签查询通过 fetchResources/fetchTagClassifiers 注入，未传时使用内置请求函数。
- 详情 Markdown 与标签过滤使用组件内置渲染器，扩展字段放入 types.ts 契约。
