# NavigationTree

用于侧栏目录导航。直接使用 Ant Tree 的原生连线、缩进、加减号、选择、键盘、复选框和异步加载能力；长名称省略，仅实际溢出时延迟 600ms 提示全文，菜单打开或拖动期间暂停提示。元信息紧随名称，深层缩进溢出时在树视口底部横向滚动。名称使用正常字号，不按语言缩小。

```vue
<div class="directory">
  <NavigationTree
    v-model:expanded-keys="expandedKeys"
    :tree-data="nodes"
    :selected-keys="selectedKeys"
    searchable
    search-node-key="all"
    @select="onSelect"
  >
    <template #node-meta="node"><span>{{ node.count }}</span></template>
  </NavigationTree>
</div>
```

父容器需要有界高度，并使用 `display: flex; flex-direction: column; min-height: 0`。组件通过 `flex: 1` 占满剩余空间，也可传入数值 `height` 明确组件高度。`class` 和 `style` 应用到组件外层，其他属性和原生事件转发给内部 Tree。根入口支持具名导入及全局注册；实例仅公开内部 `treeRef`。

## 属性和状态

| 属性 | 行为 |
| --- | --- |
| `treeData`、`fieldNames`、`selectedKeys` | 沿用 Ant Tree，保留节点扩展字段，数字 `0` 也是有效 key |
| `defaultExpandDepth` | 默认初始显示两层业务节点，展开首层分支。`searchNodeKey` 指定的范围根不计业务层数 |
| `defaultExpandedKeys`、`defaultExpandAll` | 显式初始展开优先于默认层数 |
| `expandedKeys` / `update:expandedKeys` | 可选受控状态。首次未传入时生成默认值；传入空数组代表显式收起。宿主应处理更新以接收选中路径展开 |
| `searchable` | 默认 false；启用后在树视口上方显示常驻搜索输入框 |
| `searchNodeKey` | 可选；指定不计业务层级的范围根，无匹配时仍保留该根 |
| `searchValue` / `update:searchValue` | 可选受控关键词，也可完全使用内部状态 |
| `searchLabel`、`searchPlaceholder` | 可访问名称和短占位文案；默认使用 core 多语言资源 |
| `getSearchText(node)` | 自定义匹配文字，默认匹配 `fieldNames.title` 指定的字符串或数字 |
| `nodeDraggable(node)` | 可选；阻止指定节点开始拖动，仍允许其作为落点。拖动总开关仍使用原生 `draggable` |

选中节点发生变化或其路径异步加载后，自动揭示祖先。计数、标题及语言刷新不覆盖用户展开偏好。搜索保留匹配祖先；自身匹配的节点保留子树，无匹配时仍保留搜索根。搜索期间临时展开，不发出 `expand` 或 `update:expandedKeys`，清空后恢复原状态。搜索和清空不会触发选择；有关键词时 Escape 清空关键词，否则交给外层处理。搜索期间禁用拖动与落下保存，避免基于过滤后的残缺目录修改顺序。切换 `searchNodeKey` 会清空搜索并重新初始化展开；宿主也可通过 `key` 分隔目录生命周期。

## 插槽

| 插槽 | 参数和用途 |
| --- | --- |
| `title` / `titleRender` | 完整节点；自定义名称，也用于全文提示 |
| `node-meta` | 完整节点；紧随名称的计数徽标、状态等，保留其宽度并让名称省略 |
| `node-suffix` | 完整节点；行尾动作，与名称一起随深层目录滚动，点击不触发节点选择 |
| `node-menu` | 完整节点；节点右键菜单，不改变当前选择；与更多按钮可复用同一菜单组件 |
| `root-menu` | 无参数；目录空白处的右键菜单 |
| `empty` | 无数据或无匹配时的内容；默认区分两种空态 |
| 其他原生插槽 | 透传给 Ant Tree |

权限、路由、计数语义、业务 API 和菜单由宿主持有。元信息中的交互控件应隔离点击并提供可访问名称；如需节省空间，可在同一个元信息单元内用悬停/聚焦动作替换徽标，无需预留第二列。

拖放的落点与事件沿用 Ant Tree；拖影通过浏览器原生 `DataTransfer.setDragImage` 选取节点内容，排除祖先缩进。源节点保留内容高亮，移除覆盖祖先缩进区的重复整行描边，目标位置继续显示原生落点线。合成根可用 `nodeDraggable` 禁止拖起，同时保留移入根的能力。

## 与 AutoTree 的边界

`NavigationTree` 固定 `virtual=false`，统一使用外层原生滚动，避免内部滚动条与容器滚动叠加。`autoExpandParent` 由搜索控制，不作为外部配置。内部通过 Ant Tree 的原生 `prefixCls` 使用独立样式前缀，隔离工作区针对 `.ant-tree` 的历史几何覆盖，不再绘制自定义连线；该前缀由组件管理。适合层级目录，不承诺万级节点全部展开的性能；大规模虚拟树继续用 `AutoTree`，需要比较多个数据列则使用内容区树表格。现有 `AutoTree` 的原生 Tree 属性、实例和虚拟滚动契约不变。
