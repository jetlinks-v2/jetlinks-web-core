# SplitterPane

与 `Splitter`／`ResponsiveSplitter` 组合的内容面板，从 core 根入口具名导入。低层分割器只管理几何、尺寸和收放，面板组织实际的 `header`、`toolbar` 与默认正文插槽。

左右布局中，同一分割器内的面板按自然内容同步头部与工具栏高度；换行、内容缩短及卸载均会重新计算。窄屏抽屉、折叠和上下分区不强制同行高度。没有对应内容的面板只预留同行轨道，不生成假搜索控件。结构线由面板提供，默认接到分割线。

公共标题行保留连接主分区的底线；工具栏默认不增加底线。表格所需的表头分隔归 Table，卡片集合通过正文内距与对象边界组织，不由工具栏跨所有呈现形态画一条线。

正文默认 `padding="var(--space-4, 16px)"` 并在约束高度内滚动；`padding=0` 用于全幅内容。表格、虚拟列表等已有滚动 owner 时设 `scroll=false`，正文成为可收缩 flex 列，由内容自己滚动。`scroll` 事件和暴露的 `body` 元素用于接入按需加载，不监听整个 window。宿主须提供可用高度及 `min-height:0` 高度链。

```vue
<ResponsiveSplitter :min="220" :end-min="480">
  <template #start>
    <SplitterPane>
      <template #header>对象分组</template>
      <template #toolbar><a-input placeholder="搜索分组" /></template>
      对象导航
    </SplitterPane>
  </template>
  <template #end="{ collapsed, toggle, startId }">
    <SplitterPane>
      <template #header>
        <PanelCollapseButton :collapsed="collapsed" :aria-controls="startId" @toggle="toggle" />
        业务列表
      </template>
      <template #toolbar><ConditionFilter :fields="fields" /></template>
      列表内容
    </SplitterPane>
  </template>
</ResponsiveSplitter>
```

折叠入口放在实际头部；状态仍由分割器持有。原有自行管理头部与留白的分割器内容不受该面板影响。`EqualHeightColumns` 保留 CSS 轨道及既有正文默认留白方式，共用同行测量逻辑。
