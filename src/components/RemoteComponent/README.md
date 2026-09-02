# RemoteComponent 使用说明

从 moduleRegistry 加载本地或远程模块组件，并透传 props、事件和插槽。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `remoteName` | 远程应用名称 | `string` | 必填 |
| `componentName` | 组件名称 | `string` | 必填 |
| `remotePath` | 远程组件地址 | `string` | - |
| `componentProps` | 组件 props | `Record<string, unknown>` | {} |
| `componentEvents` | 组件事件 | `Record<string, Function>` | {} |
| `timeout` | 加载超时毫秒数 | `number` | 10000 |

#### 事件

- 无自定义事件。

#### 用法

~~~vue
<RemoteComponent
  remote-name="visualization-resources"
  component-name="ResourcePreview"
  :component-props="{ id }"
/>
~~~

#### Rules

- remoteName 必须已在 moduleRegistry 注册，remotePath 只在需要动态加载时提供。
- 远程组件加载失败和权限校验由注册中心/模块负责，页面不要复制加载逻辑。
