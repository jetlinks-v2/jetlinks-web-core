# PageRouteSkeleton 使用说明

路由加载骨架，提供 content 与 layout 两种占位布局。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `variant` | 骨架类型 | `content \| layout` | content |

#### 事件

- 无自定义事件。

#### 用法

~~~vue
<PageRouteSkeleton variant="layout" />
~~~

#### Rules

- 只用于加载期间占位，不承载业务数据或请求逻辑。
