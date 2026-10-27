# CardBox 卡片组件

## 设计识别与组件映射

`ui/cards/` 中的设计图归并为五种可复用卡片骨架：

| 设计图 | 组件 | 职责 |
| --- | --- | --- |
| `AI对话.png`、`Frame 2147237558.png` | `CardSuggestion` / `card-suggestion` | 推荐问题或快捷意图入口卡 |
| `Card 15.png`、`Card 15 (1).png`、`Card 15 (2).png` | `CardSummary` / `card-summary` | 带头像、摘要、标签和分组底栏的实体摘要卡 |
| `Card 19.png` | `CardStatus` / `card-status` | 状态优先的纵向摘要卡 |
| `col.png` | `CardStatistic` / `card-statistic` | 指标值、占比环和图例卡 |
| `Task.png` | `CardToggle` / `card-toggle` | 带尾部开关或动作区的可选卡 |

## 组件结构

- `CardShell.vue` 是内部基础壳，统一 `active`、`disabled`、点击、键盘触发和可访问性状态，不作为公开组件导出。
- `CardAvatar.vue` 是内部头像适配层，复用 Ant Design Vue Avatar 并统一尺寸和语义色。
- 五个公开卡片使用 `data` 对象承载展示数据，并保留具名插槽覆盖局部内容。
- `CardToggle` 复用 `@jetlinks-web/components` 的 `CardSelect`，通过 `itemRender` 替换卡片内容；`active` 映射卡片选中值，`checked` 独立控制开关状态。
- `CardBox/index.ts` 统一导出组件与类型，`src/components/index.ts` 同时提供全局注册和具名导出。

## 公共契约

除 `CardToggle` 外，公开卡片均提供：

| 属性 / 事件 | 类型 | 说明 |
| --- | --- | --- |
| `data` | 对应组件的 `*Data` 类型 | 卡片展示数据 |
| `active` | `boolean` | 由调用方传入的选中状态 |
| `disabled` | `boolean` | 禁止点击和键盘触发 |
| `click` | `(data, nativeEvent)` | 返回当前数据和原生事件 |

默认导出的 `CardBox` 及全部公开卡片变体还支持以下外观配置：

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `bordered` | `boolean` | `true` | 是否显示 `#ECEFF3`（`--jet-theme-border-color-1`）边框。 |
| `backgroundOpacity` | `number` | `100` | 主题背景色的不透明度，支持 `0` 到 `100` 的任意数值。 |

`CardToggle` 额外提供：

| 属性 / 事件 | 类型 | 说明 |
| --- | --- | --- |
| `checked` | `boolean` | 尾部开关状态，与卡片 `active` 相互独立 |
| `update:checked` | `(checked)` | 支持 `v-model:checked` |
| `checkedChange` | `(checked, data)` | 返回开关状态和当前卡片数据 |

```vue
<CardSummary
  :data="summary"
  :active="summaryActive"
  :bordered="false"
  :background-opacity="80"
  @click="handleSelect"
/>
```

具体数据字段由 `src/components/CardBox/types.ts` 统一维护，业务模块不应复制这些类型。

## 样式约束

- 卡片默认遵循内容面板契约：`--panel-radius` 为 16px，`--panel-padding` 和 `--panel-gap` 为 16px，背景为 80% 透明度白色；默认边框使用 `var(--jet-theme-border-color-1)`。特殊卡片可通过 `backgroundOpacity` 显式调整背景透明度。
- active 使用完整边框、弱背景和 focus ring，不使用单侧彩色线条表达选中状态。
- 各组件 scoped CSS 只负责编排结构，不定义新的品牌色、字号或阴影体系。

## CardBox 底部操作

默认导出的 `CardBox` 额外支持以下配置；五种卡片变体不透传此配置。

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `actionLayout` | `'equal' \| 'split'` | `'equal'` | `equal` 保留既有按钮排列；`split` 使用分隔线底栏，左侧文字次级操作、右侧一个主按钮。 |
| `primaryActionKey` | `string \| number` | `undefined` | 对应 `actions` 中的 `key`，仅在 `split` 布局下生效。未指定或该操作被隐藏时，不自动提升其他操作。 |

