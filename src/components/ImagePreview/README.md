# ImagePreview

知识库与视觉事件共用的大图弹窗。公开入口为 `@jetlinks-web-core/components` 的 `ImagePreview`，按需入口为 `@jetlinks-web-core/components/ImagePreview/index.vue`。

- `open: boolean`、`url: string` 必填；`title?: string` 默认为“大图预览”。
- `boxes?: ImagePreviewBox[]` 默认为空，支持百分比/像素坐标框；类型从目录或 core 根入口导入。
- `close` 事件由调用方关闭弹窗。
- 图片完整适配为 100%，滚轮按指针位置缩放至 400%，放大后限界拖动；还原按钮、切换图片、重开弹窗及容器尺寸变化会重置。
- 弹窗卸载清理尺寸监听和拖动状态；沿用视觉事件原有工具栏，不添加其他操作。

视觉事件包装组件仅负责保留“告警画面”默认标题和既有类型契约，知识库直接消费本组件，不依赖 AI 模块。

组件使用运行时 props 声明并通过 `PropType` 关联公共类型，兼容 `setup-name-support` 的匿名预编译。编译回归验证：`node --test tests/imagePreviewSfc.test.mjs`（在 core 目录执行），覆盖实际插件预转换及 Vue 开发、生产模板编译。
