# FullCalendar 使用说明

系统日历组件，按月加载事件并支持选择日期或快速重置。

#### Props

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `selectable` | 是否允许选择 | `boolean \| string` | false |
| `preview` | 预览模式 | `boolean` | false |

#### 事件

| 事件 | 说明 | 回调参数 |
| --- | --- | --- |
| `selectDate` | 选择日期或日期范围 | `(value)` |
| `resetRapid` | 重置快速选择 | `()` |

#### 用法

~~~vue
<FullCalendar selectable @select-date="onSelectDate" />
~~~

#### Rules

- `/system/ps/calendar` 的“确认”按钮使用既有 `system/Calendar:add`（新增）权限，由 `j-permission-button` 在无权限时置灰并阻止点击；保留 `selectable` 禁用条件及原保存事件，不新增菜单权限或修改接口。
- 事件数据来自系统日历接口，页面不直接修改内部缓存。
- preview=true 时隐藏编辑动作，只用于查看。

“确认”权限验证：组件脚本/模板编译、权限码与原禁用/点击绑定核验通过；`authentication-manager-ui/tests/systemButtonPermissions.test.mjs` 3 项回归通过。在 `runtime-ui/` 执行 `pnpm --config.verify-deps-before-run=false build:modules authentication-manager-ui` 构建通过（42.20 秒）；执行 `pnpm --config.verify-deps-before-run=false exec vue-tsc --noEmit -p modules/authentication-manager-ui/tsconfig.json --pretty false`，修改前后均为 538 条既有诊断，内容无新增，完整类型检查仍未通过。未配置独立 lint，差异空白检查通过；真实账号授权及保存请求待环境验收。
