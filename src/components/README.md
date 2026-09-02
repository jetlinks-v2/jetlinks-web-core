# @jetlinks-web-core/components 组件映射

本文件是 `@jetlinks-web-core/components` 的 AI 导航入口。先按业务场景定位 1～3 个候选组件，再打开对应目录下的使用说明核验 Props、事件、插槽、Expose 和 Rules；不要仅凭目录名推断公开 API。

## 使用流程

1. 根据当前页面场景，从下方映射表选择候选组件。
2. 打开候选目录中的 `README.md`（少数历史文档为 `readme.md`），确认真实用法和限制。
3. 核验 [`index.ts`](index.ts) 的全局注册与具名导出；注册名、目录名和导出名可能不同。
4. 核验目标页面已有的相邻用法和当前 core 版本；文档与生产代码冲突时，以源码和生产代码为准。
5. 只有在根入口没有满足需求的能力时，才使用组件目录的深层路径，并确认该路径已有稳定生产用法。

## 使用方式

### 应用入口一次安装

core 组件插件只需要在应用入口安装一次；当前工作区的 [`main.ts`](../main.ts) 已完成此操作：

```ts
import components from './components'

app.use(components)
```

安装后，页面模板直接使用 `index.ts` 注册的全局标签，不需要在每个页面再次 `import`：

```vue
<template>
  <PageHeader title="设备管理" />
  <ConditionFilter v-model="terms" :fields="fields" />
  <ProUpload v-model:value="files" />
</template>
```

全局标签名以 `index.ts` 的 `.component(name, component)` 为准，例如 `PageHeader`、`ConditionFilter`、`ProUpload`、`TitleValue`。组件目录存在但未在入口注册时，不会自动成为全局组件。

### 需要脚本调用或类型时再导入

只有以下情况才需要 `import`：

- 在 `<script setup>` 中直接调用组件实例、使用具名组件或类型。
- 使用未注册的目录组件、子组件、hooks 或工具函数。

当前根入口稳定公开的具名组件和类型包括：

```ts
import {
  CardBox,
  CardSummary,
  DetailHeader,
  IconBadge,
  MarketplaceInstallStream,
  MenuAssetPermissionEditor,
  MetricCards,
  ModelParameterEditor,
  PageHeader,
  StatusPill,
} from '@jetlinks-web-core/components'
```

`CardStatistic`、`CardStatus`、`CardSuggestion`、`CardToggle` 以及 CardBox 相关类型也由根入口导出；完整列表以 [`index.ts`](index.ts) 为准。不要把目录内的默认导出、内部子组件或类型文件自动当作根入口 API。

## 场景映射

