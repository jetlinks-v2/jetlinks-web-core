# MarketplaceInstallStream 使用说明

市场资源安装进度流，展示固定进度行、实时日志和可折叠日志组。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `rows` | 安装行数据 | `MarketplaceInstallStreamRow[]` | [] |
| `finished` | 是否完成 | `boolean` | false |
| `maxHeight` | 最大高度 | `string` | 8.5rem |

#### 事件

- 无自定义事件。

#### 用法

~~~vue
<MarketplaceInstallStream :rows="installRows" :finished="done" />
~~~

#### Rules

- rows 的 kind、type 和 extra 字段按 types.ts 契约传入。
- 完成状态只影响展示，不替调用方执行安装或重试。
