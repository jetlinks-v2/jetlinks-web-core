# DesignerPreview 使用说明

可视化设计方案预览容器，加载 visualization-designer-ui 的预览能力。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `data` | 设计器页面 JSON 或对象 | `object \| string` | {} |

#### 事件

- 无自定义事件。

#### 用法

~~~vue
<DesignerPreview :data="pageJson" />
~~~

#### Rules

- 组件依赖 visualization-designer-ui 与 visualization-resources 注册资源；未注册时不能独立运行。
- data 为字符串时必须是合法 JSON。
