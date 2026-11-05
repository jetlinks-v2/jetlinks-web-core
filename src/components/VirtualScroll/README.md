# VirtualScroll 使用说明

固定摘要行高虚拟滚动列表，支持一行原位展开、触底加载和横向滚动通知。展开内容按实际高度测量，不将所有记录挂到 DOM。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `data` | 列表数据 | `unknown[]` | 必填 |
| `itemHeight` | 单项高度 | `number` | 50 |
| `expandedKey` | 可选的展开项 `id` / `key`，最多一项 | `string \| number` | 无 |

#### 插槽

`renderItem` 接收该条记录的字段；可选 `expandedItem` 接收相同字段，放置原位展开内容。`itemHeight` 始终只表示摘要高度，展开内容由 ResizeObserver 测量。切换或关闭展开项时保留首个可见摘要的滚动锚点；隐藏状态的零尺寸不覆盖已测高度。业务宿主控制 `expandedKey`，组件不请求数据、不决定详情语义。

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `reachBottom` | 接近底部 | `()` |
| `horizontalScroll` | 横向滚动 | `(scrollLeft: number)` |

#### 实例方法

通过组件 ref 调用 `getScrollTop(): number` 读取当前垂直位置，调用 `scrollTo(top: number)` 同步定位并更新虚拟可见区。
详情返回时在 `nextTick` 后恢复保存的位置，避免依赖隐藏元素的浏览器滚动行为；不访问内部 `.viewport`。

#### 用法

~~~vue
<VirtualScroll :data="rows" :item-height="48">
  <template #renderItem="item">{{ item.name }}</template>
</VirtualScroll>
~~~

#### Rules

- 摘要必须使用相同 itemHeight；需要原位详情时使用 expandedKey 与 expandedItem，不手动改变摘要高度。
- reachBottom 在同一次触底过程中只触发一次，离开底部后才允许再次触发。


## 进一步阅读

- [组件注册](../../docs/组件注册.md)
- [ConditionFilter 详细说明](ConditionFilter/readme.md)
- [Search 兼容说明](Search/search.md)
- [TermsCascader 详细说明](TermsCascader/readme.md)
- [CardBox 详细说明](CardBox/README.md)
- [ModelParameterEditor 详细说明](ModelParameterEditor/README.md)
- [StatusTag 详细说明](StatusTag/README.md)
