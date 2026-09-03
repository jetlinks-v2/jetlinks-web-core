# PageRouteView 使用说明

路由内容承载器，接入 route-loading store 并在异步路由加载时显示骨架。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `showRouteLoading` | 是否显示路由加载态 | `boolean` | true |
| `skeletonVariant` | 骨架类型 | `content \| layout` | content |

#### 事件

- 无自定义事件。

#### 用法

~~~vue
<PageRouteView>
  <RouterView />
</PageRouteView>
~~~

#### Rules

- 路由 meta 可提供 routeLoadingComponent；组件会优先复用 store 中的加载组件。
- showRouteLoading=false 时直接渲染默认插槽。
