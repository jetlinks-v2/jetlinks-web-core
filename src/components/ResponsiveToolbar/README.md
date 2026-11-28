# ResponsiveToolbar

按工具栏自身宽度组织 `leading`、`search`、`actions` 和可选 `selection` 插槽。宽区同行，低于 `stackBelow`（默认 960px）时搜索独占下一行，批量动作保留在同一表头区域。尺寸变化只重排原控件，不创建两套查询/选择状态；嵌入 SplitterPane header 时复用公共等高和结构边界。

`search` 插槽接收 `stacked: boolean`，可供调用方呈现与分行相关的上下文。有界条件搜索直接输入，溢出时在原位置上浮：

```vue
<ResponsiveToolbar>
  <template #leading>状态快捷筛选</template>
  <template #search><ConditionFilter v-model="terms" :fields="fields" /></template>
  <template #actions>主动作</template>
  <template v-if="selected.length" #selection>已选数量和批量动作</template>
</ResponsiveToolbar>
```

按目录入口 `@jetlinks-web-core/components/ResponsiveToolbar` 导入；不请求数据或定义业务操作。

外部 `class`、ARIA 等属性落在实际工具栏根元素，随同一实例停靠／回流。`stackBelow="0"` 可只按控件实测最小宽度决定停靠，适合页签尾部的剩余空间。使用保留实例的隐藏页签时，宿主应对非活动页传入空 `dockTarget`，避免其操作残留在共用表头。

参与适配测量的控件组保持内容宽度，空间不足时由外层自然换行；不能因容器变窄而强制被测组占满整行，否则停靠后的测量宽度会反过来触发退出，造成布局反复跳动。

`leading` 与 `actions` 的最大宽度限制为当前内容盒；若单组比极窄容器还宽，组内可换行内容继续重排，避免整个筛选组被裁掉。未超过内容盒时仍按自然宽度参与停靠测量。

需要宽区融合、窄区保留原区域时，传入 `referenceElement`（结果区域）与 `dockTarget`（表头容器）。达到 `stackBelow` 后通过 Vue Teleport 将同一工具栏移动到目标，低于阈值则回到声明位置；`docked-change` 通知调用方调整范围标题等上下文。工具栏实际宽度决定窄区搜索是否另起一行；不以全局视口或 UA 判断，不创建第二个编辑器，移动时保留组件草稿和查询状态。调用方负责始终保留目标容器，并在 docked 时显示它。

`context` 插槽只在停靠时显示范围标题等上下文；`utilities` 位于主动作之后的最右侧，适合宽区刷新等辅助动作，也只在停靠时显示。两者离开时保留隐藏测量并退出键盘导航。组件同时核对 leading/actions/context/utilities 的实际宽度和搜索最小宽度，翻译变长也会自动退回独立区域。`referenceElement` 应指向目标内容盒（例如目标的 header content 父元素），测量内容宽度会自然扣除其 padding，不能将带额外内边距的整区宽度当作可用空间。
