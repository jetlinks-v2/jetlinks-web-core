# 对象总览

复用对象来源的模型、数据和动作，在同一页展示数据及常用操作；可选择内容、拖动布局并保存个人视图。业务名称、单位、枚举和输入类型来自原模型，页面不向用户显示 Provider、Schema 等内部术语。

## 使用

```vue
<script setup lang="ts">
import { ObjectOverview } from '@jetlinks-web-core/components/ObjectOverview'
import type { ObjectViewStore } from '@jetlinks-web-core/components/ObjectOverview'
defineProps<{ store: ObjectViewStore }>()
</script>
<template>
  <ObjectOverview :object="{ type: 'device', id: 'existing-object-id' }" :store="store" />
</template>
```

`object` 为 `{ type, id, name? }`。`store` 由宿主注入，不传时只展示默认总览。`viewId` 可定位已保存视图；`active=false` 时停止展示操作面板。关闭承载前调用组件暴露的 `beforeLeave(): Promise<boolean>`，处理未保存草稿。

宿主补充内容放默认插槽；只与当前对象有关的轻量操作放 `actions` 插槽，跟随总览工具栏，不作为独立空白区块。

默认内容取各来源轮转的前 6 个属性及前 4 个显式动作；不自动执行查询能力。自定义时复用关系选择器，可以选择当前对象或沿关系找到的对象的属性、查询及动作。选择查询后按原输入模型配置参数。动态实例字段仅在实例模型明确声明时可选，不从同类型的其他实例猜测。

## 公共入口

| 入口 | 职责 |
| --- | --- |
| `ObjectOverview` | 单页承载、内容选择、布局、视图和草稿 |
| `ObjectDataView` | 数值/单位、布尔、枚举、日期、结构及有界集合；不发请求 |
| `ObjectReferenceDisplay` | 统一显示目标名称、类型图标和进入入口；仅发出 `open`，不请求或跳转 |
| `ObjectCapabilityPicker` | 原关系路径及来源成员选择，输出原持久 binding |
| `ObjectOperationPanel` | 输入、确认目标快照、执行、展示原回执 |
| `useObjectCapabilities` | 页面内模型发现及按来源批读；对象切换取消旧请求 |

纯布局变化不重复读取数据。属性请求按来源分组，每批最多 128 项；关系解析沿原 `ObjectSpec`，最多返回 20 个目标并标记截断。动作要求唯一目标，执行使用确认时的目标，不自动批量派发或重试。请求完成不代表设备或其他业务已生效。

来源在属性 `expands.reference` 声明 `{ targetType, relationId?, reverse?, labelProperty? }`。例如工单的 `project` 指向 `project` 类型，设备的 `productId` 指向 `product` 类型；字段名及 `modelId` 本身不暗示引用。`relationId` 只定位既有关系，不创建第二条图谱边。原字符串或数组继续供计算和筛选使用。

同来源的 `labelProperty` 是公开的名称快照；缺少名称时沿当前请求上下文批量查找目标，按类型去重、每批最多 128 个。引用字段最多读 20 项、首屏显示 3 项，其余就近展开；不把预览数当总数。缺失或读取失败保留标识并提示暂不可查看，不推断删除或越权。名称快照不保证目标仍可打开，进入后仍由目标来源读取。

`ObjectContentGroup` 和 `ObjectOverview` 将 `open({ type, id, name? })` 交给宿主处理，宿主沿原导航及离开保护进入对象；编辑布局时禁止进入。默认内容排除 identity 来源的 `semanticRole=identity` 以及引用的同来源名称字段，已有保存布局保持原样。`identifier` 业务编号及非身份来源的记录 ID 继续作为数据展示。

## 业务表现扩展

原 `moduleRegistry` 的 `objectPresentations` 可提供 `members`，按稳定的 `{providerId, kind, id}` 匹配，不按名称：

```ts
const presentation = {
  typeId: 'device',
  fields: [],
  members: [{
    ref: { providerId: 'device-data', kind: 'query', id: 'snapshots' },
    component: ObjectPropertySnapshots,
  }],
}
```

`component` 接收 `member/value/state`；动作可注册 `editor` 替换默认操作面板，接收 `member/binding/runtime`。数据由宿主 runtime 查询，业务组件只负责展示或交互；继续使用原来源命令执行权限及业务校验。渲染失败保留配置，并允许重试。

## 保存与复用

`ObjectViewStore` 提供 `list/get/create/save/delete/defaultView/setDefault`。保存完整 `DashboardValue` 和持久 binding，不保存业务查询结果或确认令牌。用户和部署作用域由存储服务确定。一个对象可以保存多个视图；另存为不覆盖原视图，默认引用独立存储。

编辑草稿不写正式 localStorage。保存失败保留草稿；本页面内切换对象会保留各自草稿，离开承载时由 `beforeLeave` 提示处理。业务操作在布局编辑时禁用。

能力加载、个人视图读取及保存失败分别反馈和重试；个人视图未读取成功前不允许保存，避免默认内容覆盖原配置。加载和失败时不挂载空仪表盘，正常浏览高度沿原网格计算，空内容保持紧凑；宿主提供的业务记录不因总览失败而隐藏。组件只展示来源的授权结果，不增加权限预检或特殊放行。

流程变量和指标字段消费者可复用 `ObjectCapabilityPicker` 的 binding 与原 `data-capability` runtime，不依赖总览组件或本体存储 API。当前未接入具体流程或指标页面。

本地实验入口沿用 `/data-capability/lab`；工作台的持久化适配位于 ontology-ui `api/objectViews.ts`。真实页面和写操作的验收状态见 [设计与验证记录](../../../docs/对象能力展示与交互设计.md)。
