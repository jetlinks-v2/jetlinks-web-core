# DocumentHelp 文档帮助入口

## 平台管理的帮助说明

旧文档站关键词及标签搜索已移除；组件保留平台 `code/helpKey` 配置读取、纯说明、静态文章及内容插槽。

清理验证：`node --test tests/documentHelp.test.mjs` 11 项通过，覆盖静态说明、链接、插槽、点位注册、配置读取、取消与错误重试；auth `tests/documentCenter.test.mjs` 9 项通过。旧搜索请求及 hook 无残留引用，三语 JSON 与差异空白检查通过。模块构建 `pnpm -F jetlinks-web-core build -- --module-name authentication-manager-ui` 通过；`pnpm exec vue-tsc --noEmit -p modules/authentication-manager-ui/tsconfig.json --pretty false` 仍有 577 项工作区诊断，修改的帮助组件及 API 无诊断。未配置独立 lint 脚本；服务未重启，真实页面待部署后复验。

当前改造：业务模块启动时注册 `{ code, key, name, page }` 点位，文档管理通过注册表列出未打开页面的埋点；`name/page` 可使用函数读取当前语言。页面使用 `<DocumentHelp code="project/Overview" help-key="quickGuide.device" />`，挂载或切换点位时预加载既有 `GET /system/config/document-help` 返回的配置 Map，按 code/key 匹配 `{ code, key, content, enabled, i18nMessages? }`，只有当前语言解析后的说明非空且启用才显示问号。未配置或禁用不渲染业务入口，但注册表始终保留点位供管理扫描。说明以 Markdown 保存并在原帮助气泡展示，链接直接写在说明内，不再额外配置文档地址。管理列表和持久化由 auth 模块提供。

管理保存成功后调用 `hooks/useConfiguredDocumentHelp.ts` 的 `notifyDocumentHelpConfigurationChanged()`，刷新已挂载的帮助；KeepAlive 页面返回时重新读取，首次激活不重复请求。请求失败隐藏业务入口，后续保存通知、页面重进或刷新可重试。悬停和关闭不清空已准备正文，MarkdownPreview 静态引入，避免首次打开时下载组件及加载短文案引起弹层高度跳动；保留 Ant Design Vue 原有动效。静态说明和管理 `#content` 草稿预览不受 enabled 限制。

实现范围：`utils/documentHelpRegistry.ts`、`hooks/useConfiguredDocumentHelp.ts`、`api/document.ts` 和本组件。预览共用 `MarkdownPreview.vue`，HTML 经 `utils/documentHelpMarkdown.ts` 清洗，链接保留蓝色且在新窗口打开；管理编辑器通过新增可选 `sanitize` 属性使用同一清洗函数。`description/document/#content` 保持兼容，显式内容插槽优先。

### 中文、英文与日文正文

配置沿用平台多语言字段结构 `i18nMessages.content.{zh,en,ja}`，顶层 `content` 保留为默认正文。`utils/documentHelpContent.ts` 的 `resolveDocumentHelpContent(configuration, locale)` 先取当前 locale 的翻译，再取主语言（例如 `zh-CN/zh_CN` 对应 `zh`），空白或缺译时只回退默认正文；不跨语言选取其他翻译，不推定旧正文的语言。Markdown 原文保持不变，渲染时继续净化 HTML。

`useConfiguredDocumentHelp` 根据界面语言解析已加载配置，语言变化直接切换缓存正文，不重复请求。只有其他语言有内容时，该点位仍属于已配置，但当前语言缺译且默认正文为空时不显示业务帮助入口。`hasDocumentHelpContent(configuration)` 统一检查默认正文和所有翻译，供管理列表、保存和批量启禁判定配置状态；启禁仍按点位统一控制。两个纯函数均从 `@jetlinks-web-core/utils` 导出，亦可使用 `@jetlinks-web-core/utils/documentHelpContent`。

三语回归：`node --test tests/documentHelp.test.mjs` 16 项、认证文档管理/概览/文档中心 38 项通过，覆盖三语及区域 locale、缺译回退、仅有翻译的配置、语言切换不重复请求、禁用翻译与保存刷新，并保留原静态说明、预加载、竞态与 KeepAlive 回归。认证模块目标生产构建通过（34.26 秒）；认证及关联 core 类型检查仍有 543 项工作区诊断，本次帮助边界无诊断。通用系统配置支持嵌套 Map 的结论已通过本地 2.20 依赖源码核实；真实浏览器及部署服务保存回读仍待验收，保持 Draft。


