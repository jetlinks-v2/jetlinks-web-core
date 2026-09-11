# Search 使用说明

旧版 ProSearch 查询组件，按 columns.search 配置生成简单或高级条件。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `columns` | 带 search 配置的列定义 | `JColumnsProps[]` | [] |
| `type` | 查询模式 | `advanced \| simple` | advanced |
| `target` | 查询组件唯一 key | `string` | - |
| `noMargin` | 去除外边距 | `boolean` | false |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `search` | 提交查询条件 | `(params)` |

#### 用法

~~~vue
<ProSearch
  :columns="columns"
  target="device"
  @search="loadData"
/>
~~~

#### Rules

- 新页面优先使用 ConditionFilter；仅在兼容既有轻量固定搜索时使用 ProSearch。
- columns.search.type 支持 select、number、string、treeSelect、date、time 等，详细契约见 Search/search.md。
