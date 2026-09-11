# VirtualScroll 使用说明

固定行高虚拟滚动列表，支持触底加载和横向滚动通知。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `data` | 列表数据 | `unknown[]` | 必填 |
| `itemHeight` | 单项高度 | `number` | 50 |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `reachBottom` | 接近底部 | `()` |
| `horizontalScroll` | 横向滚动 | `(scrollLeft: number)` |

#### 用法

~~~vue
<VirtualScroll :data="rows" :item-height="48">
  <template #default="{ item }">{{ item.name }}</template>
</VirtualScroll>
~~~

#### Rules

- 所有行必须使用相同 itemHeight，否则滚动位置与渲染项会错位。
- reachBottom 在同一次触底过程中只触发一次，离开底部后才允许再次触发。


## 进一步阅读

- [组件注册](../../docs/组件注册.md)
- [ConditionFilter 详细说明](ConditionFilter/readme.md)
- [Search 兼容说明](Search/search.md)
- [TermsCascader 详细说明](TermsCascader/readme.md)
- [CardBox 详细说明](CardBox/README.md)
- [ModelParameterEditor 详细说明](ModelParameterEditor/README.md)
- [StatusTag 详细说明](StatusTag/README.md)
