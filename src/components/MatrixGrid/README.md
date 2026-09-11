# MatrixGrid 使用说明

`MatrixGrid` 提供二维矩阵的结构能力，适用于“行对象 × 列对象”的高密度对比或配置页面。组件只负责布局和通用交互，不理解调用方的业务状态。

## 能力

- CSS Grid 矩阵、横向与纵向滚动
- 固定列表头和固定首列
- 可选双层列表头
- 分组行折叠入口、全部展开和全部收起操作
- 固定行高下的可选纵向虚拟切片
- 可选视口空白网格填充
- corner、列表头、行头、数据单元格、分组行、空状态和 footer 插槽

## 基础用法

```vue
<MatrixGrid
  :rows="rows"
  :columns="columns"
  :column-groups="columnGroups"
  :expanded-keys="expandedKeys"
  :virtual="true"
  :fill-viewport="true"
  :show-footer="true"
  :expand-all-text="t('common.expandAll')"
  :collapse-all-text="t('common.collapseAll')"
  @toggle-row="toggleRow"
  @expand-all="expandAll"
  @collapse-all="collapseAll"
>
  <template #corner>资源</template>
  <template #column-group-header="{ group }">{{ group.data.name }}</template>
  <template #column-header="{ column }">{{ column.data.name }}</template>
  <template #group-row="{ row }">{{ row.data.name }}</template>
  <template #row-header="{ row }">{{ row.data.name }}</template>
  <template #cell="{ row, column }">
    <BusinessCell :row="row.data" :column="column.data" />
  </template>
</MatrixGrid>
```

## 数据约束

- `rows` 是调用方已经按展开状态处理后的可见平铺行；`kind='group'` 表示可折叠分组行，`kind='item'` 表示数据行。
- `columns` 可以为空；组件会保留首列和分组行、不生成数据单元格，并让首列撑满可用宽度。
- `expandedKeys` 用于控制分组行箭头以及全部展开/收起按钮状态。组件发出事件后，由调用方维护展开状态和可见行。
- `columnGroups[].columnKeys` 必须引用连续存在于 `columns` 中的列。
- 开启 `virtual` 时所有可见行必须使用同一个 `rowHeight`，不支持动态行高。
- 单元格内容、颜色、loading、disabled、权限和点击动作全部由插槽内容负责。

## Props

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `rows` | `MatrixGridRow[]` | 必填 | 调用方计算后的可见平铺行 |
| `columns` | `MatrixGridColumn[]` | 必填 | 数据列 |
| `columnGroups` | `MatrixGridColumnGroup[]` | `[]` | 可选双层列表头分组 |
| `expandedKeys` | `ReadonlySet<string> \| string[]` | 空集合 | 已展开分组行 key |
| `firstColumnWidth` | `number` | `400` | 首列宽度，单位 px |
| `columnMinWidth` | `number` | `165` | 数据列最小宽度，单位 px |
| `rowHeight` | `number` | `40` | 固定行高，单位 px |
| `gridGap` | `number` | `1` | 网格线间距，单位 px |
| `columnHeaderHeight` | `number` | `86` | 列表头高度，单位 px |
| `columnGroupHeaderHeight` | `number` | `40` | 分组列表头高度，单位 px |
| `virtual` | `boolean` | `false` | 是否开启固定行高纵向虚拟切片 |
| `virtualOverscan` | `number` | `8` | 虚拟切片上下缓冲行数 |
| `fillViewport` | `boolean` | `false` | 有数据时是否用空白网格填满剩余视口 |
| `showFooter` | `boolean` | `false` | 是否显示底部区域 |
| `showGroupActions` | `boolean` | `true` | footer 中是否显示全部展开/收起 |
| `expandAllText` / `collapseAllText` | `string` | `''` | 全部展开/收起文案，由调用方注入 i18n 结果 |

## 事件与插槽

- `toggle-row(key, row)`：点击分组行时触发。
- `expand-all`、`collapse-all`：点击底部通用操作时触发；调用方据此更新 `expandedKeys` 和可见 `rows`。
- 表头插槽：`corner`、`column-group-header`、`column-header`。
- 数据插槽：`group-row`、`group-cell`、`row-header`、`cell`。
- 状态插槽：`empty`、`footer`。

组件通过 `getScrollElement()` 暴露内部滚动容器。样式可通过 `--matrix-grid-header-bg`、`--matrix-grid-group-hover-bg` 等 CSS 变量在调用侧覆盖，业务类名不应写入公共组件。
