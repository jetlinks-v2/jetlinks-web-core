# AutoTree

兼容 Ant Design Vue Tree 的自适应树组件。调用方只需把 `<a-tree>` / `</a-tree>` 替换为 `<AutoTree>` / `</AutoTree>`，原属性、事件、插槽、ref 和页面样式继续使用。

## 使用方式

通过 core 组件插件全局注册，也可按需导入：

```vue
<script setup lang="ts">
import { AutoTree } from '@jetlinks-web-core/components'
</script>

<template>
  <AutoTree
    :tree-data="treeData"
    v-model:expandedKeys="expandedKeys"
    v-model:selectedKeys="selectedKeys"
    @select="handleSelect"
  >
    <template #title="node">{{ node.title }}</template>
  </AutoTree>
</template>
```

## 兼容与高度契约

- 直接复用当前 Ant Tree 的完整运行时 props 定义及默认值，转发所有事件和插槽；公开类型为同版本 Tree 类型。支持 `fieldNames`、勾选、多选、拖拽、懒加载、默认值与各类 `v-model`，以及原实例的 `scrollTo`、`treeRef` 和 keys 读取。
- 不添加 DOM 包装层，不改祖先样式；`class`、`style`、`aria-*` 保留 Ant Tree 原有的 DOM 落点，原 CSS 选择器继续生效。
- 未传 `height`（或为 `undefined` / `null`）时，根据当前容器边界、后续同列区块、padding / margin 与可视区域计算正数高度，随相关容器和窗口变化更新。首次测量前使用最小正高度，避免万级节点短暂全量挂载；隐藏时保留最后有效高度，重新显示后补测。
- 显式 `height` 和 `virtual` 保持 Ant Tree 原语义；`virtual` 未指定时继续继承 ConfigProvider 与 Tree 的默认行为。不新增 `fit`、`variant` 或页面必须填写的尺寸参数。
- 无请求、路由、Store 或持久化副作用。DOM 监听随组件销毁释放，KeepAlive 恢复后重新测量。
- Ant Design Vue 4.2.6 在 pending `Suspense` 中可能漏绑虚拟列表滚轮。运行时工作区通过 `patches/ant-design-vue@4.2.6.patch` 和 pnpm `patchedDependencies` 将事件绑定改为同步追踪视口 ref 的 post effect；重新安装依赖时自动应用。升级 Ant 后需先运行首次异步挂载与刷新回归，确认上游已修复再移除补丁。
- DirectoryTree 后续单独验证；`AutoTree.DirectoryTree` 仅保留 Ant 原静态成员，不宣称该成员已增加自动高度。

首次业务接入：`modules/jetlinks-space-ui/views/space/AreaManagement/components/AreaTreePanel.vue`。设计与验证记录见聚合仓库 `docs/plans/runtime-tree-virtual-scroll.md`。

## 验证

在 `jetlinks-web-core` 目录执行 `pnpm run test:auto-tree` 检查全量属性、事件、插槽、实例接口与类型兼容；执行 `pnpm run test:auto-tree-browser` 检查真实 Ant Tree 的万级数据、容器高度、选择/勾选/懒加载，以及真实设备布局中首次异步挂载、刷新、数据回填、筛选清空和切页返回的鼠标滚轮。另覆盖 `virtual=false` 的原生滚动及 Select 共用虚拟列表的滚动与选择。浏览器检查使用本机 Chrome/Chromium，非标准路径通过 `AUTO_TREE_CHROME` 指定。

高度测量依赖当前 Ant 4.x 的 TreeContext Fragment 和列表 DOM 结构；升级 Ant 时需一并运行浏览器回归。测量时在同一帧内临时收缩并恢复原列表视口，避免自然流布局依赖上一次树高；树内部滚动不触发该测量。