| 场景 | 候选能力 | 文档 | 根入口 / 全局名 |
| --- | --- | --- | --- |
| 页面标题、返回和操作区 | `PageHeader`、`DetailHeader`、`PageActions`、`TitleComponent` | [PageHeader](PageHeader/README.md)、[DetailHeader](DetailHeader/README.md)、[PageActions](PageActions/README.md)、[TitleComponent](TitleComponent/README.md) | 具名导出：`PageHeader`、`DetailHeader`；全局注册：`PageActions`、`TitleComponent` |
| 页面容器、区块和布局 | `FullPage`、`HomeView`、`SectionCard`、`AmbientCard`、`JlDrawerShell`、`StickyActionBar`、`EqualHeightColumns`、`ResponsiveGrid`、`KvGrid` | [HomeView](HomeView/README.md)、[SectionCard](SectionCard/README.md)、[AmbientCard](AmbientCard/README.md)、[JlDrawerShell](JlDrawerShell/README.md)、[StickyActionBar](StickyActionBar/README.md)、[EqualHeightColumns](EqualHeightColumns/README.md)、[ResponsiveGrid](ResponsiveGrid/README.md)、[KvGrid](KvGrid/README.md) | `FullPage`（来自 `@jetlinks-web-core/layout`）、`HomeView`、`SectionCard`、`AmbientCard`、`JlDrawerShell`、`StickyActionBar`、`EqualHeightColumns`、`ResponsiveGrid`、`KvGrid` |
| 路由加载和页面空态 | `PageRouteView`、`PageRouteSkeleton`、`CloudEmpty` | [PageRouteView](PageRouteView/README.md)、[PageRouteSkeleton](PageRouteSkeleton/README.md)、[CloudEmpty](CloudEmpty/README.md) | `PageRouteView`、`PageRouteSkeleton`、`CloudEmpty` |
| 列表、表格和分页 | `CrudTable`、`Search`（全局名 `ProSearch`）、`ConditionFilter`、`QuickFilterSidebar`、`VirtualScroll` | [CrudTable](CrudTable/README.md)、[Search](Search/README.md)、[ConditionFilter](ConditionFilter/readme.md)、[QuickFilterSidebar](QuickFilterSidebar/README.md)、[VirtualScroll](VirtualScroll/README.md) | `CrudTable`、`ProSearch`、`ConditionFilter`、`QuickFilterSidebar`、`VirtualScroll` |
| 卡片选择和指标摘要 | `CardBox` 及变体、`CardSelect`、`EntityCard`、`MetricCards`、`IconBadge`、`MetaChip`、`TabsCard` | [CardBox](CardBox/README.md)、[CardSelect](CardSelect/README.md)、[EntityCard](EntityCard/README.md)、[MetricCards](MetricCards/README.md)、[IconBadge](IconBadge/README.md)、[MetaChip](MetaChip/README.md)、[TabsCard](TabsCard/README.md) | CardBox/变体、`MetricCards`、`IconBadge` 具名导出；`CardSelect` 见非根入口 |
| 状态、标签和轻量展示 | `StatusTag`、`StatusPill`、`AppTag`、`Avatar`、`ChipGroup`、`Image`、`CodeBlock` | [StatusTag](StatusTag/README.md)、[StatusPill](StatusPill/README.md)、[AppTag](AppTag/README.md)、[Avatar](Avatar/README.md)、[ChipGroup](ChipGroup/README.md)、[Image](Image/README.md)、[CodeBlock](CodeBlock/README.md) | `StatusTag`、`StatusPill`、`AppTag`、`Avatar`、`ChipGroup`、`Image`、`CodeBlock` |
| 表单字段和条件编辑 | `CheckButton`、`CheckboxGroup`、`Editable`、`EditDialog`、`MetadataValueItem`、`OutputSchemaEditor`、`TermsCascader` | [CheckButton](CheckButton/README.md)、[CheckboxGroup](CheckboxGroup/README.md)、[Editable](Editable/README.md)、[EditDialog](EditDialog/README.md)、[MetadataValueItem](MetadataValueItem/README.md)、[OutputSchemaEditor](OutputSchemaEditor/README.md)、[TermsCascader](TermsCascader/readme.md) | `CheckButton`、`CheckboxGroup`、`Editable`、`EditDialog`、`MetadataValueItem`、`OutputSchemaEditor`、`TermsCascader` 及其 Group 变体 |
| 上传、导入和验证码 | `ProUpload`、`ImageUpload`、`BatchImport`、`Captcha`、`ChatTextArea` | [Upload](Upload/README.md)、[BatchImport](BatchImport/README.md)、[Captcha](Captcha/README.md)、[ChatTextArea](ChatTextArea/README.md) | `ProUpload`、`ImageUpload`、`BatchImport`、`Captcha`、`ChatTextArea` |
| 图标和富文本 | `IconLibrary`、`IconValue`、`MarkdownEditor`、`MonacoEditor` | [IconLibrary](IconLibrary/README.md)、[IconValue](IconValue/README.md)、[MarkdownEditor](MarkdownEditor/README.md)、[MonacoEditor](MonacoEditor/README.md) | `IconLibrary`、`MonacoEditor`；`IconValue` 的编辑/展示子组件见非根入口 |
| 地图、日历和图表 | `AMapComponent`、`SelectAMap`、`FullCalendar`、`Echarts`、`Dashboard`、`MCarousel` | [AMapComponent](AMapComponent/README.md)、[SelectAMap](SelectAMap/README.md)、[FullCalendar](FullCalendar/README.md)、[Echarts](Echarts/README.md)、[Dashboard](Dashboard/README.md)、[MCarousel](MCarousel/README.md) | `AMapComponent`、`SelectAMap`、`FullCalendar`、ECharts 插件、`TimeSelect`、`MCarousel` |
| 媒体播放和设计预览 | `Player`、`DesignerPreview` | [Player](Player/README.md)、[DesignerPreview](DesignerPreview/README.md) | `Player`、`DesignerPreview` |
| 菜单、资产和标签权限 | `MenuAssetPermissionEditor`、`TagManagerSidebar` | [MenuAssetPermissionEditor](MenuAssetPermissionEditor/README.md)、[TagManagerSidebar](TagManagerSidebar/README.md) | 具名导出 / `MenuAssetPermissionEditor`；全局注册 `TagManagerSidebar` |
| 业务配置和市场资源 | `ModelConfig`、`ModelParameterEditor`、`MarketplaceResourcePicker`、`MarketplaceInstallStream` | [ModelConfig](ModelConfig/README.md)、[ModelParameterEditor](ModelParameterEditor/README.md)、[MarketplaceResourcePicker](MarketplaceResourcePicker/README.md)、[MarketplaceInstallStream](MarketplaceInstallStream/README.md) | `ModelConfig`、`ModelParameterEditor`、`MarketplaceInstallStream`；`MarketplaceResourcePicker` 见非根入口 |
| 弹窗、远程组件和运行时扩展 | `ConfirmModal`、`JlConfirmDialog`、`RemoteComponent`、`RegisterComponents`、`BatchDropdown` | [ConfirmModal](ConfirmModal/README.md)、[JlConfirmDialog](JlConfirmDialog/README.md)、[RemoteComponent](RemoteComponent/README.md)、[RegisterComponents](RegisterComponents/README.md)、[BatchDropdown](BatchDropdown/README.md) | `ConfirmModal`、`JlConfirmDialog`、`RemoteComponent`、`RegistryComponent`、`BatchDropdown` |

