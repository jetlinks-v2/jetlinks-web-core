# EntityCard 使用说明

实体摘要卡，提供标题、徽标、副标题、主体和底栏插槽。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `interactive` | 是否可点击 | `boolean` | true |
| `title` | 标题 | `string` | - |
| `subtitle` | 副标题 | `string` | - |

#### 事件

- 无自定义事件。

#### 用法

~~~vue
<EntityCard title="边缘网关" subtitle="v2.1">
  <template #body>连接状态：在线</template>
  <template #footer>最近更新：刚刚</template>
</EntityCard>
~~~

#### Rules

- 默认插槽分为 icon、badges、action、body、footer 等具名区域。
- interactive=false 时不提供点击手势。
