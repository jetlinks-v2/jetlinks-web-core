# CloudEmpty 使用说明

统一空态组件；列表/局部面板用 default，页面级空内容用 page。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `type` | 空态尺寸 | `default \| page` | default |
| `description` | 空态描述 | `string` | i18n 默认文案 |
| `search` | 当前集合已生效的用户搜索；不包含接口固定条件与输入草稿 | `boolean \| string \| readonly unknown[] \| null` | `false` |
| `searchName` | 搜索无结果时的业务对象名，应传入已翻译文案 | `string` | `''` |
| `style` | 外层样式 | `StyleValue` | - |
| `imageStyle` | 图片样式 | `Record<string, string \| number>` | 按 type 默认 |

#### 事件

- 无自定义事件。

#### 用法

~~~vue
<CloudEmpty type="page" description="暂无设备，请先创建设备" />
~~~

#### 搜索空态公共文案

搜索无结果统一使用 core 中英文词条 `components.CloudEmpty.searchEmpty`：中文“未找到匹配的{name}”，英文“No matching {name} found”。组件通过公共 Hook `useEmptyCreateState` 判断传入的 `search`，将 `searchName` 作为 `name` 参数；页面不必重复拼接搜索描述和控制新增显隐。

~~~vue
<CloudEmpty :search="submittedTerms" :search-name="$t('Product.index.660348-15')">
  <EmptyCreateButton />
</CloudEmpty>
~~~

`EmptyCreateButton` 表示复用的原新增入口，继续保留原处理器、权限、禁用、loading 和只读条件；可使用已有组件、父级 slot 或 `createReusableTemplate` 复用工具栏按钮。组件不判断集合是否为空，也不发起查询，只应放在页面原有的成功空态中。

- 无搜索时显示原 `description` / 描述插槽和默认插槽。
- 有搜索时，用公共搜索词条替换描述（包括描述插槽），隐藏默认插槽。
- 字符串会忽略两端空白，空数组表示无搜索；即时本地过滤可传当前关键词，点击搜索后才生效的页面需传已提交值。
- 未传 `search` 的存量调用保持原描述与插槽行为。

搜索只隐藏空态插槽中的新增，原工具栏新增保留。本次统一接入面向表格、卡片和主内容列表；侧栏恢复各页面原有新增位置与空态行为，不新增按钮或切换原入口。

验证入口：在 `jetlinks-web-core/` 执行 `node --test tests/emptyCreateState.test.mjs`，保留 5 项公共检查。测试编译实际组件并通过 Vue 渲染器验证描述插槽切换、搜索清空、中英文插值、空字符串与按钮复用，不替代登录后的真实页面验收。接入范围与实际验证结果见运行时前端根 `README.md` 的“空状态新增入口”。

#### Rules

- 新增业务空态优先使用 CloudEmpty，不直接引用 empty.svg/big-empty.svg。
- 无搜索时，description 插槽优先级高于 description prop；有搜索时统一显示搜索描述。
- 存量业务模板统一从 `a-empty` 迁移到全局注册的 `CloudEmpty`，保留条件、描述、插槽与尺寸设置，移除旧 `image` 属性及仅为其服务的依赖；组件内部保留 `a-empty` 作为渲染基础，避免递归调用。
- 验证结果：206 处业务空态完成迁移，151 个 Vue 文件通过 `vue/compiler-sfc` 脚本与模板编译；使用 `../ui/scripts/check-ui-style.mjs --files <迁移文件>` 的样式检查通过。相关日志、可视化对话、媒体诊断、空间回放及 AI 任务测试共 20 项通过；`modules/jetlinks-ai-ui/tests/edgeVideoPlayback.test.mjs`、`modules/jetlinks-ai-ui/tests/taskMonitor.test.mjs` 中既有 4 项失败，迁移前后失败项一致。
- `pnpm -F jetlinks-web-core typecheck:data-capability` 仍有 444 条既有类型错误，与迁移前内容对照无变化。待执行 `pnpm build` 及浏览器空态检查，重点复核图片尺寸与外层布局。独立 HTML 交互原型未注册 core 组件，保留其原有 `a-empty`。
