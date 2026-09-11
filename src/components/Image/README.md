# Image 使用说明

图片展示组件，统一尺寸、预览和替代文本。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `src` | 图片地址 | `string` | - |
| `width` | 宽度 | `number` | - |
| `height` | 高度 | `number` | - |
| `preview` | 兼容底层 Image props（当前展示实现不打开预览） | `boolean` | false |
| `alt` | 替代文本 | `string` | - |

#### 事件

- 无自定义事件。

#### 用法

~~~vue
<Image :src="coverUrl" :width="160" :height="96" />
~~~

#### Rules

- 图片加载失败时遵循底层 Ant Design Vue Image 行为。
- 预览开关只影响查看，不改变 src。
