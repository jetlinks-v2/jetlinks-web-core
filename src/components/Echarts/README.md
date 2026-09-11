# Echarts 使用说明

ECharts Vue 封装与注册插件，提供图表配置、按需 library 注册和实例导出能力。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `option` | ECharts 配置 | `object` | - |
| `library` | 需要注册的图表/组件列表 | `unknown[]` | [] |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `error` | 图表初始化或渲染异常 | `(error, stage)` |

#### 用法

~~~vue
<div style="height: 320px"><Echarts :option="option" :library="library" /></div>
~~~

#### Rules

- 图表容器默认撑满父元素，尺寸由外层容器控制。
- 组件实例通过 expose 提供 getDataURL()；图表类型注册由 library 与 Echarts/library.ts 共同决定。
