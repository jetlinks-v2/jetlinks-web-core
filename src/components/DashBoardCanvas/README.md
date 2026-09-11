# DashBoardCanvas

独立仪表盘画布，从 `ui/modules/visualization-dashboard-ui/components/LoadingBoard/index.vue` 抽离。core 负责网格渲染、组件注入和配置面板承载；调用方负责提供业务组件和保存配置。

这是按需导入的公开目录入口，不在 core 组件插件中全局注册。它与 `components/Dashboard` 展示组件族无依赖，也不依赖 visualization 的项目、设计器 store 或模块注册表。

## 自动发现

采用 **共享懒加载来源 → 每处按范围取组件 → 生成 catalog → 画布渲染**。复用 `discovery` 的来源整理、加载缓存和 catalog 装配；同目录的 `dashboard-sources.ts` 作为可选宿主目录适配器，保持独立导入，通过 Vite 原生 `import.meta.glob` 发现以下目录：

- `ui/modules/*/visDashboard/*/manifest.json` 与同组的 `*/index.ts`
- `ui/modules/*/packages/component/*/manifest.json` 与同组的 `*/index.ts`

分组清单作为轻量元数据预读，组件入口全部保持懒加载；没有分组清单的入口不参与 catalog。共享来源在适配器导入时只装配一次，不执行组件入口，也不引用业务模块总出口。无需扫描配置文件、构建扫描插件或全局注册。`DashBoardCanvas` 与通用 discovery 不导入适配器，调用方可选择共享来源、自定义来源或直接提供 `catalog`。业务组件继续遵循 `system-resource.md` 的三组导出契约。

以下代码放在调用方页面的 setup 中；`modules` 应取调用方需要且已有 SaaS 过滤允许的模块范围，示例仅演示一个已有组件：

```ts
import { dashboardSources } from '@jetlinks-web-core/components/DashBoardCanvas/dashboard-sources'
import { useDashboardCatalog } from '@jetlinks-web-core/components/DashBoardCanvas/discovery'

const { catalog, loading, errors, reload } = useDashboardCatalog(dashboardSources, {
  modules: ['visualization-resources'],
  directories: ['packages/component'],
  groups: ['visualization-resources/packages/component/BusinessAlarm'],
  entries: ['visualization-resources/packages/component/BusinessAlarm/Metrics'],
})
// 将 catalog 传给 DashBoardCanvas；其他页面复用 dashboardSources，使用自己的范围。
```

范围规则：

- `modules` 必填。`directories`、`groups`、`entries` 可选，均在执行入口加载器前过滤，条件取交集。
- 分组 ID 为 `moduleId/directory/groupFolder`；入口 ID 为 `moduleId/directory/groupFolder/componentFolder`，不含 `/index.ts` 或 glob 相对路径前缀。采用完整 ID 精确匹配，不受 manifest.id 影响，不支持通配符。
- `includeTypes` / `excludeTypes` 在加载入口后筛选导出类型，排除优先。不能据目录猜类型，例如 `Metrics` 目录导出 `alarmMetrics`；控制入口加载开销应使用 `entries`。
- 可选筛选省略表示不限，空数组表示空集；`excludeTypes: []` 表示不排除。范围不匹配或为空时不会退回全量加载。

来源支持 `ReadonlyMap<string, DashboardSources>`、ref 或 getter；条件支持普通对象、ref 或 getter。共享来源按只读方式使用；需自定义来源时可用 `collectDashboardSources({ manifests, entries })` 整理自己的 glob 结果，该函数不再接收启用模块列表。自定义 `DashboardSource.entries` 的键即入口筛选 ID。普通 Map 是静态来源，动态替换可用 `shallowRef`，需跟踪原地增删时使用响应式 Map；hook 只订阅所选模块来源。

多个调用方共享加载器及成功加载的代码缓存，并发加载同一入口复用 Promise，失败可重试。每次生成独立 catalog；画布沿用实例内配置和状态，不共享组件实例、租户数据或业务请求结果。组件导出定义按只读方式消费，画布编辑时复制默认配置。历史组件自身若存在模块级可变业务状态，仍由组件所属模块治理。

加载失败与重复 type 返回带来源的 `errors`；重复 type 不静默覆盖。范围改变立即撤销旧 catalog、丢弃迟到结果，不覆盖已保存仪表盘配置，缺失类型由画布占位显示。`reload()` 重新装配当前范围并重试失败入口，不重新下载已成功加载的入口。

性能边界：构建仍会处理全部匹配的懒加载入口及传递依赖，浏览器只在当前范围生成 catalog 时请求对应入口。组件内部运行组件及配置表单是否进一步懒加载遵循原有实现；其他调用链的 eager 导入不受此适配器控制。共享来源只提供加载能力，范围沿用调用方已有过滤，不新增 SaaS 权限逻辑。已包含入口之间的运行时范围变化无需重新构建，部署后新增组件代码需要重新构建发布。

