# AmbientCard 使用说明

通用氛围卡外壳，提供 hero、cool、warm、flat 四种渐变或纯色容器。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `variant` | 视觉变体 | `hero \| cool \| warm \| flat` | hero |
| `padded` | 是否提供内边距 | `boolean` | true |

#### 事件

- 无自定义事件。

#### 用法

~~~vue
<AmbientCard variant="cool">
  <div>卡片内容</div>
</AmbientCard>
~~~

#### Rules

- 组件只负责外壳和间距，内容布局放在默认插槽。
- 不要把业务请求或状态编排放入组件。