目标：功能标题或字段旁显示问号，悬停、聚焦或点击后显示说明气泡。配置文章时展示“帮助文档”链接，通过公共打开命令交给 auth 顶栏文档浮窗；未配置时只展示说明。支持自定义图标、颜色及内容插槽中的内联文档链接。复用 Ant Design Vue Popover/Button 与当前主题，不额外创建 iframe。

实现入口：`src/components/DocumentHelp/index.vue` 负责展示，`src/hooks/useDocumentHelp.ts` 管理气泡状态与跨模块打开指令。组件全局注册并从 `@jetlinks-web-core/components` 具名导出，亦可按需导入 `@jetlinks-web-core/components/DocumentHelp`。

```vue
<template>
  <span>
    设备接入
    <DocumentHelp
      :description="t('device.access.help')"
      document="/doc/device-access"
    />
  </span>
</template>
```

`/doc/device-access` 为接入语法示例，需换成文档站实际文章路径。`document` 可传当前配置文档中心内的完整文章 URL 或 `/doc/{文章标识}`；相对路径按当前文档中心解析，不能传其他分享中心或可执行地址。描述文本由业务调用方使用自身 i18n 文案。

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `code` / `helpKey` | `string`，可选 | 平台配置的路由编码与埋点 key；两项齐备时加载平台配置的 Markdown |
| `description` | `string`，可选 | 功能说明纯文本 |
| `document` | `string`，可选 | 文章路径或同中心完整 URL；未配置或空白时不显示公共链接 |
| `icon` | `string`，可选 | AIcon 图标名称，默认 `QuestionCircleOutlined` |
| `iconColor` | `string`，可选 | CSS 颜色，可使用 `var(--主题变量)`；默认沿用次级文字颜色 |
| `width` | `number \| string`，可选 | 内容宽度，默认 320px，受视口宽度约束 |
| `placement` | Ant Design Vue Popover placement，可选 | 默认 `top` |

交互：鼠标移入气泡后仍可点击链接；问号可用 Tab 聚焦，链接使用按钮原生键盘行为。Esc 关闭气泡。点击问号或链接不会触发父级卡片/行点击；打开文章后气泡关闭。未配置文章时不显示公共链接或底部分隔区，说明仍可查看。组件只发出打开意图，实际地址校验、`embed=1` 与语言参数、浮窗生命周期由 auth 承接。

使用条件：运行时已加载 auth 文档中心浮窗；本组件不在缺少接收方时另开浏览器窗口。代码调用同一能力可用 `openDocument`，从 `@jetlinks-web-core/hooks` 或按需路径 `@jetlinks-web-core/hooks/useDocumentHelp` 导入。

验证计划：编译真实 Vue SFC，验证气泡触发属性、描述/链接渲染、点击关闭并发出文章指令、键盘关闭、语言变化及重复打开；主任务统一进行构建与浏览器外观验证。


## 自定义说明与触发内容

默认插槽替换问号按钮的内容，以蓝色链接样式展示，保留可聚焦按钮及气泡触发；`#content` 可放比较表、列表或说明，配置 `document` 时“帮助文档”链接单独显示在底部。内容最大高度为 `min(60vh, 28rem)`，超出可滚动；横向表格由内容区滚动，气泡宽度不超过视口；表格、表头和单元格字号继承气泡正文，表头保留加粗。

```vue
<DocumentHelp document="/doc/actual-article-id" :width="600">
  <span>接入方式说明 <AIcon type="QuestionCircleOutlined" /></span>
  <template #content>
    <p>根据现场连接方式选择接入入口。</p>
    <a-table :columns="columns" :data-source="accessMethods" :pagination="false" size="small" />
  </template>
</DocumentHelp>
```

表格数据与列定义由调用页面提供，组件不内置特定业务说明或表格。`document` 需替换为真实文章；不应在默认插槽内再嵌套按钮或链接。

## 纯说明、内联链接与图标

省略 `document` 即为纯说明。`description` 始终按纯文本渲染；富文本使用 `#content` 显式编写，不解析 HTML 字符串。

