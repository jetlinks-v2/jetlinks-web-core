# SlantedTabs

带圆角斜边、数量和白色选中态的横向页签。独立页签头使用 SVG 遮罩裁切单层 CSS 背景，通过背景与层级切换选中态；状态反馈复用 Ant Design Vue。支持禁用、方向键/Home/End 导航、Enter/Space 选择、横向滚动和内容面板。适合资源分类切换；图文卡片选择请使用 TabsCard，分段筛选面板请使用 SegmentPanel。

从 `@jetlinks-web-core/components` 具名导入，或使用全局注册的 `SlantedTabs`。按需入口为 `@jetlinks-web-core/components/SlantedTabs`。

```vue
<template>
  <SlantedTabs v-model:activeKey="activeKey" :options="options" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { SlantedTabs } from '@jetlinks-web-core/components'
import type { SlantedTabOption } from '@jetlinks-web-core/components'

const activeKey = ref('all')
// 截图演示数据；业务接入时由 hook 提供真实数量和国际化后的 label。
const options: SlantedTabOption[] = [
  { key: 'all', label: '全部', count: 21 },
  { key: 'edge', label: '边缘节点', count: 10 },
  { key: 'video', label: '视频', count: 10 },
]
</script>
```

| 属性 / 事件 | 类型 | 说明 |
| --- | --- | --- |
| `options` | `SlantedTabOption[]` | `key` 唯一，支持字符串/数字；`label`、可选 `count`、`disabled`。0 正常显示，省略数量则隐藏。 |
| `activeKey` | `string \| number` | 支持 `v-model:activeKey`；不传时组件内部维护选择。 |
| `state` | `SlantedTabsState` | 可选 `loading`、`error`、`emptyText`，状态优先级为加载、错误、空选项、内容。 |
| `update:activeKey` / `change` | `(key) => void` | 仅有效的新选择触发；加载时禁止切换。 |

选中项被移除、禁用或传入无效 key 时，显示首个未禁用项，不自动 emit；全部禁用时无选中项。异步数量、请求和错误恢复由调用方 hook/service 管理。组件不修改路由、store 或父级数据。

| 插槽 | 参数 | 说明 |
| --- | --- | --- |
| 默认 | `{ option, activeKey }` | 对应页签的内容；省略则仅渲染页签栏。内容首次选中时挂载，切换后保留实例；加载/错误状态期间卸载内容。 |
| `tab` | `{ option, active }` | 自定义标题（默认文字加数量）。 |
| `loading` | 无 | 覆盖默认 Spin。 |
| `error` | `{ error }` | 覆盖默认 Alert，可放重试操作。 |
| `empty` | 无 | 覆盖无选项时的 Empty；业务内容空态由内容插槽负责。 |

可直接通过组件的 `style` 或 CSS 类设置 `color` 和 `font-size`，例如 `style="color: #e6f4ff; font-size: 20px"`：

- `color` 控制默认背景色，默认白色；选中项使用原色，未选中项沿水平方向在 11.72%～75% 之间从 20% 渐变到 60% 不透明度。文字颜色独立，悬停不会改变背景。
- `font-size` 控制文字及页签尺寸，默认 `1rem`。根字号为 16px 时，普通短标题页签为 128 × 40px、文字与数量间距 8px、相邻页签重叠 8px。选中时文字不放大，切换不会改变几何尺寸。
- 页签不再均分容器；长标题会撑宽页签并横向拉伸遮罩，空间不足时导航栏横向滚动。精确对照参考图时，使用 16px 字号、默认尺寸和同样的短标题。
- 轮廓位于 `shape.svg`，根据 128 × 40 PNG 的透明边缘拟合。原图字体未提供，尚不能保证文字栅格及轮廓抗锯齿逐像素一致；原图背景透明度也不同于本次指定的 20%～60% 渐变。

渐变可直接覆盖，无须修改 SVG：

```css
.slanted-tabs {
  font-size: 16px;
  color: #fff;
  --slanted-tabs-inactive-bg: linear-gradient(90deg, rgba(255, 255, 255, 0.2) 11.72%, rgba(255, 255, 255, 0.6) 75%);
  --slanted-tabs-active-bg: #fff;
}
```

`--slanted-tabs-active-bg` 和 `--slanted-tabs-inactive-bg` 均支持纯色或完整 CSS 渐变，显式背景变量优先于 `color`。`--slanted-tabs-background` 仍只控制整个导航栏背景；`--slanted-tabs-panel-bg` 可独立设置内容/反馈区域背景，未指定时沿用选中背景或白色。

尺寸仍可通过 `--slanted-tabs-height`、`--slanted-tabs-min-width`、`--slanted-tabs-overlap` 覆盖；固定长度不随字号缩放，单独改变宽高比例会拉伸遮罩。`--slanted-tabs-nav-padding` 控制导航栏内边距，默认 0。`--slanted-tabs-font-family` 控制字体；`--slanted-tabs-font-size` 提供默认字号，行内 `font-size` 可直接覆盖。未指定的空态文案遵循 Ant ConfigProvider 的语言配置，其余文案由调用方国际化后传入。

当前为新增公共组件，尚未接入生产页面；最小接入示例见上文。