## 非根入口能力

以下能力有实现或文档，但不是 `@jetlinks-web-core/components` 根入口的具名导出；使用前必须核验当前版本和生产代码中的导入路径：

| 目录 / 能力 | 用途 | 文档 | 使用边界 |
| --- | --- | --- | --- |
| `CardSelect` | 网格卡片选择器 | [CardSelect/README.md](CardSelect/README.md) | core 插件未注册；目录默认导出可被业务按深层路径使用 |
| `IconValue` | 图标值展示、编辑 | [IconValue/README.md](IconValue/README.md) | `IconValueView` / `IconValueEditor` 通过目录深层路径使用 |
| `MarketplaceResourcePicker` | 市场资源选择器 | [MarketplaceResourcePicker/README.md](MarketplaceResourcePicker/README.md) | core 插件未注册；需按目录入口导入 |
| `Dashboard` | 仪表盘内部组件族 | [Dashboard/README.md](Dashboard/README.md) | 入口只注册 `TimeSelect`，其余卡片和图表按目录内部使用 |
| `FormItem` | 组织、职位、角色表单项 | [FormItem/README.md](FormItem/README.md) | 入口通过对象遍历注册 `FormItemOrg`、`FormItemRole`、`FormItemPosition`，父目录不是组件标签 |
| `Upload/Cropper.vue` | 图片裁剪 | [Upload/README.md](Upload/README.md) | 仅在已有上传场景中按深层路径使用，不等同于 `ImageUpload` |
| `AMapComponent/DistrictSearch`、`GeoJson` | 地图行政区和 GeoJSON 图层 | [AMapComponent/README.md](AMapComponent/README.md) | 目录导出能力；入口只注册 `AMapComponent` 与 `PathSimplifier` |
| `Editable/FormItemEditable`、`InputEditable` | 可编辑字段子组件 | [Editable/README.md](Editable/README.md) | 入口注册了全局标签，但不作为根入口具名导出 |
| `TermsCascader` hooks/utils/types | 条件树解析、类型和工具函数 | [TermsCascader/readme.md](TermsCascader/readme.md) | 不是组件根 API；仅在需要构造 Terms 数据时按目录路径导入 |

## 附属导出与注册名

