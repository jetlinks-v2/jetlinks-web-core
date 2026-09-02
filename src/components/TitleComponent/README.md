# TitleComponent 使用说明

带强调色左标记的标题行，支持右侧 extra 插槽。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `data` | 标题内容 | `string` |  |
| `style` | 标题行样式 | `CSSProperties` | {} |

#### 事件

- 无自定义事件。

#### 用法

~~~vue
<TitleComponent data="基础配置">
  <template #extra><a-button type="link">编辑</a-button></template>
</TitleComponent>
~~~

#### Rules

- extra 插槽只放轻量操作或补充信息，不放复杂业务编排。
