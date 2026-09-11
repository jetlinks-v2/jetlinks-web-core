# MCarousel 使用说明

轻量轮播容器，按给定内容在多个面板间切换。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `data` | 轮播数据 | `any[]` | [] |
| `showLength` | 每页显示数量 | `number` | 8 |

#### 事件

- 无自定义事件；通过 `card` 插槽渲染每个面板。

#### 用法

~~~vue
<MCarousel :data="cards" :show-length="4">
  <template #card="item"><EntityCard :title="item.name" /></template>
</MCarousel>
~~~

#### Rules

- 数据项应包含稳定的 id；复杂面板通过 `card` 插槽渲染。
