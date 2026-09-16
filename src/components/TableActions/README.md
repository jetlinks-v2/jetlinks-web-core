# TableActions

表格行操作容器。将 `common` 子项留在行内，其余收起到省略号面板；支持文字、图标、权限按钮、开关和二次确认。组件只负责布局及局部交互，不请求接口、不读取权限码、不写业务状态。

## 导入与接口

```ts
import TableActions, { TableActionsItem } from '@jetlinks-web-core/components/TableActions'
import type { TableActionsItemProps, TableActionsItemSlotScope, TableActionsPlacement } from '@jetlinks-web-core/components/TableActions'
// 也可从 @jetlinks-web-core/components 具名导入上述组件和类型。
```

core 插件全局注册 `TableActions` 和 `TableActionsItem`。`TableActions.Item` 写法需要在脚本中导入 `TableActions`。

`TableActions` 无自定义 props，默认插槽仅接收 `TableActionsItem`，可通过 `template`、`v-if`、`v-for` 组合；不穿透业务包装组件寻找子项。

| 子项属性 | 类型 | 默认值 | 行为 |
| --- | --- | --- | --- |
| `common` | `boolean` | `false` | 常用项行内显示，不限制数量 |
| `closeOnClick` | `boolean` | `true` | 更多面板内点击后关闭；开关等连续交互应设为 false |

子项默认插槽提供 `placement: 'inline' \| 'more'` 和 `close(): void`。原始按钮的事件、权限、危险样式、Tooltip、loading 和确认配置保持由调用方管理。点击关闭不代表业务成功，异步成功后才关闭时设置 `closeOnClick=false`，在成功回调中调用 `close()`。

两组各自保留声明顺序；循环子项使用稳定的字符串或数字 `key`。常用标记变化会将子项移到另一组，此时内部临时状态可能重建，开关值和异步状态应由调用方维护。条件隐藏应写在 `TableActionsItem` 上，组件不推断其插槽内部是否为空。无权限按钮沿用 `j-permission-button` 的禁用提示，不自动隐藏；没有折叠项时不显示省略号，全部为空时不渲染容器。

## 菜单页接入示例

下面替换 `modules/authentication-manager-ui/views/system/Menu/index.vue` 的 action 插槽即可；这是文档示例，本次未修改该页面。沿用该页已有的权限码、翻译与命令：

```vue
<template #action="row">
  <TableActions>
    <TableActionsItem common>
      <j-permission-button
        type="link"
        :hasPermission="`${permission}:add`"
        :tooltip="{ title: $t('Menu.index.599742-1') }"
        @click="toDetails(row)"
      >
        <AIcon type="EditOutlined" />
      </j-permission-button>
    </TableActionsItem>
    <TableActionsItem>
      <j-permission-button
        type="link"
        :hasPermission="`${permission}:add`"
        :disabled="row.level >= 3"
        :tooltip="{ title: row.level >= 3 ? $t('Setting.index.113436-9') : $t('Menu.index.599742-2') }"
        @click="addChildren(row)"
      >
        {{ $t('Menu.index.599742-2') }}
      </j-permission-button>
    </TableActionsItem>
    <TableActionsItem common>
      <j-permission-button
        type="link"
        danger
        :hasPermission="`${permission}:delete`"
        :tooltip="{ title: $t('Menu.index.599742-3') }"
        :popConfirm="{
          title: $t('Menu.index.599742-4'),
          onConfirm: () => clickDel(row),
        }"
      >
        <AIcon type="DeleteOutlined" />
      </j-permission-button>
    </TableActionsItem>
  </TableActions>
</template>
```

## 两项外置、开关和其他操作折叠

下例的 `labels` 是调用方通过 i18n 生成的文案对象；状态、加载、错误反馈和命令由业务 hook 提供。无需在 TableActions 内定义任何请求。

```vue
<TableActions>
  <TableActions.Item common>
    <j-permission-button type="link" :hasPermission="canEdit" @click="edit">
      {{ labels.edit }}
    </j-permission-button>
  </TableActions.Item>
  <TableActions.Item common>
    <j-permission-button type="link" danger :hasPermission="canDelete" :popConfirm="deleteConfirm">
      {{ labels.remove }}
    </j-permission-button>
  </TableActions.Item>
  <TableActions.Item :closeOnClick="false">
    <a-flex align="center" justify="space-between" gap="large" style="width: 100%">
      <span>{{ labels.enabled }}</span>
      <a-switch :checked="enabled" :loading="saving" :disabled="!canEdit" @change="toggle" />
    </a-flex>
  </TableActions.Item>
  <TableActions.Item>
    <a-button type="text" @click.stop="copy">{{ labels.copy }}</a-button>
  </TableActions.Item>
  <TableActions.Item>
    <a-button type="text" @click="overwrite">{{ labels.overwrite }}</a-button>
  </TableActions.Item>
</TableActions>
```

需要随位置调整内容时使用 `<TableActionsItem v-slot="{ placement }">`，例如行内显示图标，更多面板显示完整文字。保持一份按钮及事件绑定，只切换按钮内容。

## 确认、关闭与键盘

- 普通点击默认关闭，包括按钮上的 `@click.stop`；`event.preventDefault()` 可取消本次自动关闭。禁用、`aria-disabled`、`aria-busy`、Ant Button/Switch loading 控件不会执行点击或关闭面板。
- `j-permission-button` 当前通过独立确认框承载 `popConfirm`，默认关闭面板不会取消确认。内嵌 `a-popconfirm` 或需要保留面板的确认交互，应设 `closeOnClick=false`，在成功回调调用插槽 `close()`，取消时不调用。
- 自动关闭只是隐藏面板，不在关闭时销毁内容，避免中断内嵌控件和异步确认。浮层挂载在当前文档 body，避免固定列及滚动容器裁切。
- 点击省略号、Enter 或 Space 展开；ArrowDown 展开并聚焦首个可用控件。展开后从触发按钮按 Tab 进入面板，面板末项 Tab 离开；Shift+Tab 返回触发按钮；Escape 关闭并归还面板内焦点。点击外部关闭。
- 操作区及面板阻止 click、dblclick、keydown 冒泡到表格行；业务交互仍由原控件处理。面板使用分组语义，保留按钮、开关各自的键盘语义。

## 验证

运行 `pnpm exec vue-tsc -p jetlinks-web-core/tsconfig.table-actions.json --noEmit` 检查组件及模板类型。`node jetlinks-web-core/scripts/test-table-actions.mjs` 验证分组；`node jetlinks-web-core/scripts/preview-table-actions.mjs` 启动独立浏览器夹具，覆盖按钮、开关、权限、确认、键盘、动态插槽及固定列场景，不依赖登录或后端。

浏览器夹具地址为 `http://127.0.0.1:5187/`。`tests/tableActions/browser.mjs` 是接收 Playwright `page` 的异步函数表达式，可以通过 Playwright MCP 的 `browser_run_code_unsafe` 的 `filename` 参数运行；包含 12 组真实交互断言。夹具复用仓库的 `vite-env.d.ts` 声明来加载当前未提供类型声明的共享权限按钮；TableActions 自身及其插槽使用严格 TypeScript 类型。
