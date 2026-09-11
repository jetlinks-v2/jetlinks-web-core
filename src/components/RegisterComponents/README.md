# RegisterComponents 使用说明

按当前路由读取 componentsRegistry，并将注册项插入、替换或追加到默认插槽。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `code` | 注册目标编码 | `string` | 必填 |

#### 事件

- 无自定义事件。

#### 用法

~~~vue
<RegisterComponents code="device.detail">
  <div key="summary">摘要</div>
  <div key="actions">操作</div>
</RegisterComponents>
~~~

#### Rules

- 默认插槽子节点需要稳定 key，注册项的 target 通过 key 定位。
- 插入/替换规则和权限边界见 docs/组件注册.md。
