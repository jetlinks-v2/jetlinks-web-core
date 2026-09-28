# ModelConfig 使用说明

模型文件与格式配置工作区，管理目录树、模型定义、manifest、批量上传和扩展配置页签。

#### 目录搜索与底部入口

- 目标：在原顶部“模型配置”按钮的位置提供文件搜索，将该入口放到目录底部并命名为“模型管理”，滚动文件时仍可见；主区 `definition` 页签展示为“模型配置”。
- 范围：`src/components/ModelConfig` 的共享侧栏；`runtime-ui/modules/jetlinks-ai-ui/views/machine-vision/Model/ModelConfig/index.vue` 仅接入新增文案，对应中英文资源同步。
- 结构：沿用现有主从工作区，顶部保留文件目录标题和架构选择，搜索框下方为独立滚动的文件树，底部为带轻阴影的固定操作区。搜索使用 Ant Design Vue 输入框，目录继续使用现有树组件；这是单一文件关键字筛选，不引入条件查询面板。

```text
┌ 文件目录       架构选择 ┐
│ 搜索文件名或路径     × │
│                       │
│ 文件目录树（独立滚动） │
│                       │
├───────────────────────┤
│ ⚙ 模型管理            │
└───────────────────────┘
```

实现：

1. `ModelFileDirectory.vue` 承载侧栏展示和事件转发，`useModelFileDirectory.ts` 承载本地搜索与展开状态，`modelFileDirectory.less` 承载侧栏样式，`modelFileDirectory.ts` 复用原文件和树节点类型。新增 Vue 文件控制在 300 行内；历史主组件只调整目录接线，避免扩散到编辑和保存编排。
2. 在当前架构已加载的文件中按文件名和路径即时匹配，忽略大小写及首尾空格；保留命中项的父级目录并展开，提供无结果提示，清空后恢复完整目录和原展开状态。
3. 将“模型管理”入口放在侧栏底部，保留原选中态与点击处理；底部独立占位，避免遮挡最后一项文件。搜索栏与目录间距使用 `--space-2`。底部入口通过独立文案 `modelManagement` 渲染，页签继续使用 `modelParams` 文案键并显示“模型配置”，不修改页签 key。原新增文件入口、目录图标、架构标签、工具提示和侧栏拖动宽度继续保留。
4. 同步搜索占位文案、无结果提示的默认值与宿主中英文翻译，并执行定向静态检查。

目录交互：通过现有 `a-tree` 的 `expandAction="doubleclick"` 支持双击文件夹展开/收起，继续使用原 `expandedKeys` 与 `@expand` 更新逻辑。目录内新增文件按钮阻止双击冒泡，避免操作按钮时切换目录展开状态；原箭头点击、文件选择、搜索和保存逻辑保持不变。

局部修正：架构选择恢复为靠右的 `9.5rem` 常规宽度，不拉伸填满标题行，窄侧栏允许收缩以免裁切；搜索框使用 `var(--bg)` 白色底。搜索移除部分目录时，Ant Design Vue 的 `MotionTreeNode` 仍渲染旧节点，`getTreeNodeProps` 读取已从节点索引中移除的节点的 `parent`，引发连续异常。目录树显式设置 `motion=null`，直接更新筛选结果，避免旧动画节点残留；展开、折叠、选择及文件数据处理保持原逻辑。

边界：搜索仅影响目录展示，不发起请求，不修改文件数据、当前文件选择、编辑草稿、提交与回显逻辑；保持现有 `load-files`、文件操作和配置保存事件。目录组件的属性保持与原状态逐项对应，避免另外包装一套配置协议。按已确认的拆分范围，历史主组件仍超过 300 行，仅移出本次目录职责；宿主页面仅增加文案映射，不扩展到其他业务重构。

验证：

- 双击展开使用已核实的树组件原生属性，目录组件的定向 `vue-tsc`、SFC 和 LESS 检查通过；没有修改搜索 hook 或数据事件。`git diff --check` 通过，本轮未重复全量构建或启动浏览器验证。
- 间距与入口/页签重命名仅修改样式、文案和文案映射，中英文 JSON 与 `git diff --check` 检查通过；本轮未重复编译或启动浏览器验证。
- 共享主组件、新目录组件与宿主页面的 Vue SFC、脚本、模板和 LESS 检查通过；新增目录组件通过定向 `vue-tsc` 检查，搜索 hook 和类型通过 TypeScript 严格检查，中英文翻译键检查通过。
- 对比改动前代码，父组件原有请求、监听、选择、编辑与保存处理及非侧栏模板完全保留；宿主仅新增两项文案映射。`git diff --check` 通过。
- 在 `runtime-ui` 执行 `pnpm --config.verify-deps-before-run=false -F jetlinks-web-core build -- --module-name jetlinks-ai-ui`，构建通过（9494 个模块），耗时 35.35 秒。构建有 Node 版本低于声明版本、浏览器基线数据过期、CSS 注释格式及产物体积警告。
- 搜索异常修复时，经用户授权在当前浏览器页面复现输入 `a` 后的 `getTreeNodeProps` 异常；修复后输入 `a`、输入无匹配的 `a目标`、点击清空恢复目录均通过，无新增控制台错误。定向 `vue-tsc` 与 LESS 检查通过。没有新增或修改单元测试，本次小修不重复执行全量构建；上述构建结果来自目录初次实现。
- 搜索期间架构切换、清空后恢复折叠状态仍待进一步人工验证。未执行全量类型检查，待执行命令为 `node node_modules/vue-tsc/bin/vue-tsc.js --noEmit -p jetlinks-web-core/tsconfig.json`。模块没有单独的 lint 脚本。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `model` | 模型上下文 | `ModelConfigModel` | - |
| `files` | 文件列表 | `ModelFile[]` | [] |
| `filesLoading` | 文件加载态 | `boolean` | false |
| `availableFormats` | 可用格式 | `FormatDetail[]` | [] |
| `showAddFile` | 显示新增文件 | `boolean` | true |
| `showManifest` | 显示 manifest | `boolean` | true |
| `extraConfigTabs` | 扩展配置页签 | `array` | [] |
| `batchUploadOwners` | 批量上传归属 | `array` | [] |

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

- 文件类型见 `modelFileDirectory.ts`，格式和 manifest 契约见 `index.vue`。
- 批量上传与新增文件请求通过 props 回调接入，组件不固定业务 API。
- 在 `models` 模型文件目录单文件上传时，文件名输入框默认只回填上传文件首个 `.` 前的内容，替换文件会同步更新自动回填的名称；若用户已手动修改文件名，后续选文件不再覆盖。后续由业务类型、算法模型和模型格式字段拼接模型文件后缀。
