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

- 卡片圆角统一为 `var(--r-6)`，默认边框使用 `var(--jet-theme-border-color-1)`；主题背景通过 `backgroundOpacity` 配置透明度。
- active 使用完整边框、弱背景和 focus ring，不使用单侧彩色线条表达选中状态。
- 各组件 scoped CSS 只负责编排结构，不定义新的品牌色、字号或阴影体系。

## 边界

- 保留既有 `CardBox/index.vue` 行为，避免影响当前业务页面。
- 不修改 `runtime-ui/`、业务模块、路由、菜单、接口或国际化资源。
- 组件只负责展示、选中态和事件分发，不包含请求、全局状态或业务编排。

## 验证结果

- Vue SFC 编译：新增的 7 个 Vue 文件 script、template、style 全部编译通过。
- 聚焦类型检查：新增文件及 `src/components/index.ts` 未产生新错误；全量 `vue-tsc` 仍存在仓库既有类型错误。
- 全量构建：完成 21441 个模块转换并进入 chunk 渲染，最终因本机 esbuild 内存不足失败，错误为 `runtime: cannot allocate memory`。
- 文件门禁：本次新增 Vue 文件最大 267 行，没有超过 300 行的文件。
