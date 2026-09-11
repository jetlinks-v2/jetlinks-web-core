# IconBadge 使用说明

带图标、文字和可选图片的徽章卡，适合列表项或摘要信息。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `image` | 图片地址 | `string \| null` | - |
| `text` | 文字 | `string \| null` | - |
| `icon` | 图标名 | `string \| null` | - |
| `alt` | 图片替代文本 | `string` |  |
| `size` | 外层尺寸 | `number` | 48 |
| `innerSize` | 图标/图片尺寸 | `number` | 按 size 计算 |

#### 事件

- 无自定义事件。

#### 用法

~~~vue
<IconBadge icon="SettingOutlined" text="系统配置" />
~~~

#### Rules

- image、icon 和 text 均可选；只传 text 时仍保持统一徽章尺寸。
