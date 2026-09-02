# PageActions 使用说明

页面操作区布局容器，只负责统一排列默认插槽中的按钮。

#### Props

- 无自定义属性；组件通过插槽承载内容。

#### 事件

- 无自定义事件。

#### 用法

~~~vue
<PageActions>
  <a-button>取消</a-button>
  <a-button type="primary">保存</a-button>
</PageActions>
~~~

#### Rules

- 按钮权限、文案和事件由调用方提供。
