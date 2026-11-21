# SelectionSummary

将已选名称显示为标签，宽度不足时保留完整标签并以 `+数量` 汇总其余项；悬停和无障碍名称包含完整列表。空列表显示调用方提供的占位文案。

```vue
<SelectionSummary :names="selectedNames" :placeholder="$t('chooseRecipients')" />
```

按目录入口 `@jetlinks-web-core/components/SelectionSummary` 默认导入，或从 `@jetlinks-web-core/components` 具名导入；不全局注册。

- `names: readonly string[]`：已解析的展示名称，不接受用户 ID。
- `placeholder: string`：未选择、加载中或加载失败时的展示文案，由调用方控制。
- 父容器需提供可收缩的宽度，例如 flex 子项设置 `flex: 1; min-width: 0`。
- 组件只测量自身布局，不请求资源或修改选择；监听尺寸、名称和字体变化，卸载时释放监听。

生产使用：物联告警与视觉告警弹窗的通知对象展示。候选搜索和选择流程继续由各自业务组件承载。
