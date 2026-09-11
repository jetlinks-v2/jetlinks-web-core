# HomeView 使用说明

首页内容承载组件，提供可更新的首页值和变化事件。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `value` | 首页配置或数据 | `unknown` | - |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `update:value` | 值变化 | `(value)` |
| `change` | 值变化 | `(value)` |

#### 用法

~~~vue
<HomeView v-model:value="homeConfig" @change="saveHomeConfig" />
~~~

#### Rules

- 首页数据的加载、保存和权限控制由页面或 store 负责。