- `CardBox` 目录同时导出 `CardStatistic`、`CardStatus`、`CardSuggestion`、`CardSummary`、`CardToggle` 和对应数据类型。
- `TitleComponent` 目录同时提供 `TitleValue`，全局注册名为 `TitleValue`。
- `Search` 目录的组件全局注册名是 `ProSearch`，不能据此反推存在名为 `Search` 的全局标签。
- `Upload` 目录的默认上传组件全局注册名是 `ProUpload`，图片组件全局注册名是 `ImageUpload`。
- `RegisterComponents` 的目录默认导出全局注册名是 `RegistryComponent`。
- `FormItem` 的默认对象会注册 `FormItemOrg`、`FormItemRole`、`FormItemPosition`，它们不是 `index.ts` 的具名导出。
- `Echarts` 通过插件安装，不要把它与普通 `.component()` 注册组件混用；图表实例和按需 library 注册见 [Echarts/README.md](Echarts/README.md)。
- `CardSelect`、`IconValue`、`MarketplaceResourcePicker` 等目录存在不等于根入口公开；深层能力必须有当前生产代码证据。

## 与 `@jetlinks-web/components` 的边界

| 能力层 | 适合承载 | 查找入口 |
| --- | --- | --- |
| `@jetlinks-web/components` | 跨项目共享的基础表格、搜索、图标、布局、权限按钮和输入控件 | 目标项目依赖版本 → 包根入口 → 组件文档 |
| `@jetlinks-web-core/components` | JetLinks 项目级业务组件、公共页面壳、权限/i18n/路由适配和运行时组合 | 本文件 → [`index.ts`](index.ts) → 组件源码 |
| 业务模块局部组件 | 单一业务域的字段、流程、接口和状态编排 | 当前模块 `components/`、`api/`、相邻页面 |

当两层都能满足需求时，优先使用当前页面已经稳定使用的 core 封装；core 没有对应能力时，再直接复用 `@jetlinks-web/components`，不要在业务模块复制一层无职责包装。

## AI 自检

- 是否先按场景选择组件，再打开对应目录文档，而不是全文阅读所有组件实现。
- 是否区分目录名、具名导出名和全局注册名（例如 `Search` / `ProSearch`、`RegisterComponents` / `RegistryComponent`）。
- 是否核验 [`index.ts`](index.ts)，没有把未注册或未导出的目录当成根 API。
- 是否优先复用 core 的项目级封装，并确认目标页面已有的权限、i18n、路由和上传约定。
- 是否只在有真实生产导入证据时使用深层子路径、内部子组件或工具函数。
- 是否按组件文档中的 Props、事件、插槽、Expose 和 Rules 编写调用代码，没有凭目录名发明 API。

## 详细文档索引

按目录查看每个组件的独立说明：

`AMapComponent` · `AmbientCard` · `AppTag` · `Avatar` · `BatchDropdown` · `BatchImport` · `Captcha` · `CardBox` · `CardSelect` · `ChatTextArea` · `CheckboxGroup` · `CheckButton` · `ChipGroup` · `CloudEmpty` · `CodeBlock` · `ConditionFilter` · `ConfirmModal` · `CrudTable` · `Dashboard` · `DesignerPreview` · `DetailHeader` · `Echarts` · `Editable` · `EditDialog` · `EntityCard` · `EqualHeightColumns` · `FormItem` · `FullCalendar` · `HomeView` · `IconBadge` · `IconLibrary` · `IconValue` · `Image` · `JlConfirmDialog` · `JlDrawerShell` · `KvGrid` · `MarkdownEditor` · `MarketplaceInstallStream` · `MarketplaceResourcePicker` · `MCarousel` · `MenuAssetPermissionEditor` · `MetaChip` · `MetadataValueItem` · `MetricCards` · `ModelConfig` · `ModelParameterEditor` · `MonacoEditor` · `OutputSchemaEditor` · `PageActions` · `PageHeader` · `PageRouteSkeleton` · `PageRouteView` · `Player` · `QuickFilterSidebar` · `RegisterComponents` · `RemoteComponent` · `ResponsiveGrid` · `Search` · `SectionCard` · `SelectAMap` · `StatusPill` · `StatusTag` · `StickyActionBar` · `TabsCard` · `TagManagerSidebar` · `TermsCascader` · `TitleComponent` · `Upload` · `VirtualScroll`
