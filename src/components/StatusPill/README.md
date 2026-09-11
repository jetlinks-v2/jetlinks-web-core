# StatusPill 使用说明

标准状态胶囊，将 draft、review、published、deprecated、archived 映射为本地化文案。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `status` | 状态值 | `string` | 必填 |

#### 事件

- 无自定义事件。

#### 用法

~~~vue
<StatusPill status="published" />
~~~

#### Rules

- 已知状态使用内置 i18n 文案；未知状态按原值展示。
- 状态值用于语义映射，业务显示文案不要在页面重复维护。
