# 模板指令

指令插件由 `src/main.ts` 在 Pinia 安装后统一安装。

## `v-has-menu`

根据 `useMenuStore().hasMenu(code)` 决定是否创建模板子树，用于按钮、组件及分组的菜单可见性。接受单个字符串，支持字面量或响应式表达式，无需在页面导入 Store。

```vue
<DevicePanel v-has-menu="'device/Instance'" />
<DevicePanel v-has-menu="menuCode" v-if="ready" />
<template v-has-menu="'device/Product'">
  <ProductSummary />
  <ProductActions />
</template>
```

这是**编译期结构指令**：`configs/plugin/has-menu` 在 Vue 编译前将其转换为 `v-if="$hasMenu(...)"`；`src/directive/hasMenu.ts` 安装 `$hasMenu` 并绑定当前应用的 Pinia，不注册普通 DOM 指令。开发、整站和模块构建共用此转换。

- 菜单不存在时不创建组件、不执行 `setup` 或挂载钩子；菜单新增后挂载，移除后卸载，再次新增会创建新实例。静态导入的模块顶层代码仍会执行。
- 菜单 Map 和绑定 code 的变化会触发渲染更新。沿用 Store 当前菜单状态，不另行请求或改变加载、失败处理策略。空字符串及运行时非字符串值返回 `false`。
- 同节点的 `v-if` 与菜单条件按 AND 合并，先判断原有 `v-if`。
- 不支持数组、参数、修饰符；不支持与 `v-for`、`v-else`、`v-else-if`、`v-slot` 同节点使用，这些用法会报编译错误。变量形式的数组由模板类型检查拒绝，绕过类型检查时按无菜单处理。
- 循环时把指令放在循环内部；插槽时放在插槽内容内部；条件分支时使用内部 `<template v-has-menu="menuCode">`，保持分支节点相邻。
- 仅支持本 Vite 管线编译的内联 HTML Vue SFC 模板，不支持运行时模板、JSX、外部模板、预处理模板或已编译的依赖。不要在菜单控制子树上使用 `v-once` 或未包含菜单状态的 `v-memo` 缓存。
- 可作用于普通元素、多根组件和普通 `<template>` 分组；不承担接口鉴权。

原有 `menuStore.hasMenu(code)` 继续用于业务逻辑。本能力尚未批量替换现有业务页面。

验证命令：仓库根目录执行 `pnpm -F jetlinks-web-core test:has-menu`，覆盖模板编译、真实菜单 Runtime 的组件生命周期、Vite 开发及生产编译、严格类型检查（含数组绑定反例）。
