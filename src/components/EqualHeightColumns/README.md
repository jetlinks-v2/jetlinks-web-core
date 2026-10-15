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

实现位于 `runtime-ui/jetlinks-web-core/src/components/EqualHeightColumns/index.vue`：双栏使用“左列 / 间距 / 右列”三个 Grid 轨道，按钮和分割线直接锚定间距轨道中点，兼容长度和百分比间距。按钮不再通过 `ResizeObserver` 写入 `left` 并叠加过渡；布局与按钮位移统一使用 200ms 的 `cubic-bezier(0.23, 1, 0.32, 1)`，可在切换途中反向。`fr` 轨道收起时保留为 `0fr`，避免类型变化引起跳变。减少动态效果偏好下直接切换布局与位置，保留颜色反馈；组件 API 和业务页面无需调整。

验证：当前内置浏览器的实际产品页及独立组件用例覆盖展开/收起、快速反向切换、`15rem` / `320px` / `30%` / `1fr` / `2fr` 列宽、`32px` / `0px` / `2%` 间距、容器缩放和隐藏左列后恢复。逐帧定位偏差小于 0.01px，布局结束后按钮仍过渡的帧数为 0；Vue SFC 编译、组件范围 Vite 生产构建和 `git diff --check` 通过。

质量边界：组件范围 `vue-tsc` 检查仍因根节点 `attrs.style` 的 `unknown[]` 类型报 `TS2345`，修改前 HEAD 版本复查结果相同；当前工作区没有 lint 脚本或配置。未执行全量应用构建，未在其他浏览器或切换系统减少动态效果偏好后复验。全量待验证命令为 `pnpm -C runtime-ui exec vue-tsc --noEmit -p jetlinks-web-core/tsconfig.json` 和 `pnpm -C runtime-ui build`，应先处理已有类型错误再完成全量检查。
