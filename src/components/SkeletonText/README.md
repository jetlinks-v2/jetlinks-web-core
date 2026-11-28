# SkeletonText

文字、计数和紧凑指标的单行加载占位。复用 Ant SkeletonInput 动画与主题，同时移除其输入框最小宽度，避免 20px 的计数占位挤占其他元素。

`width` 默认64、`height` 默认14，支持像素数字或CSS长度；`active` 默认true。组件隐藏于辅助阅读，调用方为整体区域提供 loading/aria-busy 状态。只在加载时使用；失败和已加载但缺失的数据需要各自文案。

```vue
<SkeletonText v-if="loading" :width="24" />
<span v-else>{{ count }}</span>
```

通过 `@jetlinks-web-core/components/SkeletonText` 默认导入，或从公共根导出具名导入。