验证：共享适配器迁入画布目录后，四组 glob 匹配文件与迁移前完全一致，旧导入路径已清理；discovery 与共享适配器的定向 strict TypeScript 检查通过；现有 Vite 开发服务将共享适配器转换为 141 个懒加载入口。临时检查通过来源整理零执行、完整入口 ID 匹配、模块/目录/分组/入口范围交集、空范围、并发缓存复用、独立 catalog、失败重试、重复类型拒绝、入口条件响应式变化和过期结果丢弃；未在仓库新增测试文件或依赖。当前没有实际业务页面调用；遵循机器性能约束不执行全项目 lint/typecheck/build。后续接入需验证组件运行依赖和页面交互，可执行宿主 `pnpm build` 补充生产构建验证。本次不新增依赖、不修改 Vite 配置，无需重启后端服务。

## 接入

以下装配代码放在调用方模块。组件契约以 `ui/modules/visualization-resources/system-resource.md` 和现有 BusinessAlarm 实现为依据，直接使用已有三组导出：

```vue
<script setup lang="ts">
import { markRaw, ref } from 'vue'
import { DashBoardCanvas } from '@jetlinks-web-core/components/DashBoardCanvas'
import type { DashboardCatalog, DashboardValue } from '@jetlinks-web-core/components/DashBoardCanvas'
import {
  AlarmMetrics, AlarmMetricsConfig, AlarmMetricsConfigProps,
} from '@visualization-resources/packages/component/BusinessAlarm/Metrics'

const catalog = markRaw({
  groups: [{ id: 'alarm', name: '告警' }],
  components: {
    [AlarmMetrics.name]: {
      component: AlarmMetrics.component,
      configs: AlarmMetricsConfig,
      defaultConfig: AlarmMetricsConfigProps,
      groupId: 'alarm',
      defaultGridItem: { w: 6, h: 8, minW: 3, minH: 4 },
    },
  },
} satisfies DashboardCatalog)
const dashboard = ref<DashboardValue>({ canvas: {}, components: [] })
// 将业务接口读取的配置赋给 dashboard；保存时提交 dashboard.value。
</script>

<template>
  <div style="height: 600px">
    <DashBoardCanvas v-model="dashboard" :catalog="catalog" editable />
  </div>
</template>
```

画布父容器需要有明确高度。组件定义可来自各业务模块的 `visDashboard` 等目录；画布只接收装配后的 `catalog`，不扫描目录、不要求资源集中放置，也不新增全局注册机制。组件分组标题、名称由调用方完成国际化。不要把 Vue 组件定义写进持久化配置。

## 仪表盘配置样式

`styles/config.less` 定义仪表盘独立配置样式，由 `components/ConfigDrawer.vue` 和 `components/CanvasConfig.vue` 加载。参考可视化编辑器的 12px 主字号、20px 行高、4px 间距节奏和 30px 控件高度变量（16px 根字号基准，随平台字号缩放）；颜色复用 core 平台变量，配置面板外观与业务组件的展示主题分离。

配置区域使用 `.dashboard-config-scope`，以 `--dashboard-config-*` 作为可选覆盖入口；旧 `--designer-*` 变量仅在该区域内映射，兼容注入的既有配置表单，不导入 designer 样式、工具或主题 Symbol，不写入 `:root`。不修改公共 ConfigItem、ColorPicker、BusinessAlarm 或历史设计器。调用方可在画布祖先节点设置 `--dashboard-config-font-size`、`--dashboard-config-space-3`、`--dashboard-config-text`、`--dashboard-config-control-bg` 等覆盖值；未设置时使用平台变量和内置默认值。新配置表单优先使用平台变量；读取可选覆盖值时同样保留默认值，例如 `var(--dashboard-config-space-3, var(--space-3, 12px))`。

浮层需要位于配置区域内才能继承局部变量。业务控件显式挂载到 `body` 的浮层及其内部主题逻辑仍由调用方适配，不通过全局补变量或模拟 `.view-designer` 容器处理。

配置行布局参照 `ui/modules/visualization-designer-ui/layout/RightConfig/inspector.less`：标签在上、控件在下，帮助图标位于标签旁，单位与控件同行；清除旧配置项的固定标签宽度及省略，长标签可换行。只在 `styles/config.less` 补充这一布局及分组内边距，不引入编辑器的导航、工具栏或画布样式。验证重点为长标签、单位对齐、无标签配置项及配置区溢出。

样式验证：此前通过 Less 解析、Vue SFC 静态检查与局部变量隔离检查。实际接入仍需核对长标签、单位对齐、深色主题及外置浮层。

