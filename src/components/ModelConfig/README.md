# ModelConfig 使用说明

共享模型配置工作区，提供两级配置导航、文件目录与编辑器、manifest、批量上传和扩展页签。组件通过 props、slots、emits 对接宿主，不调用模型业务接口。

#### 统一工作区

采用单对象配置工作区，宿主保留自己的摘要、状态与动作；共享组件统一承载导航和内容，不增加统计区、条件筛选或新的编辑流程。

```text
宿主对象摘要与动作
[模型配置] [模型文件] [基础信息：showManifest] [宿主扩展，例如模型测试]
模型配置：
  [参数定义 二次推理 实时推理 图片推理 其他配置] [JSON格式] [编辑]
  参数内容（占满剩余宽高）
模型文件：
  文件目录/架构/搜索 | 文件预览或编辑、文件动作 | 可选属性
```

- 一级复用设备列表同一 `SlantedTabs` 的默认样式，移除本地轮廓颜色与灰色底轨覆盖；模型文件紧跟模型配置，其余可选页保持原相对顺序。只使用导航，不使用其内容缓存。开启可选的 `preserveDisabledActive`，保留外部禁用当前页时的原选中与内容状态；其他使用该 Tabs 的页面仍采用默认行为。
- 导航位于透明背景上，内容区独立复用 `ContentPanel`，仅拉平与页签相接的左上角。两个宿主通过模块 `getContentPanelOverrides()` 将当前模型配置路由的外层面板设为 `background: false`，保留原留白与布局；运营端同时移除模型包局部外壳的重复白底、边框与圆角。避免页签的半透明轮廓叠在白底和模糊效果上，导致与设备页同一组件仍有色差；不移动导航或宿主摘要，也不改全局 Tabs 样式。
- 二级 `ModelParameterEditor` 改用设备数据页同款 Ant Design Vue `Segmented`，保留原页面 key、错误定位与内容挂载规则。工具栏采用同款底部分隔线和留白，内容透出 `ContentPanel` 背景；右侧可选 `actions` 插槽继续承载 JSON/表单切换、编辑、保存与取消，窄宽度时换行。参数定义使用升级任务同款小尺寸 `a-table`，保留稳定行键、行草稿、输入、勾选、校验和空态；不增加分页、排序或请求。两处 core 同步，改动仅落在参数编辑器导航与参数定义表格展示。
- 模型配置和扩展页占满内容宽度。文件目录仅在模型文件页可见，原底部“模型管理”跳转由一级模型配置入口替代。目录实例保留以维持搜索与展开状态；文件编辑器和业务扩展内容继续按原规则挂载/卸载，切走测试页仍触发业务组件的请求取消。
- JSON 模式和自定义 `definition-content` 保留独立操作栏。所有插槽名、参数、文件操作与保存事件保持原契约。

#### 使用方与兼容边界

- 运行端 `modules/jetlinks-ai-ui/views/machine-vision/Model/ModelConfig/index.vue` 被模型、场景包两条路由复用。模型测试由宿主 `extraConfigTabs` / `extra-config-content` 提供，仅 `state.value === 'enabled'` 时可用；`enabledUnavailable`（启用但本地不可用）、禁用和编辑配置期间仍不可切入。共享组件不识别测试业务 key，也不判断启用状态。
- 运营端 `modules/saas-manager-ui/views/developerCenter/scene-pack/model-package-config/index.vue` 不提供测试页；保留算法模型选择插槽、`models/targetInference` 目录限制及模板导入能力。
- 两个现有宿主均关闭 manifest 和目录顶部新增按钮。`showManifest=true` 时仍保留基础信息页；`showAddFile=false` 只隐藏顶部入口，目录节点快捷新增保持原逻辑。
- 内置 `definition`、`manifest` 以及外部扩展 key、顺序、disabled 保持不变，编辑期间扩展仍禁用。文件导航采用内部数字 key，不占用原字符串扩展名称。
- 文件加载、架构变化监听与宿主请求继续在整个工作区生命周期中执行，参数编辑器中的模型文件选择不依赖是否打开文件页。保存、校验、参数适用性、二次推理、ROI、文件归属和全部事件 payload 未调整；截图未展示的实时/图片推理勾选列仍保留。
- `ui/jetlinks-web-core` 和 `runtime-ui/jetlinks-web-core` 为同一仓库的独立检出，需要同步同一份实现。运行端宿主旧有内部类定位覆盖已移除，二级操作栏由共享组件统一布局。

