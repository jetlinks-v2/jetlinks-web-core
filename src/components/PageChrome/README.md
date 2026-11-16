# PageChrome

页面头部容器：把返回按钮、卡片切换（`SlantedTabs`）、页签等内容送到**布局壳层预留的、`ContentPanel` 之外**的插槽位。

**只在"头部必须落在面板之外"的页面才需要用**。布局壳层默认已经给每个页面套了 `ContentPanel`，
普通页面不需要改动；只有这类头部位置特殊的页面才需要把那段内容包进 `PageChrome`。

```vue
<template>
  <PageChrome>
    <SlantedTabs :activeKey="activeType" :options="tabs" @change="changeType" />
  </PageChrome>

  <ContentPanel>...</ContentPanel>
</template>
```

参考实现：`modules/device-manager-ui/views/device/list/components/IotDeviceDetailView.vue` 的返回按钮。

## 统一返回入口

详情返回使用 `PageBack`，放在摘要卡片上方的独立 `PageChrome` 中。`PageBack` 提供左箭头、文字及统一 hover/focus 样式；必填 `label: string` 由页面提供翻译，点击发出无参数 `back` 事件，由页面执行原返回逻辑。组件不读路由、Store 或接口。通过 `@jetlinks-web-core/components` 具名导出并全局注册，也可从 `@jetlinks-web-core/components/PageBack/index.vue` 单独导入。

```vue
<PageChrome>
  <PageBack :label="$t('Product.detail.backToList')" @back="backToProductList" />
</PageChrome>
<PageChrome flush>
  <ContentPanel><!-- 对象摘要 --></ContentPanel>
  <SlantedTabs :active-key="activeTab" :options="tabs" @change="changeTab" />
</PageChrome>
```

设备、网关、产品、业务应用、开放平台应用和接口分组详情共用该模式。旧页面的 `DetailHeader showBack` 保持兼容，接口分组新增表单继续沿用原头部。

## 为什么用 `Teleport`

`BasicLayoutShell` / `ApplicationLayoutPage` 是页面的祖先，页面模板无法直接填充祖先的具名插槽。
`PageChrome` 用 `Teleport` 把内容送进壳层的插槽位，而不是把渲染函数注册到壳层，原因是：

- 保留页面自身的 `provide`/`inject` 上下文；
- 保留页面与头部子组件的 scoped 样式；
- 生命周期仍挂在页面组件上，随页面一起卸载。

## 兜底行为

目标元素由 `RouteContentSurface` 通过 `provide` 下发，页面在 `onMounted` 读取（壳层的模板 ref 走 post-render 队列，挂载期读不到）。

- 拿不到目标（例如页面被放在 `BlankLayoutPage`、全屏页或微应用宿主下）：`Teleport` 保持 `disabled`，内容**原地渲染**，不会丢内容。
- 页面也无需判断环境，写一次即可。

## 属性与插槽

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `flush` | `boolean` | `false` | `true` 时头部与布局面板**贴合**：壳层闭合两者间距，并把面板左上角拉平。 |
| 默认插槽 | `slot` | - | 需要落在面板外的页面头部内容。 |

组件自身不接收业务属性；宽度由壳层内容区承担。

`FullPage` 位于同一个布局壳层时会观察该头部容器的尺寸；异步出现或消失的页签会触发可用高度重新计算，避免空页面多出外层滚动条。没有提供头部容器的页面继续使用原有高度计算。`node --test src/layout/FullPage.test.mjs` 覆盖头部出现、消失、重复事件合并、卸载清理及无头部场景。

### 什么时候用 `flush`

| 头部形态 | 写法 | 效果 |
| --- | --- | --- |
| 页签/卡片切换充当**面板顶栏**（`SlantedTabs`） | `<PageChrome flush>` | 与面板连成一体，复刻"页签贴在面板顶上"的既有视觉 |
| 返回按钮、独立操作条 | `<PageChrome>` | 与面板之间保留壳层默认间距；自身可再加 `margin-bottom` |

`flush` 由壳层用 `:has(> .route-content-surface__chrome > .page-chrome--flush)` 纯 CSS 判定，
不引入任何跨路由的组件状态。运营端个人中心由业务入口提供直属 `ContentPanel`；
分组导航壳层通过 `:deep(.content-panel)` 匹配该子组件根节点，避免 scoped 样式要求面板携带壳层的 scope 属性而失效。
只有贴合头部存在时取消面板左上圆角，其余圆角保留；切回其他入口后恢复默认圆角。

验证：BasicLayoutShell.less 定向 Less/scoped 编译、check:ui-style 和差异空白检查通过；localhost:9100 登录页面已核对通知与公告页签的连续衔接，以及切回基本信息后默认圆角恢复。本次仅改样式，未运行全量类型检查或构建，无后端重启要求。

参考实现：
- 贴合式 —— `modules/device-manager-ui/views/device/list/unified/index.vue` 的 `SlantedTabs`
- 独立式 —— `modules/device-manager-ui/views/device/list/components/IotDeviceDetailView.vue` 的返回按钮

## 相关契约

布局壳层**默认**已经给每个路由页面套了 `ContentPanel`；是否包裹由所属模块的
`getContentPanelOverrides()` 声明决定，**不要**在页面里判断或干预。
页内原有的 `ContentPanel` 需要逐页删除，删掉后由布局面板接管。

完整契约、页面迁移清单与风险见
[`docs/页面内容面板与页面头部插槽.md`](../../docs/页面内容面板与页面头部插槽.md)。
