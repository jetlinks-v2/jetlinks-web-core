# CloudEmpty 使用说明

统一空态组件；列表/局部面板用 default，页面级空内容用 page。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `type` | 空态尺寸 | `default \| page` | default |
| `description` | 空态描述 | `string` | i18n 默认文案 |
| `style` | 外层样式 | `StyleValue` | - |
| `imageStyle` | 图片样式 | `Record<string, string \| number>` | 按 type 默认 |

#### 事件

- 无自定义事件。

#### 用法

~~~vue
<CloudEmpty type="page" description="暂无设备，请先创建设备" />
~~~

#### Rules

- 新增业务空态优先使用 CloudEmpty，不直接引用 empty.svg/big-empty.svg。
- description 插槽优先级高于 description prop。
- 存量业务模板统一从 `a-empty` 迁移到全局注册的 `CloudEmpty`，保留条件、描述、插槽与尺寸设置，移除旧 `image` 属性及仅为其服务的依赖；组件内部保留 `a-empty` 作为渲染基础，避免递归调用。
- 验证结果：206 处业务空态完成迁移，151 个 Vue 文件通过 `vue/compiler-sfc` 脚本与模板编译；使用 `../ui/scripts/check-ui-style.mjs --files <迁移文件>` 的样式检查通过。相关日志、可视化对话、媒体诊断、空间回放及 AI 任务测试共 20 项通过；`modules/jetlinks-ai-ui/tests/edgeVideoPlayback.test.mjs`、`modules/jetlinks-ai-ui/tests/taskMonitor.test.mjs` 中既有 4 项失败，迁移前后失败项一致。
- `pnpm -F jetlinks-web-core typecheck:data-capability` 仍有 444 条既有类型错误，与迁移前内容对照无变化。待执行 `pnpm build` 及浏览器空态检查，重点复核图片尺寸与外层布局。独立 HTML 交互原型未注册 core 组件，保留其原有 `a-empty`。
