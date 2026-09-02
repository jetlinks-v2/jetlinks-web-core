# CloudEmpty 使用说明

统一空态组件；列表/局部面板用 default，页面级空内容用 page。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `type` | 空态尺寸 | `default \| page` | default |
| `description` | 空态描述 | `string` | i18n 默认文案 |
| `style` | 外层样式 | `StyleValue` | - |
| `imageStyle` | 图片样式 | `Record<string, string \| number>` | 按 type 默认 |

#### 事件

- 无自定义事件。

#### 用法

~~~vue
<CloudEmpty type="page" description="暂无设备，请先创建设备" />
~~~

#### Rules

- 新增业务空态优先使用 CloudEmpty，不直接引用 empty.svg/big-empty.svg。
- description 插槽优先级高于 description prop。
