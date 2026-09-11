# Captcha 使用说明

安全验证组件，按服务端返回的类型渲染滑块、点选或拼图验证。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `config` | 验证码配置 | `Record<string, unknown>` | {} |
| `open` | 是否打开验证 | `boolean` | false |
| `showDialog` | 是否使用弹窗承载 | `boolean` | true |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `success` | 验证成功 | `(result)` |
| `fail` | 验证失败 | `(error)` |
| `error` | 请求/渲染异常 | `(error)` |
| `close` | 关闭验证 | `()` |
| `imageWidth` | 图片宽度变化 | `(width)` |
| `update:open` | 弹窗状态变化 | `(open: boolean)` |

#### 用法

~~~vue
<Captcha v-model:open="captchaOpen" :config="captchaConfig" />
~~~

#### Rules

- open=true 时自动生成验证码；验证成功后组件会自动关闭。
- showDialog=false 时只渲染验证内容，不创建 Modal。
