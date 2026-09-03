# DetailHeader 使用说明

详情页头部，展示标题、返回按钮和头部插槽内容。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `title` | 标题 | `string` | 必填 |
| `showBack` | 显示返回按钮 | `boolean` | false |
| `backTitle` | 返回按钮提示 | `string` | i18n 默认文案 |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `back` | 返回操作 | `()` |

#### 用法

~~~vue
<DetailHeader title="设备详情" show-back @back="router.back">
  <template #actions><a-button>编辑</a-button></template>
</DetailHeader>
~~~

#### Rules

- 监听 back 时由调用方接管返回；未监听时组件调用 router.back()。
- actions、description 等插槽用于承载页面级操作和摘要。