## Props 与事件

| API | 说明 |
| --- | --- |
| `modelValue: DashboardValue` | `{ canvas, components }`，配置与组件列表独立于旧项目模型 |
| `catalog: DashboardCatalog` | 分组、以组件 type 为键的渲染组件、配置面板、默认配置和可选缩略图 |
| `editable?: boolean` | 默认 `false`；允许添加、删除、移动、缩放及配置 |
| `previewMode?: boolean` | 默认 `false`；传给业务组件的 `isEdit`，与布局编辑权限独立 |
| `resolveImage?: (fileId: string) => string` | 调用方解析背景资源地址；已提供的背景 URL 优先 |
| `update:modelValue` | 返回完整配置快照；移动/缩放结束、增删、配置应用时触发，调用方决定保存方式 |

旧数据可将画布与组件列表分别映射到 `canvas`、`components`。组件 `id` 必须唯一，`type` 对应 `catalog.components` 的键；网格位置保存在 `componentProps.gridItem`。`visible: false` 的组件不渲染，`isLocked: true` 的组件禁止调整；未注入的组件显示占位并保留配置。组件加载失败显示重试入口，原始错误写入控制台。

## 配置协议

| 能力 | 输入 / 回传 |
| --- | --- |
| 运行时组件 | `info`、`isEdit` |
| 属性组件 | `activeComponent`；`change(value, key)` 写入 `componentProps[key]` |
| 内嵌配置 | `direct` 直接显示；`inspector.embeddedKeys` 对应的面板不重复显示，例如 `theme` |
| 根级配置 | `inspector.embeddedRootKeys` 声明的字段回写组件根，例如 `tooltip` |
| 数据面板 | `inspector.dataComponent` 接收 `modelValue`，通过 `update:modelValue` 回写 `componentProps[entry.name].data` |

配置面板编辑独立草稿，“应用配置”才回传，取消或关闭不修改运行时配置。提交草稿保留期间发生的布局变化和未编辑的配置命名空间。组件的外观、取数、刷新与订阅生命周期由业务组件负责；core 不套用旧 `ComponentItem` 的默认白底、边框及字体，以免覆盖 BusinessAlarm 自身的主题协议。

## 与旧实现的对应关系

| 旧入口 / 行为 | 当前落点 |
| --- | --- |
| `LoadingBoard` 的 `GridLayout` / `GridItem` | `components/GridCanvas.vue`；保留 12 列、25px 行高、8px 间距和负边距对齐 |
| 占位项 → `calcXY` → `dragEvent` | `composables/useDashboardDrag.ts`；保留中心偏移与 14ms 节流 |
| `moved` / `resized` 同步布局 | `GridCanvas.vue`；结束后回传布局，新增组件与被挤开的邻居一起提交 |
| `Selection` 的拖动条和悬停菜单 | `components/WidgetFrame.vue`；内容区禁止触发拖动 |
| 悬浮设置入口、空态、统一抽屉 | `DashBoardCanvas.vue`、`components/UnifiedDrawer.vue`；保留左右停靠、局部无蒙层及拖动时隐藏 |
| 设计器全局状态、全局拖拽组件 | 实例内 state 与显式注入的 catalog |

抽离后增加取消拖拽时的布局回滚，并清理实例监听器。画布背景支持颜色和 URL 编辑、fileId 地址解析及原有滤镜；旧上传组件依赖 manager，未迁入 core。旧画布统一卡片样式由业务组件配置替代。

manager 的普通/云端预览、发布管理和 designer 拖拽已移除对旧 `visualization-dashboard-ui` 的调用；旧仪表盘项目预览进入现有空态，不迁入新的公共画布。历史仓库本身仍保留，因为设备/规则模块的部分组件还依赖其中的数据 hooks 和资源。现有 BusinessAlarm 内部也仍有 visualization 依赖；注入这些组件时，调用方须满足其运行环境，core 独立不意味着这些业务组件已解耦。


## 验证与依赖

新增依赖为与旧画布相同的 `vue3-grid-layout-next@^1.0.7`。其他环境按更新后的 lockfile 安装依赖，无后端服务重启要求。

已通过 19 项临时配置/拖拽契约检查、8 个 Vue SFC 的脚本/模板/样式静态编译、27 项中英文文案检查，以及画布目录的定向 Vue 类型检查（使用工作区已安装的网格库 1.0.7 路径）。验证脚本和专用 tsconfig 不纳入仓库。未执行整项目 lint/build 或浏览器验证；实际页面接入时仍需验证容器尺寸、滚动后的拖放、缩放碰撞及业务组件取数。可在依赖安装后用临时 tsconfig 将 include 收敛至此目录，再运行 `pnpm exec vue-tsc --noEmit -p <临时配置路径>`。
