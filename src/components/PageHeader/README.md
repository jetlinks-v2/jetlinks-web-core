# PageHeader 使用说明

页面标题头，提供返回、描述和右侧操作插槽。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `title` | 页面标题 | `string` | 必填 |
| `description` | 描述文本 | `string` | - |
| `showBack` | 显示返回按钮 | `boolean` | false |
| `variant` | `default` 保持原页面标题卡片；`plain` 使用透明背景、细分隔线的轻量标题，保留右侧操作 | `default \| plain` | default |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `back` | 返回操作 | `()` |

#### 用法

~~~vue
<PageHeader title="设备管理" show-back @back="goBack">
  <template #actions><a-button type="primary">新增</a-button></template>
</PageHeader>
~~~

#### Rules

- 监听 back 时由调用方接管返回；未监听时组件调用 router.back()。
- 顶级导航根路由通常不重复渲染 PageHeader。
- 内容工作区需要标题定位但已有外层面板时，可使用 `variant="plain"`；页级主操作仍放在 `actions` 插槽，避免重复操作行。