`actions` 插槽继续接收原 action 字段，并增加 `buttonType: 'link' | 'text' | 'primary'` 与 `isPrimary: boolean`。自定义权限按钮将 `buttonType` 绑定到其 `type`，原权限码、禁用、提示、确认框和回调继续由页面提供。`CardBoxAction`、`CardBoxActionSlotScope` 等类型由 CardBox 目录入口及组件根入口导出。

`CardBoxActions.vue` 是内部底栏，负责可见项筛选、主次操作排序与展示。DOM 顺序与视觉顺序一致；窄卡片允许换行，极窄宽度优先保留操作文字。`index.vue` 保留卡片主体及插槽装配，主体样式移到同目录 `style.css`。已有 `bottom-tool` 插槽保持完整覆盖默认底栏的行为。

## 运维中心列表卡片按钮布局

- 目标与 owning module：运行时前端 `jetlinks-web-core/src/components/CardBox/` 提供可选布局，`modules/device-manager-ui` 接入；参考 `views/device/alarm/components/DeviceAlarmRecordCard.vue` 的底栏分隔线、文字次级按钮和右侧单主按钮。
- 范围与主操作：网络组件 `views/link/Type/index.vue`、设备接入网关 `views/link/AccessConfig/index.vue`、协议管理 `views/link/Protocol/index.vue`、插件管理 `views/link/plugin/Content.vue` 显式启用 `actionLayout="split"` 和 `primaryActionKey="update"`；编辑置于右侧，启停、删除和扩展操作留在左侧。删除保留危险色、原禁用条件和确认框，不依据数组位置选择主按钮。
- 菜单核对：证书管理、远程升级、应用模版与日志管理当前使用表格；流媒体服务、阿里云与 DuerOS 使用主从详情结构，本次不新增卡片模式。
- 边界：其他页面的 CardBox 默认布局、物联告警自定义底栏、表格操作列、菜单、路由、接口、权限码和业务回调保持原契约，仅修改 `runtime-ui/` 内前端代码；组件不请求接口、读写业务状态或感知菜单路由。
- 编译与构建：6 个修改 SFC 的脚本、模板、样式编译通过；新增底栏及公开类型通过定向严格 TypeScript 检查。Node 24.22.1 下，在 `jetlinks-web-core/` 执行 `node --max-old-space-size=8192 --max-semi-space-size=64 ../node_modules/vite/bin/vite.js build --outDir /tmp/jetlinks-cardbox-build -- --module-name device-manager-ui`，最终构建通过，转换 11,040 个模块，耗时 54.45 秒；保留既有资源路径、CSS 注释和包体大小等构建警告。各修改 Git 边界的 `git diff --check` 通过。
- 页面验证：本地 `9200` 登录态下，网络组件 5 张、网关 8 张、协议 2 张、插件 3 张卡片均仅有一个右侧“编辑”主按钮；启用中的网络组件和网关仍禁用删除。协议卡片删除确认可正常取消，编辑弹窗正常打开并取消。390px 视口下，插件卡片底栏与按钮均不再横向越界；桌面尺寸恢复后，右侧主按钮位置正确。
- 兼容验证：规则编排页面继续使用原默认底栏，无主按钮；物联告警的 2 张记录卡仍通过自定义底栏展示“告警日志 / 处理记录 / 告警处理”，未生成默认底栏。此次页面复验未捕获脚本错误。当前账号为管理员，未使用无权限账号实测；权限码及权限按钮的处理方式保持原调用契约。
- 整体类型检查：在 `runtime-ui/` 执行 `node node_modules/vue-tsc/bin/vue-tsc.js --noEmit --pretty false -p modules/device-manager-ui/tsconfig.json`，仍被既有 `views/device/Product/ResourcePackage/index.vue:187` 与 `views/link/Certificate/type.d.ts:2` 的 TS1005 阻断；修复后需重跑，不能将组件定向检查等同于全模块类型检查通过。根项目及设备模块没有独立 lint 脚本。

## 验证结果

- Vue SFC 编译：新增的 7 个 Vue 文件 script、template、style 全部编译通过。
- 聚焦类型检查：新增文件及 `src/components/index.ts` 未产生新错误；全量 `vue-tsc` 仍存在仓库既有类型错误。
- 全量构建：完成 21441 个模块转换并进入 chunk 渲染，最终因本机 esbuild 内存不足失败，错误为 `runtime: cannot allocate memory`。
- 文件门禁：本次新增 Vue 文件最大 267 行，没有超过 300 行的文件。
