# Echarts 使用说明

ECharts Vue 封装与注册插件，提供图表配置、按需 library 注册和实例导出能力。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `option` | ECharts 配置 | `object` | - |
| `data-option` | 不可变的完整动态数据快照，替换引用触发更新 | `EChartsCoreOption` | - |
| `defer-offscreen` | 视口外暂缓绘制，恢复时提交最新快照 | `boolean` | `false` |
| `library` | 需要注册的图表/组件列表 | `unknown[]` | [] |
| `layout-profile` | 可选渲染布局策略，普通页面默认使用原生布局 | `EchartsLayoutProfile` | `native` |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `error` | 图表初始化或渲染异常 | `(error, stage)` |

#### 用法

~~~vue
<div style="height: 320px"><Echarts :option="option" :library="library" /></div>
~~~

#### Rules

- 图表容器默认撑满父元素，尺寸由外层容器控制。
- 组件实例通过 expose 提供 getDataURL()；图表类型注册由 library 与 Echarts/library.ts 共同决定。

#### 实时数据

`option` 保留深监听，承载系列类型、颜色、图例、缩放和布局等配置。可选 `data-option` 使用浅监听，只承载完整的 `series` 数据、`dataset` 数据或动态 `xAxis` / `yAxis` 范围和可见性；每次采样替换整个快照，不能依赖逐次累加的局部补丁。系列和多轴采用与 `option` 一致的稳定 `id`，未设 id 的轴按索引对应。系列增删仍由调用方更新配置并管理实例重建。

同一帧只提交最新快照；初始化和配置变化组合配置与最新数据，常规采样仅提交动态字段，保留当前图例选择和 dataZoom。数据数组整体替换，不按元素合并。不要在 `data-option` 中声明主题、布局、图例、缩放或 `media`，这些字段属于 `option`。

`defer-offscreen` 使用 IntersectionObserver；浏览器不支持时沿用即时绘制。隐藏、KeepAlive 暂停或视口外仅保留一个待提交快照，继续由宿主管理采集；恢复时按实际尺寸绘制。`getDataURL()` 在容器尺寸有效时同步提交最新数据，即使图表位于视口外。卸载会取消调度并释放观察器和实例。

~~~vue
<Echarts :option="configuration" :data-option="latestData" defer-offscreen />
~~~

#### Presentation 布局

- `src/hooks/Echarts/geometryDefaults.ts` 与 `measuredLayout.ts` 使用 ECharts 官方测量与布局接口，仅补齐 renderer 副本的布局，不修改 canonical option、数据、单位、序列或业务模块。
- 单个笛卡尔绘图区未声明 `grid.top` 时，按实测标题、顶部图例和轴外沿预留空间；仅声明 `bottom` 不代表顶部布局已完整。数字或百分比顶部图例即使落在默认绘图区内也保留其顶部占用，原生底部图例不变。
- 轴外沿被容器裁切、未声明 `containLabel` 且未指定绘图区宽高时，使用原生标签包含策略后重新测量；未知 option 字段不转换为别名。显式定位、宽高及 `containLabel=true/false`、歧义多绘图区、自定义响应式布局和 `native` profile 仍保持原有行为。
- 连续缩放与 profile 切换会恢复本策略添加的字段，不重放 source，不重置图例选择或 dataZoom。重复出图、跨轮产物漏展示以及正文统计口径不在布局层补偿。

验证：`node scripts/run-echarts-geometry-tests.mjs` 22/22 通过，布局生产文件定向严格类型检查通过，Vue SFC/Canvas 测试构建通过；真实设备会话原图的窄面板与放大视图已视觉验收。Canvas 测试覆盖 360/400/800 宽度、720 高容器、图例选择、dataZoom 与 profile 恢复，canonical 和数据均不变。完整运行时 `pnpm build` 最近一次在 8 GB 堆上限下内存溢出，本布局切片未重跑完整构建，不能替代该门禁。

交互验证可运行 `node scripts/run-echarts-layout-browser-tests.mjs --serve-only`，通过输出地址的 `?manual=1` 控件操作同一 Vue SFC；Ctrl-C 清理临时构建目录。默认入口仍为现有 Playwright 回归。
