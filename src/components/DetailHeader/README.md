# DetailHeader 使用说明

详情页标题、返回入口与操作布局。默认样式兼容现有页面；摘要模式由外层 `ContentPanel` 提供卡片背景与圆角。

## 运行时详情摘要统一

六类详情统一保留 56px 对象图标、20px 名称、14px 元信息。名称/状态/类型下方的 ID、时间、说明等语义字段排列在同一行，空间不足时自动换行；设备标签通过 `extra` 独立一行。操作区占名称行右侧，元信息使用图标右侧的完整宽度；窄容器时操作区换至摘要下方，不依赖窗口宽度。说明编辑继续保留自动保存与失败重试。长名称省略并保留完整提示，长模板标签限制宽度；状态由页面提供文案和判断，并使用 `StatusTag` 展示。

接入范围：`device-manager-ui` 的设备/产品、`edge-master-ui` 的网关、`authentication-manager-ui` 的业务应用/开放平台/接口分组。共享 [DetailMetaItem](../DetailMetaItem/README.md) 维护 ID、时间、产品等字段图标。页面负责权限、复制、链接与自动保存，展示组件不访问接口或业务 Store。

返回入口统一放在摘要卡片上方的独立 `PageChrome` 中，采用设备详情的左箭头加“返回对应列表”文字。复用 [PageBack](../PageChrome/README.md#统一返回入口) 统一按钮样式，页面继续提供原返回回调；摘要内部不再放返回按钮。接口分组无 ID 的新增表单沿用原头部。

主导航采用 `PageChrome flush` 与 `SlantedTabs`。产品继续通过物模型离开确认后修改路由；业务应用面板首次访问挂载、切换保留实例，应用 ID 改变时清理；开放平台保留条件卸载和凭据清理。接口分组仅调整已有 ID 的详情，不增加主导航；创建表单、正文及内部切换控件沿用原行为。后端接口、数据结构和菜单路由无变更。

## Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `title` | 标题；摘要模式同时用于完整名称提示 | `string` | 必填 |
| `variant` | 默认头部或透明摘要布局 | `'default' \| 'summary'` | `default` |
| `compact` | 摘要采用名称/动作与元信息两行；附加内容放入浮层。窄区操作图标化、元信息在本行横向浏览 | `boolean` | `false` |
| `extraLabel` | 紧凑摘要中附加内容触发按钮的名称，例如设备标签 | `string` | i18n“更多信息” |
| `extraKind` | 附加内容入口的语义图标，复用 `DetailMetaItem` 图标表 | `DetailMetaKind` | 更多图标 |
| `metaLabel` | 带身份次行的紧凑摘要中，关联资料入口的名称 | `string` | i18n“更多信息” |
| `metaTitle` | 收纳浮层的标题；可与简短入口文案区分 | `string` | 沿用metaLabel或i18n“更多信息” |
| `metaEditable` | 身份布局中显示基本信息编辑图标；宽区位于元信息行，收纳后位于分区标题旁 | `boolean` | `false` |
| `metaEditDisabled` | 禁用基本信息编辑入口 | `boolean` | `false` |
| `resourceType` | 名称旁的只读语义图标及完整类型提示，独立于可编辑主图片 | `{ icon: string; label: string }` | 无 |
| `showBack` | 显示返回按钮 | `boolean` | `false` |
| `backTitle` | 返回按钮提示 | `string` | i18n 默认文案 |

## 插槽与事件

| 插槽 | 用途 |
| --- | --- |
| `title` | 可编辑名称等自定义标题 |
| `titleExtra` | `StatusTag`、设备类型或模板 `AppTag` |
| `description` | 独立补充说明或保存反馈；摘要模式位于元信息下方，普通说明字段放入 `meta` |
| `info` / 默认插槽 | 兼容已有附加信息 |
| `actions` | 原有页面操作及权限按钮 |
| `leading` | 摘要模式中的自定义前置内容；上述六类详情的返回入口放在卡片外 |
| `icon` | 摘要模式的对象图片或缺省图标 |
| `identifier` | 紧凑摘要的身份次行；提供时启用名称/状态/观测与身份/资料的两行布局 |
| `status` | 身份布局中紧邻名称的状态入口，其余摘要沿用右侧位置 |
| `observation` | 身份布局中的紧凑观测指标，空间不足时移到次行 |
| `context` | 身份布局中的只读上下文摘要；宽区在实时指标之后显示，容器不足1100px时收起，完整信息由宿主已有详情入口承载 |
| `auxiliary` | 身份布局中的附加内容；`inline` 为 true 时显示在窄区资料展开面板中，false 时位于身份次行 |
| `meta` | 摘要的语义字段；`expanded` 为 true 时位于资料浮层，可显示完整标签/值，false 时为行内摘要 |
| `extra` | 摘要模式的标签、展开与编辑入口 |

`back` 事件无参数：有监听时交给调用方，未监听时使用 `router.back()`。仅摘要模式渲染 `leading`、`icon`、`meta` 和 `extra`。

`editMeta` 事件无参数：通知宿主打开该分区的编辑能力，不读取业务数据或保存字段，保留原位上下文供取消后回到原入口。权限与异步状态由宿主通过 `metaEditable`、`metaEditDisabled` 控制，未启用的消费者保持原布局。

设备与网关详情显式启用 `compact`，其摘要与导航放在路由既有面板内，区域共用分割线；其余摘要调用方默认布局保留。长元信息仍保留原完整 tooltip、复制和链接；附加内容浮层不复制业务状态，页面继续拥有标签保存与权限。默认摘要与紧凑摘要均使用同一组插槽。

紧凑摘要按业务含义归组，由 `DetailMetaItem groupStart` 标记组间分割，组内字段只留间距。窄区保留32px对象图标供原位编辑，动作区显示图标；自定义标题插槽自行处理文本省略，头部保留其编辑控件和校验反馈。

带 `identifier` 的布局由公共具名网格统一分区：48px主图片对应名称与ID，状态和观测跟随名称，操作位于行末。容器不足820px时，同一组资料实例收进可关闭、支持Escape的浮层，保留字段草稿；640px以下主图片为40px，520px以下观测移到次行，400px以下主图片为32px且ID使用图片轨道余宽。极窄区完整ID由展开资料提供。资料浮层受头部容器宽度约束，宿主应允许浮层溢出并保持摘要高于正文。配合 `DetailMetaItem showLabel` 显示完整标签。`DetailIdentifier` 始终保持字符串值，只发出 `copy` 事件；复制图标为悬停/聚焦显露，触屏常驻，不因显隐改变文本宽度。未提供identifier的调用方继续使用原布局，公共组件不持有业务采样或请求。

未收纳资料时，meta与auxiliary在ID之后连续排列，ID保持既有宽度预算。第一行按身份、观测、上下文与操作建立阅读顺序；context紧随observation，使用共同网格组距，不在剩余空间中居中，也不持有业务采样。字段内部间距保持紧凑，长值在本组内收缩；`data-priority="secondary"`的次要字段在不足1100px时收起，展开资料中仍完整呈现。收纳后的浮层及窄区身份/观测轨道保持原布局。

身份布局的首行由identity-line统一分配宽度：观测和上下文按内容占位，名称在实际空间不足时收缩；不以两个独立可压缩网格列分摊名称和速率。外层网格负责图片、内容、动作，次行字段不参与首行内部宽度分配。520px以下identity-line退为display:contents，沿原具名轨道重排。验收同时检查可见指标是否发生省略与页面是否溢出。

`DetailIdentifier.after`可在ID后提供独立操作，使用原复制图标预留位置，不叠加一份图标宽度；复制仍由ID文字按钮触发，追加操作是其兄弟节点。未提供after时保留原复制图标和行为。更多信息入口以文字和展开箭头表达，窄区使用带完整提示的省略号，保持原24px轨道；弹层标题可通过metaTitle指定，不挤占ID或观测字段。

```vue
<ContentPanel fill>
  <DetailHeader variant="summary" :title="device.name">
    <template #icon><AIcon type="DesktopOutlined" /></template>
    <template #titleExtra><StatusTag :status="statusTone" :text="statusText" /></template>
    <template #meta>
      <DetailMetaItem kind="id" :label="$t('device.id')" :tooltip="$t('DetailMetaItem.copyTooltip', { id: device.id })">
        <a-typography-text :copyable="{ text: device.id, tooltip: false }"><span>{{ device.id }}</span></a-typography-text>
      </DetailMetaItem>
    </template>
    <template #actions><a-button @click="edit">{{ $t('comm.edit') }}</a-button></template>
  </DetailHeader>
</ContentPanel>
```

## 验证与限制

摘要同行调整验证：头部/语义字段/页签 21 项测试、严格组件类型检查、5 个改动样式文件门禁和认证模块构建通过。真实组件配合模拟数据检查中英文、正常/长说明/缺失字段及 1920/1280/768/390/320px 共 180 组布局：宽屏和 1280px 的普通说明与 ID、时间同行，窄屏自动换行，设备标签始终独立；六类头部长名称、长模板与按钮权限等既有浏览器检查通过。名称/说明自动保存失败保留草稿和重试仍通过。真实登录环境尚未验收。

返回入口调整后复核：下列 67 项测试、包含 `PageBack` 的严格组件类型检查、10 个改动样式文件门禁及三个模块联合构建通过。浏览器使用真实页面与模拟数据，在原地渲染和 PageChrome 头部传送两种模式下，完成中英文、1920/1280/390/320px 的 48 组返回位置与原目标检查；卡片内部无重复返回按钮，缺失详情仍能返回，接口分组新增分支保持原头部。该验证不替代真实登录环境验收。

2026-11-12：core 头部/语义字段与既有页签测试 21 项通过，严格组件类型检查通过；设备相关 20 项、认证相关 24 项、网关复制/深链 2 项通过。变更样式门禁检查 14 个文件通过。命令分别为：

- core：`node --test tests/detailSummary.test.mjs tests/slantedTabsOverflow.test.mjs`；`pnpm exec vue-tsc --noEmit -p tests/tsconfig.detail-summary.json`。
- 设备：`node --test tests/deviceDetailHeaderActions.test.mjs tests/productDetailDeviceCount.test.mjs tests/deviceDetailTabs.test.mjs tests/deviceDetailPermissions.test.mjs tests/productDetailNavigation.test.mjs`。
- 认证：`node --test tests/applicationDetailTabs.test.mjs tests/projectApplicationCredentialSync.test.mjs tests/projectApplicationExternalAccess.test.mjs`。
- 网关：`node --test tests/gatewayDetailClipboard.test.mjs tests/gatewayVisionDetailTab.test.mjs`。
- runtime 根目录：`node ../ui/scripts/check-ui-style.mjs --files <变更样式文件>`（runtime 未配置独立 lint 脚本）。

浏览器使用真实组件与受控业务数据验证 1920/1280/768/390px，以及 320px 长英文按钮：无横向溢出；覆盖长名称/模板/说明、缺失字段、网关图片失败回退、完整字符串 ID 复制、链接禁用/按钮权限、设备标签展开/编辑及页签溢出菜单/滚轮/键盘。真实页面和保存 hook 配合模拟接口验证名称与说明自动保存失败保留草稿、重试成功、接口分组新增表单保持原样，以及业务应用切卡后面板实例和草稿保留。产品切卡测试验证确认回调执行前不改路由。

设备和认证模块分别生产构建通过；网关单独构建因模块过滤器排除其依赖的认证 `runtimeMonitor` 导出而失败。三个模块联合构建通过：在 runtime 根目录执行 `pnpm -F jetlinks-web-core build --outDir /tmp/jetlinks-detail-summary/build-combined -- --module-name device-manager-ui,edge-master-ui,authentication-manager-ui`。完整页面类型检查仍被依赖文件诊断阻断（例如 core `src/api/account/center.ts` 的 TS2347）；改动页面、hook 与组件未报告类型诊断。可用各模块 `tsconfig.json` 复核全模块类型检查。

独立浏览器访问本地服务会跳转登录页，未使用真实账号执行六个指定 ID 的后端操作；登录后的权限组合、真实数据与凭据清理仍需联调验收。

- 监听 back 时由调用方接管返回；未监听时组件调用 router.back()。
- actions、description 等插槽用于承载页面级操作和摘要。
- 标题区与动作区按实际可用空间自然换行，不按浏览器宽度提前堆叠。宽度充足时动作位于标题旁；窄容器保留标题优先级，动作可换行且不会被裁掉。