#### 编辑后切换一级页签

已实现一级页签的未保存修改提示，继续采用现有单对象配置工作区，不改变导航结构。影响 `ui/jetlinks-web-core` 与 `runtime-ui/jetlinks-web-core` 中的 `ModelConfig` / `ModelParameterEditor`，覆盖运行端模型、场景包及运营端开发者模型包；不修改两个宿主的业务保存接口。

- 编辑后尝试切换可用的一级页签时，先检查实际草稿是否与进入编辑时不同。未修改、改回原值、重复点击当前页签均不弹窗；页签选择、折叠和用户/默认参数查看模式不作为数据修改。原本禁用的模型测试页仍按既有规则禁用。
- 有修改时使用 Ant Design Vue `Modal` 的自定义 footer 显示“保存”“丢弃”“取消”。已有 `JlConfirmDialog` 仅提供两个动作且没有 footer 插槽，本轮不修改它的全局契约。关闭弹窗等同取消切换，继续编辑。
- 现有二级页共享整份 definition 草稿，因此保存/丢弃针对本次整份配置编辑，而不是只处理当前二级页。保存或丢弃成功后结束本次编辑，再进入目标页签。
- “保存”复用唯一的 `prepareForSave()` 校验和既有 `save-config` / `save-file` 事件，等待宿主通过现有 `done(success)` 回调报告成功后再切换。校验失败取消待切换目标，由原校验定位错误所属二级页签与用户/默认参数模式；接口失败保留草稿与当前编辑状态。保存中阻止再次切换。
- “丢弃”恢复编辑前的内容并重置子编辑器草稿，不发送保存请求。“取消”保留全部草稿和原选择。参数定义的空白/未勾选新行、二次推理尚未序列化的草稿、无效默认参数 JSON 都必须计入修改检测，不能只比较父组件收到的 JSON，也不能通过执行保存校验来判断是否修改。
- 各草稿所有者提供无副作用的修改查询，由 `workspace/useModelConfigEditor.ts` 和 `useModelConfigNavigation.ts` 编排提示、现有保存回调与目标切换。默认表单的行草稿负责参数定义比较，其余配置与编辑起点直接比较，避免参数预览自动补齐字段造成“改回原值”误报；JSON、自定义插槽和文件编辑仍比较原草稿内容。二级页共享整份草稿、自由切换，校验直接定位错误页签，不增加二级离开守卫。
- 原 props、slots、事件名与 payload 保持兼容；共享能力只增加可选连接点，不调用业务 API，不扩展浏览器刷新、返回、路由离开或目录内文件选择规则，不新增单元测试。
- 验证：两端定向 `vue-tsc --noEmit`、五个变更 Vue 文件的 SFC/模板/LESS 和 `check:ui-style` 通过；Vue 文件分别为 139 / 31 / 300 / 288 / 280 行。两处实现与新增语言键一致，`git diff --check` 通过；未新增或修改单元测试，本轮未重复完整打包。core 没有独立 lint 脚本，采用现有 UI 样式门禁。
- 运行端浏览器已验证：无修改直接切换、参数改回原值不提示、二级页自由切换并保留草稿、空白新行与未完成二次推理也触发提示；取消和关闭保留内容，丢弃恢复原 23 行及 ROI 值；保存校验失败定位参数定义、二次推理、实时推理默认 JSON 错误页，取消原待切换目标。宽窄页面均验证了弹窗，模型测试仍禁用。未向服务端保存测试数据，草稿已丢弃，借用的设备页已恢复。
- 保存成功/接口失败路径已按两个宿主原有 `done(true/false)` 回调核对：仅成功结束编辑并切页，失败解除保存状态且保留草稿；尚未在浏览器实测真实保存请求。运营端浏览器未实际验证，其定向类型检查与共享实现一致性检查已通过。复核入口为运行端 `useModelConfigActions.ts` 和运营端 `useModelPackageConfigPage.ts`。