```vue
<DocumentHelp :description="t('device.access.help')" />
<DocumentHelp
  :description="t('device.access.help')"
  icon="InfoCircleOutlined"
  icon-color="var(--jet-theme-primary)"
/>
```

`#content` 暴露 `openDocument(path: string)` 与 `close()`。前者打开指定文章并关闭气泡，后者只关闭气泡；未配置 `document` 时仍可使用。文档路径为语法占位，外部链接也需替换为业务实际地址。

```vue
<DocumentHelp>
  <template #content="{ openDocument, close }">
    <p>
      接入前请阅读
      <a-button type="link" size="small" @click="openDocument('/doc/actual-article-id')">设备接入说明</a-button>。
    </p>
    <a href="https://example.com/help" target="_blank" rel="noopener noreferrer">外部参考资料</a>
    <a-button type="link" size="small" @click="close">关闭说明</a-button>
  </template>
</DocumentHelp>
```

外部链接由调用方显式声明，直接走浏览器链接行为；不传给平台文档浮窗。

## 表格字段说明

现有 `SubscriptionEventPicker.vue` 与 `Direct/GrantPanel.vue` 使用 Ant Design Vue 的 `#headerCell`；同一插槽可加入文档帮助组件：

```vue
<a-table :columns="columns" :data-source="rows">
  <template #headerCell="{ column }">
    <span>{{ column.title }}</span>
    <DocumentHelp
      v-if="column.key === 'accessMode'"
      :description="t('device.accessMode.help')"
      document="/doc/actual-article-id"
    />
  </template>
  <template #bodyCell="{ column, record }">
    <template v-if="column.key === 'accessMode'">
      {{ record.accessMode }}
      <DocumentHelp :description="record.helpDescription" :document="record.helpDocument" />
    </template>
  </template>
</a-table>
```

问号与气泡内容的点击、Enter、Space 不冒泡，避免触发父级表头排序或行操作；普通表头点击仍由原表格处理。`j-pro-table` 请根据当前页面实际支持的表头插槽或列渲染函数嵌入，不能假设它提供同名 `customTitle` 接口。

验证：`node --test tests/documentHelp.test.mjs` 6 项通过，使用实际 Vue SFC 与公共命令、真实 i18n 文案及自定义 renderer（Popover/Button 的 DOM 渲染由可观测替身代替）。覆盖触发属性、描述/链接、关闭与指令、键盘和点击冒泡隔离、自定义触发与表格插槽、宽度、语言切换、纯说明与重复打开、内联链接及关闭命令、自定义图标颜色。scoped LESS 编译与 `git diff --check` 通过。内置浏览器组件预览已验证真实 Ant Design Vue 的气泡、复杂内容、纯说明、自定义图标、蓝色文字入口和表头排序隔离；表格/表头/单元格/正文计算字号均为 14px。公共及内联文档链接已通过真实 auth 浮窗打开 33.76 文档站文章；预览使用系统配置替身，未将帮助入口批量部署到业务页面。auth 16 项相关回归通过；目标模块类型检查有 577 项既有诊断，本次组件/公共命令/浮窗文件无诊断。

最终蓝色文字入口及表格字号调整后的 auth 目标模块生产构建通过（38.04 秒），存在既有大 chunk 警告。无独立 lint 脚本；相关文件 diff 检查通过。


启用与预加载验证：`node --test tests/documentHelp.test.mjs` 13 项通过，覆盖启用且有内容才显示、禁用/空白/失败隐藏、管理草稿插槽独立预览、保存通知刷新、首次悬停不重新请求或清空正文、切换点位/卸载竞态，以及 KeepAlive 首次不重复查询、返回页面重新检查启用状态。原有静态说明、文章链接、键盘事件与图标行为回归通过。首次弹层视觉位置仍由主任务在实际浏览器验收。

点位注册可选 `location`（字符串或当前语言函数）描述同一路由下的新增、编辑、列表等实际位置；`page` 继续作为路由分组名称，配置身份仍只有 code/key。运行时弹窗无法仅凭路由自动区分，位置由组件调用方声明。

帮助气泡层级通过 Popover 的 zIndex 统一提升到 2147483647，避免被业务下拉菜单与弹窗遮挡。浏览器已确认网关批量菜单中说明完整显示，点击问号保留菜单且未执行同步。
