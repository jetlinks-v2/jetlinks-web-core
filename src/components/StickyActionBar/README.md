# StickyActionBar 使用说明

页面或抽屉底部操作条，支持 sticky bottom 和普通 inline 两种位置。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `hint` | 左侧提示 | `string` |  |
| `position` | 定位方式 | `bottom \| inline` | bottom |

#### 事件

- 无自定义事件。

#### 用法

~~~vue
<StickyActionBar hint="修改尚未保存">
  <a-button>取消</a-button>
  <a-button type="primary">保存</a-button>
</StickyActionBar>
~~~

#### Rules

- 组件不定义按钮样式，按钮权限和点击逻辑由调用方提供。
- JlDrawerShell 的 foot 插槽内使用 position=inline。
