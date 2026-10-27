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

展开时保留按钮的左、上、下边框，分割线通过 `clip-path` 裁去按钮高度对应的线段，形成与按钮相接的缺口，不覆盖面板背景。布局根节点与按钮挂载层共用 `--equal-height-columns-toggle-height` 尺寸；仅在显示折叠按钮且展开时裁切，没有折叠按钮时继续显示完整分割线。

实现位于 `runtime-ui/jetlinks-web-core/src/components/EqualHeightColumns/index.vue`，定位与尺寸/滚动监听位于同目录 `useColumnToggle.ts`。组件统一将折叠按钮置于内容顶部；存在外层 `ContentPanel` 时，通过 Teleport 挂载到最近的面板，避免中间页面容器的 `overflow: hidden` 裁切，收起后贴齐面板左边缘。没有面板时保留组件内定位，收起后贴齐组件左边缘。业务页面无需覆盖样式，props、slots 和事件保持不变。

双栏仍使用“左列 / 间距 / 右列”三个 Grid 轨道，按钮跟随间距轨道中点。ResizeObserver 读取真实轨道位置，挂载层坐标不叠加过渡；布局与按钮 transform 沿用 200ms 的 `cubic-bezier(0.23, 1, 0.32, 1)`。按钮移出根节点后显式继承该局部过渡变量。`fr` 收起保留为 `0fr`，减少动态效果偏好下仍直接切换位置。

验证：实际产品页与设备列表均覆盖展开/收起、点击和页面切换，无残留按钮；产品页恢复原 `overflow: hidden` 后，按钮仍与内容顶部及面板左边缘准确对齐，面板无新增滚动溢出。独立真实组件用例覆盖 16px/32px 面板内边距、无背景面板、无面板、`240px`/`30%`/`1fr`/`2fr` 列宽、`32px`/`0px`/`2%` 间距、快速反向、窗口滚动、隐藏左列后恢复及卸载清理，静止位置偏差均为 0px。SFC 脚本/模板/scoped CSS 编译、新增 hook 严格 TypeScript 检查、组件范围 Vite 生产构建、样式门禁与 `git diff --check` 通过。

缺口样式复验：产品页展开、收起、再次展开通过；展开按钮右边框为 `0px`，分割线裁切高度与按钮实测高度同为 `32px`，收起按钮与面板左边缘偏差为 `0px`，未新增页面横向溢出。SFC 编译、hook 严格 TypeScript 检查、组件范围 Vite 生产构建、样式门禁与 `git diff --check` 再次通过，产品页源码及其 README 无差异。

质量边界：未执行完整应用 build 或完整组件 `vue-tsc`，工作区无独立 lint 脚本；历史组件类型检查曾因根节点 `attrs.style` 的 `unknown[]` 报 `TS2345`，本次没有修改该类型边界。其他浏览器及系统减少动态效果偏好切换未复验。完整待验证命令为 `pnpm -C runtime-ui exec vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json` 与 `pnpm -C runtime-ui build`。
