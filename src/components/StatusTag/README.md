# StatusTag

## 实施计划

目标：基于 Figma 节点 `4664:15431` 新增状态展示公共组件，统一运营端的胶囊状态样式，并支持图标和边框的按需展示。

影响范围与 owning module：

- `ui/jetlinks-web-core/src/components/StatusTag/`：组件本体与使用说明。
- `ui/jetlinks-web-core/src/components/index.ts`：全局注册 `StatusTag`。

不做：不替换既有业务页面中的 `j-badge-status`，不修改运行时前端或业务模块，不新增状态文案映射和后端枚举逻辑。

实施步骤：

1. 新增 `StatusTag`，以文字默认插槽承载状态文案，提供可选 `icon` 插槽；是否带图标由插槽是否存在决定。
2. 提供 `status` 语义色和 `bordered` 开关；成功、警告、错误、信息和禁用状态分别采用 Figma 的在线绿、风险橙、告警红、图表蓝和离线灰，默认保留淡色背景与边框。
3. 对齐 Figma 基准尺寸：13px、500 字重、16px 行高、12px × 4px 内边距和圆角胶囊；图标与文字保持固定间距和垂直居中。
4. 在公共组件入口注册，补充最小用法说明，并运行目标包的类型检查或构建验证。

风险 / 待确认：

- Figma 链接只提供了无图标、带边框的绿色实例；图标变体采用调用方传入的 `icon` 插槽，避免公共组件猜测业务图标。
- 组件只负责状态色，不维护状态值到显示文案的映射；后端返回 `{ value, text }` 时，调用方仍应展示 `text`、按 `value` 传入 `status`。
- 颜色基准：状态节点 `4664:15384` 为在线绿 `#06C170`、离线灰 `#86909C`、告警红 `#F84343`；风险节点 `4722:11054` 为无风险蓝 `#1593FF`、有风险橙 `#F18900`。

验证方式：

- 检查 `StatusTag` 的四种组合：带/不带 `icon` 插槽，`bordered` 为 `true` / `false`。
- 运行 `pnpm -F jetlinks-web-core build`；若环境限制导致未执行，回填待执行命令和风险。

验证结果：

- `node -e "require('vue/compiler-sfc').parse(...)"`：通过，`StatusTag` SFC 语法可解析。
- `git diff --check`：通过。
- `components.d.ts`：已生成 `StatusTag` 自动组件声明。
- Figma 颜色回归：设备列表已确认 `success` 的在线绿 `#06C170` 与 `info` 的无风险蓝 `#1593FF`；风险标签使用 `bordered=false`，不显示节点 `4722:11054` 中没有的描边。
- `pnpm -F jetlinks-web-core build`：未完成。构建在 `transforming...` 阶段超过当前会话命令窗口，未返回最终退出码。
- `pnpm exec vue-tsc --noEmit --pretty false`：未完成。工作区级扫描超过当前会话命令窗口，未返回最终退出码。

待在常规终端完成：

- `cd ui && pnpm -F jetlinks-web-core build`
- `cd ui/jetlinks-web-core && pnpm exec vue-tsc --noEmit --pretty false`

## 使用方式

```vue
<StatusTag status="success" text="在线" />

<StatusTag status="warning" :bordered="false">
  <template #icon>
    <AIcon type="ExclamationCircleFilled" />
  </template>
  待处理
</StatusTag>
```

- `status`：`success`、`warning`、`error`、`info`、`processing`、`default`、`disabled`，默认 `default`。
- `text`：无默认插槽时展示的状态文案；有默认插槽时以插槽内容为准。
- `bordered`：是否显示语义色边框，默认 `true`。
- `icon`：可选命名插槽；不传入时不会占位或渲染图标。

关键代码：

- `ui/jetlinks-web-core/src/components/StatusTag/index.vue`
- `ui/jetlinks-web-core/src/components/index.ts`
