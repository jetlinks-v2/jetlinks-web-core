# DetailMetaItem

详情摘要中的“小图标 + 值”。语义图标集中维护在 `semantics.ts`，字段名称由调用方传入已翻译的 `label`，在图标 Tooltip 和屏幕阅读器文本中保留。组件不访问接口或 Store。

| 参数 | 类型 | 用途 |
| --- | --- | --- |
| `kind` | `DetailMetaKind` | 必填；选择语义图标 |
| `label` | `string` | 必填；字段名称和无障碍文本 |
| `value` | `string \| number` | 默认展示值；保留 `0` 和完整字符串 ID |
| `tooltip` | `string` | 值的完整提示，例如长空间路径 |
| `multiline` | `boolean` | 标签、说明、编辑框等需要换行时启用 |

默认插槽可以替换值，承载原有复制、链接、说明编辑和反馈。默认值区域省略长文本；多行模式自动换行。

ID 复制提示统一由值区域的一层 Tooltip 承载，使用 `$t('DetailMetaItem.copyTooltip', { id })` 显示“点击复制：完整 ID”。设备、产品、网关、业务应用、开放平台应用和接口分组均遵循此规则：按钮插槽不再嵌套复制 Tooltip；`a-typography-text` 使用 `:copyable="{ text: id, tooltip: false }"` 关闭自身提示，保留复制行为和成功图标。完整 ID 必须使用原始字符串，不截断或转换为数字。

复制提示验证：六类实际详情组件配合受控数据，完成中/英/日文、ID 文字与复制图标的 36 组悬浮检查，始终仅一条合并提示，复制后的成功状态无第二条提示；产品、业务应用、开放平台与接口分组的真实浏览器剪贴板值一致，设备与网关保持原回调，320px 下长 ID 复制无截断。core `node --test tests/detailSummary.test.mjs`、设备 `node --test tests/deviceDetailHeaderActions.test.mjs tests/productDetailDeviceCount.test.mjs`、网关 `node --test tests/gatewayDetailClipboard.test.mjs` 合计 7 项通过；六个页面样式门禁、三语言 JSON/占位符及四个 owning repository 的差异检查通过。在 `runtime-ui` 执行 `pnpm -F jetlinks-web-core build --outDir /tmp/jetlinks-id-copy-tooltip/build -- --module-name device-manager-ui,edge-master-ui,authentication-manager-ui`，联合构建通过（33.61 秒），仍有已有资源路径与大包告警。定向页面 `vue-tsc` 仍被依赖文件诊断阻断，六个修改页面无诊断；工作区无独立 lint 脚本，真实登录页面尚未复验。完整类型检查可分别执行 `pnpm exec vue-tsc --noEmit -p modules/<module>/tsconfig.json`。

摘要对齐规则：普通文字、ID 复制、行内链接及说明继承相同字体和行高，语义图标对齐首行中心。值插槽中的行内文字/链接按钮移除内边距、边框及内联基线占位，保留链接颜色、焦点及禁用行为；多行说明仍从首行开始对齐。设备标签内的编辑、展开按钮保持原尺寸。

对齐验证：真实组件配合受控数据，在 1920/1280/390/320px 下完成六类头部的 24 组测量，首行图标/值位置一致，同排文字位置偏差小于 0.5px，行内按钮的 padding/border 均为 0；产品链接点击和禁用检查通过。六类详情长字段/缺失字段/窄屏检查及改动文件样式门禁通过。本次仅修改样式，复用前轮类型与构建证据；真实登录页面尚未复验。

| kind | 语义 | 图标 |
| --- | --- | --- |
| `id` | 各类对象 ID | `NumberOutlined` |
| `time` | 创建时间、最后上报、在线时长 | `ClockCircleOutlined` |
| `product` | 所属产品 | `AppstoreOutlined` |
| `space` | 空间、区域 | `EnvironmentOutlined` |
| `group` | 业务分组 | `FolderOutlined` |
| `category` | 分类 | `ApartmentOutlined` |
| `count` | 设备数量 | `ClusterOutlined` |
| `brand` / `model` | 品牌 / 型号 | `BankOutlined` / `TagOutlined` |
| `tags` / `description` | 标签 / 说明 | `TagsOutlined` / `FileTextOutlined` |

`DetailMetaItem` 已全局注册并从 core components 根入口导出，`DetailMetaKind` 同时公开。复制 ID 时使用原始字符串，将 `a-typography-text` 的显示值包在 `<span>` 中，并通过 `copyable.text` 或 `content` 指定完整 ID，使文字可以省略、复制按钮保持可见。链接权限、禁用条件、请求、失败与重试由业务页面管理。

组合示例与验证入口见 [DetailHeader](../DetailHeader/README.md)。
