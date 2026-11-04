# EqualHeightColumns 使用说明

双栏等高布局，限制子面板高度并允许各自内部滚动。

#### Props

| 参数 | 说明 | 类型 | 默认值            |
| --- | --- | --- |----------------|
| `height` | 容器高度 | `number \| string` | 100%           |
| `gap` | 列间距 | `number \| string` | var(--space-8) |
| `leftWidth` | 左列宽度 | `CSS grid track` | 15rem          |
| `rightWidth` | 右列宽度 | `CSS grid track` | 1fr            |
| `align` | 纵向对齐 | `CSS align-items` | stretch        |
| `collapsible` | 是否显示左列展开/收起按钮，仅在 `showLeft=true` 时生效 | `boolean` | true |
| `showLeft` | 是否显示左列；隐藏时右列铺满容器 | `boolean` | true |

#### 事件

- `collapse-change(collapsed: boolean)`：点击按钮展开/收起左列时触发。切换 `showLeft` 不触发此事件。

#### 用法

~~~vue
<EqualHeightColumns :left-width="320" right-width="1fr">
  <template #left>筛选</template>
  <template #right>内容</template>
</EqualHeightColumns>
~~~

#### Rules

- height、leftWidth、rightWidth 可使用 px、rem、百分比或 grid track。
- 左/右面板内容超出时应由面板内部处理滚动。
- `showLeft=false` 时不渲染左列和折叠按钮，移除列间距和分割线，右列占满容器宽度，不受 `leftWidth` / `rightWidth` 限制。
- `showLeft` 切回 `true` 时恢复双栏配置和此前的折叠状态。

#### 当前调整

按钮通过 `top` / `left` 布局坐标居中和贴边，避免 `transform` 在缩放时将 1px 描边分摊到相邻像素，导致按钮看起来比竖线更细。分割线与上下边框重叠一个描边宽度，接通奇数高度取整时可能出现的空隙；描边宽度、折叠定位及过渡时长沿用原有配置。

按钮宽度通过 `round(..., 1px)` 对齐整数 CSS 像素（默认 `12.8px` 取整为 `13px`），避免左边框因小数像素抗锯齿而比竖线更浅；不支持 `round()` 的浏览器回退到原宽度。按钮去掉阴影，分割线以一个描边宽度的右外边距参与居中，使其右沿与按钮右沿重合，上下横边直接连接竖线。描边仍统一使用 `--line-strong`。

本次隔离渲染复验：真实 Vue / Ant Design Vue 组件的 14 个交互场景及 16 个缩放像素场景通过，覆盖 16px / 18px 字号、1 / 2 倍像素密度、90% / 100% / 110% / 125% CSS 缩放、奇偶容器高度、零间距、不同面板内边距、无面板、展开/收起、关闭折叠及隐藏左列。像素检查同时验证完整描边覆盖和上下接缝连通：按钮上、下、左直边与竖线均为 `RGB(217, 217, 217)`，在 1 / 2 倍像素密度下均占据连续的 1 / 2 个不透明像素。收起贴边正确，无页面错误或新增横向溢出；SFC 编译、组件范围 Vite 生产构建及差异空白检查通过。内置浏览器控制未启用，当前登录态产品页仍待复验；全量类型检查与应用构建的边界及待执行命令见本节末尾。

展开时保留按钮的左、上、下边框，分割线通过渐变的透明中段避开按钮内部，不覆盖面板背景。缺口高度为按钮高度减去上下描边（默认 30px，按钮高 32px），让接缝处的描边重叠。布局根节点与按钮挂载层共用 `--equal-height-columns-toggle-height` 尺寸；仅在显示折叠按钮且展开时留出缺口，没有折叠按钮时继续显示完整分割线。

实现位于 `runtime-ui/jetlinks-web-core/src/components/EqualHeightColumns/index.vue`，定位与尺寸/滚动监听位于同目录 `useColumnToggle.ts`。组件统一将折叠按钮置于双栏容器的垂直中点，展开时挂在中缝分割线上；存在外层 `ContentPanel` 时，通过 Teleport 挂载到最近的面板，避免中间页面容器的 `overflow: hidden` 裁切，收起后贴齐面板左边缘并保持上下居中。没有面板时保留组件内定位，收起后贴齐组件左边缘。业务页面无需覆盖样式，props、slots 和事件保持不变。

双栏仍使用“左列 / 间距 / 右列”三个 Grid 轨道，零高度锚点在间距轨道中上下居中，按钮中心跟随锚点；无面板时挂载层通过 `top: 50%` 对齐同一中点。ResizeObserver 读取真实轨道位置，挂载层坐标不叠加过渡；布局轨道与按钮 `left` 沿用 200ms 的 `cubic-bezier(0.23, 1, 0.32, 1)`。按钮移出根节点后显式继承该局部过渡变量。`fr` 收起保留为 `0fr`，减少动态效果偏好下仍直接切换位置。

既有定位验证：产品页与设备列表覆盖展开/收起、点击和页面切换，无残留按钮或新增滚动溢出。独立真实组件用例覆盖 16px/32px 面板内边距、无背景面板、无面板、`240px`/`30%`/`1fr`/`2fr` 列宽、`32px`/`0px`/`2%` 间距、快速反向、窗口滚动、隐藏左列后恢复及卸载清理。新增 hook 严格 TypeScript 检查通过。

既有居中与贴边验证（本次改动前）：产品页展开、收起、再次展开通过，垂直中心偏差均为 `0px`；展开按钮右边框为 `0px`，收起按钮与面板左边缘偏差为 `0px`，未新增页面横向溢出。独立真实组件覆盖有面板的 `240px`/`360px` 高度、无面板的 `160px`/`280px` 高度，展开与收起时垂直中心及贴边偏差均为 `0px`；关闭折叠功能时不显示按钮并保留完整分割线。SFC 脚本/模板/scoped CSS 编译、组件范围 Vite 生产构建、样式门禁与 `git diff --check` 通过。

质量边界：组件范围 `vue-tsc` 仍因根节点 `attrs.style` 的 `unknown[]` 报既有 `TS2345`，本次仅改样式，没有修改该类型边界。未执行完整应用 build 或完整项目 `vue-tsc`，工作区无独立 lint 脚本。其他浏览器及系统减少动态效果偏好切换未复验。完整待验证命令为 `pnpm -C runtime-ui exec vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json` 与 `pnpm -C runtime-ui build`。
