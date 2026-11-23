# CorePagination

运营端的独立列表分页，与 `JProTable` 共用 `JPagination` 的总数、区间、多语言和翻页样式；已有 `JProTable` 不需要通过插槽替换分页。

```vue
<CorePagination v-model:current="page" v-model:page-size="pageSize" :total="total" @change="fetchPage" />
```

`current` 从 1 开始，`pageSize` 默认 12，`pageSizeOptions` 默认 `['12', '24', '48', '96']`。换容量回到第 1 页，模型更新后发出一次 `change(page, size)`；业务选择在 `change` 或监听模型其中一处加载数据，不要两处都请求。`total` 为 0 不渲染；只有推断的下一页边界时传 `:total-known="false"`，不把推断值作为总量展示。固定容量面板传 `:show-size-changer="false"`；支持 `disabled` 与 `size="small"`。
