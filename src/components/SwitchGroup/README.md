# SwitchGroup 使用说明

单选切换组：一组互斥选项，容器为 1px 描边的浅灰圆角条，选中项为白色圆角块并显示主题色文字。组件只负责渲染选中态与派发选中值，不内置状态点、图标等任何业务语义，文本内容通过 `option` 插槽下发。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `modelValue` | 当前选中值 | `string \| number` | - |
| `options` | 选项列表 | `SwitchGroupOption[]` | `[]` |
| `ariaLabel` | 分组语义标签，透传到容器 `aria-label` | `string` | `''` |
| `disabled` | 整体禁用 | `boolean` | `false` |

`SwitchGroupOption`：

| 字段 | 说明 | 类型 |
| --- | --- | --- |
| `value` | 选项值，同组内唯一 | `string \| number` |
| `label` | 选项文案，未使用 `option` 插槽时的默认文本 | `string` |
| `count` | 计数；不传时不渲染计数位，传 `'—'` 可保留占位 | `number \| string` |
| `disabled` | 单独禁用当前选项 | `boolean` |

#### 插槽

| 插槽 | 说明 | 作用域 |
| --- | --- | --- |
| `option` | 选项内容，默认渲染 `option.label`；状态点、图标、富文本等前缀内容都在这里自定义 | `{ option: SwitchGroupOption, selected: boolean }` |

计数位由组件统一渲染，固定排在插槽内容之后，因此插槽里只需要负责状态点、图标和文案。

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `update:modelValue` | 选中值变化 | `(value: string \| number)` |
| `change` | 选中值变化 | `(value: string \| number, option: SwitchGroupOption)` |

#### 用法

只做文案切换时不需要插槽：

~~~vue
<SwitchGroup
  v-model="viewMode"
  :options="[{ value: 'list', label: '列表' }, { value: 'card', label: '卡片' }]"
  aria-label="视图模式"
/>
~~~

需要状态点时，在插槽里自行组合状态点和文案：

~~~vue
<SwitchGroup
  :model-value="status"
  :options="statusOptions"
  :aria-label="t('IotDeviceList.filter.status')"
  @change="changeStatus"
>
  <template #option="{ option }">
    <a-badge :status="statusTones[String(option.value)]" />
    <span>{{ option.label }}</span>
  </template>
</SwitchGroup>
~~~

~~~ts
import type { SwitchGroupOption } from '@jetlinks-web-core/components/SwitchGroup'

const statusTones: Record<string, 'success' | 'error' | 'default'> = { online: 'success', offline: 'error', disabled: 'default' }
const statusOptions = computed<SwitchGroupOption[]>(() => ['online', 'offline', 'disabled'].map(value => ({
  value,
  label: t(`UnifiedDeviceList.${value}`),
  count: statusCounts.value[value] ?? '—',
})))
~~~

`SwitchGroup` 同时是 core 组件入口的具名导出和全局注册名：模板里直接写 `<SwitchGroup>`，只有需要类型时才按上面的目录入口导入。

#### Rules

- `options[].value` 必须唯一；`label`、`count` 只影响展示，组件不做业务映射，状态语义由调用方下发。
- 状态点、图标等装饰内容一律走 `option` 插槽，不要为了某个业务场景给组件加内置字段。
- 选中项再次点击同样会派发 `change`；需要「再次点击取消选中」的页面在回调里自行判断。
- `modelValue` 没有匹配到任何选项时全部选项为未选中态，组件不会自动回退到第一项。
- 组件无请求、无路由、无全局状态副作用；计数完全由调用方提供的 `options` 决定。
- 尺寸、圆角、描边和文字色全部取自 core 主题变量，调用方不要在页面里重复覆盖。
- 选项很多、需要换行或分组的场景请改用 `SegmentPanel`、`ChipGroup` 等容器能力，不要在本组件外再包一层重复的容器。
