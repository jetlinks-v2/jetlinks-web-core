# FullCalendar 使用说明

系统日历组件，按月加载事件并支持选择日期或快速重置。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `selectable` | 是否允许选择 | `boolean \| string` | false |
| `preview` | 预览模式 | `boolean` | false |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `selectDate` | 选择日期或日期范围 | `(value)` |
| `resetRapid` | 重置快速选择 | `()` |

#### 用法

~~~vue
<FullCalendar selectable @select-date="onSelectDate" />
~~~

#### Rules

- 事件数据来自系统日历接口，页面不直接修改内部缓存。
- preview=true 时隐藏编辑动作，只用于查看。
