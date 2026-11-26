# CorePagination

运行时的独立列表分页，与 `JProTable` 共用 `JPagination` 的总数、区间、多语言和翻页样式；普通 `JProTable` 直接使用内置分页。

```vue
<CorePagination v-model:current="page" v-model:page-size="pageSize" :total="total" @change="fetchPage" />
```

- `current` 从 1 开始，默认每页 12 条，可选 12／24／48／96。换容量先同步模型、回到首页，再发一次 `change(page, size)`；只在 `change` 或模型监听其中一处加载数据。
- 分页控件固定为 Ant 默认尺寸，不提供「跳至 [ ] 页」，无需传 `size` 或 `showQuickJumper`。宿主表格和独立页脚的共同配置在 `defaults.ts`；不要用全局 CSS 隐藏已经渲染的输入框。
- `total` 为 0 时不渲染；总数未知时传 `:total-known="false"`，推断的下一页边界不会被当成总数展示。固定容量可传 `:show-size-changer="false"`，加载或只读状态可传 `disabled`。