#### 文件目录

- 顶部为目录标题、架构选择和文件名/路径搜索；搜索仅筛选已加载文件，不发起请求、不改变文件数据与编辑草稿。忽略大小写和首尾空格，保留匹配文件的父目录并展开，清空后恢复原展开状态。
- 目录树独立滚动。沿用 `a-tree` 的双击展开、快捷新增、架构标签与 tooltip；保留 `motion=null`，避免筛选移除节点时遗留动画引用。新建、预览、下载、编辑、替换、删除与批量上传沿用原回调。
- 目录宽度继续使用原 localStorage key，范围为 220–520px；1100px 以下沿用固定窄栏并关闭拖动。属性面板和文件编辑器保留独立滚动，切页后重新计算编辑器尺寸。

#### 实现职责

- `index.vue`：props/emits、一级导航与 `ContentPanel`、配置与扩展插槽、原参数编辑器引用和新增文件弹窗组合。
- `workspace/useModelConfigWorkspace.ts`：组合状态、目录、配置编辑、文件操作、导航和尺寸 hooks；业务请求继续由宿主负责。
- `workspace/useModelConfigEditor.ts`：编辑草稿、表单/JSON、唯一保存前校验、文件选择及原保存回调。
- `workspace/useModelConfigFiles.ts`：新增、上传、替换、预览、删除确认和事件分发；`workspace/ModelFileWorkspace.vue` 仅组合目录、文件内容和属性展示。
- 原 `fileOwnerOptions.ts`、`batchFileUpload.ts` 及其外部引用路径保留。新增内部文件集中在 `workspace/`，避免继续平铺稳定职责域；本次拆分的入口和新增 Vue/TS 文件均不超过 300 行。

#### 验证

