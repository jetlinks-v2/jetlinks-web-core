# JlDrawerShell 使用说明

右侧抽屉壳层，统一头部、主体滚动区和底部操作区。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `open` | 是否打开 | `boolean` | 必填 |
| `width` | 抽屉宽度 | `number` | - |
| `contentWrapperStyle` | 内容容器样式；宽度统一由 `width` 及视口约束确定 | `CSSProperties` | - |
| `icon` | 头部图标 | `string` | - |
| `title` | 标题 | `string` | - |
| `sub` | 副标题 | `string` | - |
| `iconColor` | 图标颜色 | `string` | accent |
| `iconBg` | 图标背景 | `string` | accent-soft |
| `hideHead` | 隐藏头部 | `boolean` | false |
| `formMode` | 以 form 元素承载 | `boolean` | false |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `update:open` | 抽屉状态变化 | `(open: boolean)` |
| `submit` | formMode 下提交 | `()` |

#### 用法

~~~vue
<JlDrawerShell v-model:open="open" title="编辑配置" form-mode>
  <template #default>表单内容</template>
  <template #foot><StickyActionBar position="inline" /></template>
</JlDrawerShell>
~~~

#### Rules

- foot 插槽存在时才渲染底栏。
- formMode 只负责语义化提交，校验和保存逻辑由调用方处理。
- 无遮罩抽屉在关闭动画期间也保持响应式容器宽度：通过 `contentWrapperStyle.width` 补足 Ant Design 关闭时移除的宽度，避免内容撑宽后向左跳动；保留其他传入样式，沿用组件库动画。回归入口为 `tests/drawerShell.test.mjs`。
