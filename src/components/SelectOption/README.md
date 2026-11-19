# SelectOption

候选内容展示，接收 `label`、`icon`、`description`，可用 `icon` 插槽替换图标。说明使用平台次级文字色，默认图标为装饰内容。

它不拥有搜索、键盘、选中态和提交；这些由 Select、菜单等宿主负责。候选可以显示名称与说明，收起态由宿主的 `optionLabelProp` 或公开标签渲染入口呈现短名称，不通过全局 Ant DOM 选择器自动切换布局。