- 浏览器已对照设备与模型配置页确认一级导航背景修正：导航祖先面板透明且无 blur，下方独立使用 `ContentPanel`；文字、选中填色和透明渐变与设备页一致。本轮二级导航和参数表已在运行端实际 869px / 1935px 客户区核对：窄屏操作栏换行、宽屏同排，页面不产生横向溢出；表头背景、14px 字号、600 字重、8px 单元格留白与设备升级任务一致，二级工具栏分隔线、12px 底部留白及 16px 内容间隔与设备数据页一致。临时视口设置已恢复，运营端视觉未实际验收。
- 本轮两端定向 `vue-tsc --noEmit`、SFC/模板/LESS、UI 样式门禁通过；两份 core 实现一致，参数编辑器与参数表分别为 297 / 285 行。脚本对比仅增加导航选项和列配置，原草稿、预览、校验与保存函数未变，参数输入和勾选事件绑定保持一致。浏览器已验证五个二级页、文件页切换、新增/删除草稿、改路径、实时及图片适用性预览和退出编辑恢复原 23 行；只读和测试禁用规则保持原样。未保存服务端数据、未新增或修改单元测试，本轮局部修改未重跑完整构建。
- 两个宿主工作区的定向 `vue-tsc --noEmit`、共享组件 SFC/模板/LESS、运营端 UI 样式门禁通过。目录原有通用控件事件类型按字符串 key 契约收窄；可选回调参数声明与既有事件一致，不改变运行时处理。
- 运行现有 `node --test tests/slantedTabsOverflow.test.mjs`，17 项通过；未新增或修改单元测试。原主组件 51 个函数中，50 个函数体保持不变，布局函数适配拆分后的编辑器引用。
- 从 `runtime-ui` 执行 `pnpm --config.verify-deps-before-run=false -F jetlinks-web-core build -- --module-name jetlinks-ai-ui` 通过：10564 个模块，耗时 1m 9s。构建保留已有的 Node 版本、CSS 注释、输出选项及大 chunk 警告；入口事件声明采用现有构建插件支持的内联形式，未修改插件或依赖。
- 从 `ui` 执行 `pnpm --config.verify-deps-before-run=false -F jetlinks-web-core build -- --module-name saas-manager-ui` 在 7287 个模块转换后被既有依赖缺失阻断：`src/utils/json/index.ts` 导入的 `lossless-json` 已声明为 4.3.3，但当前运营端 node_modules 与 lockfile 均未包含。保留现有依赖文件修改，需先按工作区既有依赖流程同步安装，再重跑同一命令。运营端完整打包结果尚未验证；共享组件在运营端的定向类型、SFC 和样式检查已通过。
- core 和运营端没有独立 lint 脚本，已使用既有 `check:ui-style` 门禁；两份 core 及运行端宿主 `git diff --check` 通过。
- 已获用户授权使用浏览器对照设备与模型配置页。模型/场景包/开发者模型包三类入口的完整业务回归（测试启用/禁用和切页取消、保存取消、错误定位、目录搜索/架构切换及算法模型/模板操作）仍需验收。宿主仅调整当前配置路由的背景声明与重复外壳样式，原大文件不扩展业务职责。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `model` | 模型上下文 | `object` | - |
| `formatDetails` | 模型架构分组 | `FormatDetail[][]` | [] |
| `locale` | 沿用共享 locale 的宿主文案覆盖 | `object` | {} |
| `files` | 文件列表 | `ModelFile[]` | [] |
| `filesLoading` | 文件加载态 | `boolean` | false |
| `availableFormats` | 可用格式 | `FormatDetail[]` | [] |
| `formatLoading` | 架构加载态（保留原属性） | `boolean` | false |
| `showAddFile` | 显示新增文件 | `boolean` | true |
| `showManifest` | 显示 manifest | `boolean` | true |
| `extraConfigTabs` | 扩展配置页签 | `array` | [] |
| `batchUploadOwners` | 批量上传目录 | `string[]` | `["python", "skill"]` |
| `customCreateVisible` | 自定义创建方式的目录可见性判断 | `(path?: string) => boolean` | - |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `load-files` | 请求加载文件 | `(payload)` |
| `save-config` | 保存模型配置 | `(payload)` |
| `add-file` | 新增文件 | `(payload)` |
| `batch-add-file` | 批量新增文件 | `(payload)` |
| `add-file-close` | 关闭新增文件面板 | `()` |
| `save-file` | 保存文件 | `(payload)` |
| `replace-file` | 替换文件 | `(payload)` |
| `preview-file` | 预览文件 | `(payload)` |
| `delete-file` | 删除文件 | `(file)` |

#### 用法

~~~vue
<ModelConfig
  :model="model"
  :files="files"
  :available-formats="formats"
  @save-config="saveModel"
/>
~~~

#### Rules

- 文件类型见 `modelFileDirectory.ts`，格式和 manifest 契约见 `workspace/types.ts` 与 `workspace/useModelConfigEditor.ts`。
- 批量上传与新增文件请求通过 props 回调接入，组件不固定业务 API。
- 在 `models` 模型文件目录单文件上传时，文件名输入框默认只回填上传文件首个 `.` 前的内容，替换文件会同步更新自动回填的名称；若用户已手动修改文件名，后续选文件不再覆盖。后续由业务类型、算法模型和模型格式字段拼接模型文件后缀。
