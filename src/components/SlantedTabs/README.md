# SlantedTabs

带圆角斜边、数量和白色选中态的横向页签。独立页签头使用 SVG 遮罩裁切单层 CSS 背景，通过背景与层级切换选中态；状态反馈和溢出菜单复用 Ant Design Vue。支持禁用、方向键/Home/End 导航、Enter/Space 选择、无滚动条的横向滚动、溢出菜单、边缘阴影和内容面板。适合资源分类切换；图文卡片选择请使用 TabsCard，分段筛选面板请使用 SegmentPanel。

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
- 页签不再均分容器；长标题会撑宽页签并横向拉伸遮罩。空间不足时导航栏保留横向滚动，通过标准与 WebKit 滚动条样式隐藏滚动条，不为滚动条预留高度，使页签与下方内容连续衔接；支持普通鼠标上下滚轮横移、触控板／触摸横向滚动及方向键、Home/End 导航。精确对照参考图时，使用 16px 字号、默认尺寸和同样的短标题。
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

运行时设备列表分类与设备详情已接入该组件，入口分别为 `modules/device-manager-ui/views/device/list/unified/index.vue` 和 `modules/device-manager-ui/views/device/list/components/IotDeviceDetailView.vue`。

## 溢出导航

- 标签总宽度超过容器时，右侧固定显示“更多”按钮，鼠标悬浮时打开 Ant Design Vue 菜单，移入菜单后保持展开，移出按钮及菜单后关闭。菜单按原顺序列出左侧、右侧未完整显示的标签，包含部分被裁切的标签；沿用标题插槽、数量及禁用／加载状态。选择后共用原有选择入口，并把选中项滚入视野，不重复触发选择事件。
- 隐藏原生滚动条。鼠标位于标签栏内时，向下滚轮向右移动标签，向上滚轮向左移动；兼容像素、行和页三种滚轮单位，触控板按主轴位移且不叠加原生默认滚动。只要标签栏有溢出，整个导航区域（含“更多”按钮）均接管滚轮，在左右端点继续滚动也不带动页面；鼠标移出导航栏或标签全部能容纳时，页面正常滚动。保留 Ctrl+滚轮缩放和触摸横向滚动；手动滚动不改变当前选中项。
- 左侧存在隐藏内容时显示左内部阴影，右侧同理；滚到端点后对应阴影消失。阴影不拦截点击或触摸，也不占据额外高度。
- 容器宽度、选项、标题或数量变化时重新计算；外部 `activeKey` 更新时把选中项滚入视野。全部标签能容纳时移除“更多”按钮及两侧阴影，以完整容器宽度判断溢出，避免按钮预留宽度导致反复显隐。
- 标签栏保留方向键和 Home/End 导航；“更多”按钮支持 Enter、Space、向下键打开菜单，可见后聚焦首个可用项。键盘聚焦会等待浮层结束隐藏测量，成功后停止等待，关闭或卸载时取消待执行帧；鼠标悬浮不抢占焦点。菜单支持上下键、Home/End、Enter/Space，Escape 关闭后归还触发按钮焦点。

实现入口：`index.vue` 组合标签和公开的 `Dropdown/Menu/Button`，在导航容器绑定可取消默认行为的 `wheel` 事件；`style.css` 管理可视区、滚动条隐藏及两侧阴影；`useSlantedTabs.ts` 管理选择和面板保留；`useSlantedTabsOverflow.ts` 管理可见范围、滚轮横移、菜单焦点及尺寸／标题观察，高频更新合并到动画帧，卸载时清理。对外 props、事件、内容懒挂载、业务路由和接口保持既有契约。

验证：在 core 执行 `node --test tests/slantedTabsOverflow.test.mjs`，17 项通过，覆盖普通鼠标双向滚轮、两端持续滚轮拦截、触控板主轴、滚轮单位与缩放、滚动首尾／中间状态、部分裁切菜单、容器临界宽度、导航内边距、受控选择、数字／字符串 key、禁用／加载、动态标题／选项、更新合并与卸载清理，以及菜单隐藏测量期间的焦点等待和取消。组件定向 `vue-tsc --noEmit`、Vite 生产构建（7 个模块）、中英文 JSON 与差异检查通过。在 `9200` 真实设备详情页确认标签栏两端持续滚轮时页面位置不变，移出导航栏后页面正常滚动；“更多”悬浮展开、移入菜单保持、移出关闭，方向键切换菜单焦点及 Escape 归还焦点正常。普通上下滚轮可双向横移，触控板横向输入不重复移动；两端阴影及“更多”菜单随可见范围同步。1341px 溢出和 1800px 未溢出视口均保持 40px 高度，菜单选择、Home/End 和菜单键盘操作正常；变宽时已展开的菜单随“更多”按钮一同关闭。根项目与 core 未配置 lint 脚本，未运行全量应用构建。
