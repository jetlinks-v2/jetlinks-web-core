# TabsCard 使用说明

卡片式 Tab 切换器，按 options 渲染标签并支持 v-model:activeKey。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `options` | Tab 选项 | `Array<{ label, value }>` | [] |
| `activeKey` | 当前 Tab | `string` | - |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `update:activeKey` | 当前 Tab 变化 | `(key)` |
| `change` | 当前 Tab 变化 | `(key)` |

#### 用法

~~~vue
<TabsCard
  v-model:active-key="activeKey"
  :options="[{ label: '概览', value: 'overview' }]"
/>
~~~

#### Rules

- options 的 value 必须唯一；change 与 update:activeKey 会同时触发。
