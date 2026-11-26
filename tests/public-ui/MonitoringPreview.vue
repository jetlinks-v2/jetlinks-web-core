<template>
  <section class="monitoring-example" aria-label="运行监测分区示例">
      <ResponsiveSplitter ref="panel" class="workspace-body" :default-size="216" :min="184" :max="300" :end-min="480"
        panel-title="监测分组" resize-label="调整监测分组宽度">
        <template #start="{ compact, close }">
          <SplitterPane class="group-pane" :padding="0" :scroll="false">
            <template v-if="!compact" #header><h2>监测分组</h2><PanelCollapseButton :collapsed="false" :aria-controls="panel?.startId" label="收起监测分组" @toggle="panel?.toggle()" /></template>
            <template #toolbar><a-input v-model:value="groupSearch" placeholder="搜索分组" aria-label="搜索监测分组" allow-clear><template #prefix><AIcon type="SearchOutlined" /></template></a-input></template>
            <nav class="group-list" aria-label="监测分组">
              <a-button v-for="item in filteredGroups" :key="item.id" type="text" class="group-item" :class="{ 'is-selected': group === item.id }"
                :aria-pressed="group === item.id" @click="list.chooseGroup(item.id); compact && close()">
                <AIcon :type="item.icon" /><span class="group-item__name">{{ item.name }}</span>
                <a-skeleton-input v-if="groupCountLoading" active size="small" class="group-count-loading" />
                <a-badge v-else-if="groupCounts" :count="groupCounts[item.id]" show-zero :overflow-count="9999" :title="`${item.name}，${groupCounts[item.id]} 个点位`" :number-style="{ backgroundColor:'var(--canvas)', color:'var(--ink-2)', boxShadow:'none' }" />
              </a-button>
              <a-empty v-if="!filteredGroups.length" description="没有匹配的分组" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
              <a-button v-if="groupCountError" type="link" @click="list.loadGroupCounts">分组数量重试</a-button>
            </nav>
            <div class="group-footnote"><AIcon type="ApartmentOutlined" /><span>一号厂房</span></div>
          </SplitterPane>
        </template>
        <template #end>
          <SplitterPane class="device-pane" :padding="0" :scroll="false" aria-label="监测点列表">
            <template #header>
              <div class="list-heading">
              <div class="heading-identity">
                <PanelCollapseButton v-if="panel?.collapsed" :collapsed="true" :aria-controls="panel?.startId" label="展开监测分组" @toggle="panel?.toggle()" />
                <h2><j-ellipsis>{{ groupName }}</j-ellipsis></h2>
              </div>
              <a-button v-if="countError" class="point-distribution" type="link" size="small" @click="list.loadCount">数量重试</a-button>
              <div v-else class="point-distribution" role="group" aria-label="按分组与其余搜索条件统计，点击筛选状态">
                <a-tooltip v-for="item in countItems" :key="item.key" title="按当前分组及其余搜索条件统计，不含这里选择的状态">
                  <a-button type="text" class="distribution-item" :class="{ 'is-selected': activeDistribution === item.key }" :aria-pressed="activeDistribution === item.key" :aria-label="item.label + '，' + (countLoading ? '数量加载中' : counts ? counts[item.key] + '个点位' : '数量未获取')" @click="list.chooseDistribution(item.key)">
                    <AIcon :type="item.icon" aria-hidden="true" :class="{ 'is-attention': item.key === 'attention' && counts?.attention }" /><span>{{ item.label }}</span>
                    <a-skeleton-input v-if="countLoading" active size="small" :style="{ width:'24px', minWidth:'24px' }" :aria-label="item.label + '数量加载中'" />
                    <a-badge v-else :count="counts?.[item.key]" show-zero :overflow-count="9999" :number-style="{ backgroundColor: activeDistribution === item.key ? 'var(--accent-soft)' : 'var(--canvas)', color: 'inherit', boxShadow:'none' }" />
                  </a-button>
                </a-tooltip>
              </div>
              <a-segmented class="view-switch" v-model:value="view" aria-label="展示方式" :options="[{ label: '列表', value: 'list' }, { label: '卡片', value: 'cards' }]" />
              </div>
            </template>
            <template #toolbar>
              <ConditionFilter v-model="terms" :fields="fields" placeholder="筛选点位、所在设备或状态" @change="list.applyTerms($event.terms)" />
            </template>
            <div ref="content" class="device-scroll" :class="{ 'device-scroll--cards': view === 'cards' }" tabindex="0" aria-label="监测内容区" @scroll.passive="loadNearEnd">
              <a-config-provider v-if="view === 'list'" :theme="{ components: { Table: { borderRadiusLG: 0, paddingXS: 16, colorBorderSecondary: 'var(--line)' } } }">
              <a-table row-key="id" :columns="columns" :data-source="rows" :pagination="false" size="middle" :scroll="{ x: 810 }" :sticky="{ getContainer: getTableScrollContainer }">
                <template #bodyCell="{ column, record: point }">
                <template v-if="column.dataIndex === 'name'"><div class="row-identity"><AIcon :type="point.icon" /><div><a-button type="link" class="point-name" @click="selected = rows.find(item => item.id === point.id)">{{ point.name }}</a-button><span>{{ point.model }}</span></div></div></template>
                <template v-else-if="column.dataIndex === 'value'"><span v-if="details[point.id]" class="row-value" :class="{ 'is-attention': attention(point.status) }">{{ valueText(details[point.id]) }} <small>{{ details[point.id].unit }}</small></span><a-skeleton-input v-else active size="small" :style="{ width: '72px', minWidth: '72px' }" /></template>
                <template v-else-if="column.dataIndex === 'state'"><a-badge :status="badgeStatus(point.status)" :text="statusName(point.status)" /></template>
                <template v-else-if="column.dataIndex === 'range'"><span v-if="details[point.id]" class="range-text">{{ rangeText(details[point.id]) }}</span><a-skeleton-input v-else active size="small" :style="{ width: '90px', minWidth: '90px' }" /></template>
                <template v-else-if="column.dataIndex === 'trend'"><PointTrend v-if="details[point.id]" :detail="details[point.id]" :attention="attention(point.status)" compact /><a-skeleton-input v-else active size="small" :style="{ width: '110px', minWidth: '110px' }" /></template>
                </template>
                <template #emptyText><a-skeleton v-if="loading" active :paragraph="{ rows: 4 }" /><a-empty v-else description="没有符合条件的点位" :image="Empty.PRESENTED_IMAGE_SIMPLE" /></template>
              </a-table>
              </a-config-provider>
              <div v-else class="device-grid">
                <article v-for="point in rows" :key="point.id" class="point-card">
                  <header class="point-card__heading"><span class="point-icon"><AIcon :type="point.icon" /></span><div class="point-identity"><h3><j-ellipsis>{{ point.name }}</j-ellipsis></h3><span>{{ point.model }}</span></div><a-badge :status="badgeStatus(point.status)" :text="statusName(point.status)" /></header>
                  <div class="point-reading" :class="{ 'is-attention': attention(point.status) }">
                    <template v-if="details[point.id]"><strong>{{ valueText(details[point.id]) }}</strong><span>{{ details[point.id].unit }}</span></template>
                    <a-skeleton-input v-else active :style="{ width: '110px' }" aria-label="当前值加载中" />
                  </div>
                  <div class="point-range"><template v-if="details[point.id]">参考 {{ rangeText(details[point.id]) }}</template><a-skeleton-input v-else active size="small" :style="{ width: '120px', minWidth: '120px' }" /></div>
                  <div class="point-chart"><PointTrend v-if="details[point.id]" :detail="details[point.id]" :attention="attention(point.status)" /><a-skeleton-input v-else active :style="{ width: '100%', height: '52px' }" /></div>
                  <footer class="point-card__footer"><span>近 30 分钟</span><a-button type="link" size="small" @click="selected = point">查看详情</a-button></footer>
                </article>
                <article v-for="n in pendingSlots" :key="'pending-' + n" class="point-card point-card--skeleton" aria-label="监测点加载中"><a-skeleton active :title="{ width: '65%' }" :paragraph="{ rows: 4 }" /></article>
              </div>
              <div class="stream-state" role="status">
                <template v-if="error">{{ error }}<a-button type="link" size="small" @click="list.loadMore">重试</a-button></template>
                <template v-else-if="rows.length">已加载 {{ rows.length }} 个点位<span>{{ ended ? '已显示全部点位' : loading ? '正在加载更多' : '向下滚动加载更多' }}</span></template>
              </div>
            </div>
          </SplitterPane>
        </template>
      </ResponsiveSplitter>
    <a-drawer :open="!!selected" :title="selected?.name" width="min(520px, 100vw)" @close="selected = undefined">
      <template v-if="selected">
        <div class="drawer-identity"><AIcon :type="selected.icon" /><span>{{ selected.model }}</span><a-badge :status="badgeStatus(selected.status)" :text="statusName(selected.status)" /></div>
        <a-skeleton v-if="!details[selected.id]" active :paragraph="{ rows: 4 }" />
        <template v-else>
          <div class="point-reading" :class="{ 'is-attention': attention(selected.status) }"><strong>{{ valueText(details[selected.id]) }}</strong><span>{{ details[selected.id].unit }}</span></div>
          <p class="range-text">参考范围 {{ rangeText(details[selected.id]) }}</p>
          <h3 class="drawer-chart-title">近 30 分钟趋势</h3><PointTrend :detail="details[selected.id]" :attention="attention(selected.status)" :style="{ height: '150px' }" />
          <a-divider /><a-descriptions :column="1" size="small"><a-descriptions-item label="所在位置">{{ details[selected.id].location }}</a-descriptions-item><a-descriptions-item label="点位编号">{{ selected.id }}</a-descriptions-item><a-descriptions-item label="数据更新时间">{{ details[selected.id].reported }}</a-descriptions-item><a-descriptions-item label="通信信号">{{ details[selected.id].signal }}</a-descriptions-item></a-descriptions>
        </template>
      </template>
    </a-drawer>
  </section>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Empty } from 'ant-design-vue'
import ResponsiveSplitter from '../../src/components/Splitter/ResponsiveSplitter.vue'
import SplitterPane from '../../src/components/SplitterPane/index.vue'
import PanelCollapseButton from '../../src/components/PanelCollapseButton/index.vue'
import ConditionFilter from '../../src/components/ConditionFilter/ConditionFilter.vue'
import type { ConditionFieldSchema } from '../../src/components/ConditionFilter/types'
import { groups, type Device, type DeviceDetail, type DeviceCounts } from './monitoring/data.ts'
import { useDeviceList } from './monitoring/useDeviceList.ts'
import PointTrend from './monitoring/PointTrend.vue'
const list = useDeviceList()
const { group, terms, groupName, rows, details, counts, countLoading, countError, groupCounts, groupCountLoading, groupCountError, loading, pendingSlots, ended, error, revision, activeDistribution } = list
const panel = ref<InstanceType<typeof ResponsiveSplitter>>(), content = ref<HTMLElement>(), selected = ref<Device>()
const getTableScrollContainer = () => content.value ?? document.body
const view = ref('list')
const groupSearch = ref('')
const filteredGroups = computed(() => groups.filter(item => item.name.includes(groupSearch.value.trim())))
const countItems: { key: keyof DeviceCounts; label: string; icon: string }[] = [{ key:'total', label:'全部', icon:'AppstoreOutlined' }, { key:'normal', label:'正常', icon:'CheckCircleOutlined' }, { key:'attention', label:'异常', icon:'ExclamationCircleOutlined' }, { key:'offline', label:'离线', icon:'DisconnectOutlined' }]
const fields: ConditionFieldSchema[] = [
  { title: '点位名称', dataIndex: 'name', search: { type: 'string', defaultTermType: 'like', termTypeOptions: ['like', 'eq'] } },
  { title: '所在设备', dataIndex: 'model', search: { type: 'string', defaultTermType: 'like', termTypeOptions: ['like', 'eq'] } },
  { title: '状态', dataIndex: 'status', search: { type: 'select', termTypeOptions: ['eq'], options: [
    { label: '正常', value: 'normal' }, { label: '越上限', value: 'high' }, { label: '低于下限', value: 'low' }, { label: '离线', value: 'offline' },
  ] } },
]
const stateNames: Record<string,string> = { normal: '正常', high: '越上限', low: '低于下限', offline: '离线' }
const statusName = (value: string) => stateNames[value]
const attention = (value: string) => ['high', 'low'].includes(value)
const badgeStatus = (value: string) => value === 'offline' ? 'default' : attention(value) ? 'warning' : 'success'
const valueText = (detail: DeviceDetail) => detail.value === undefined ? '—' : detail.value.toFixed(detail.digits)
const rangeText = (detail: DeviceDetail) => detail.lower.toFixed(detail.digits) + '–' + detail.upper.toFixed(detail.digits) + ' ' + detail.unit
const columns = [
  { title: '监测点', dataIndex: 'name', width: 230 },
  { title: '当前值', dataIndex: 'value', width: 140 },
  { title: '状态', dataIndex: 'state', width: 100 },
  { title: '参考范围', dataIndex: 'range', width: 180 },
  { title: '近 30 分钟', dataIndex: 'trend', width: 160 },
].map(column => ({ ...column, customHeaderCell: () => ({ style: { borderTop: '1px solid var(--line)' } }) }))
function loadNearEnd() {
  const element = content.value
  if (element && element.scrollHeight - element.scrollTop - element.clientHeight < 160) void list.loadMore()
}
watch([loading, () => rows.value.length, view], async () => { await nextTick(); if (!error.value) loadNearEnd() })
watch(revision, async () => { selected.value = undefined; await nextTick(); content.value?.scrollTo({ top: 0 }) })
</script>
<style scoped>
.monitoring-example { display:flex; flex:1; height:100%; min-width:0; min-height:0; }
.workspace-body { flex:1; min-height:0; }
.group-pane,.device-pane { display:flex; flex-direction:column; height:100%; min-width:0; min-height:0; }
.device-pane { container:monitoring-pane / inline-size; }
.list-heading { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:var(--space-2); width:100%; min-width:0; }
.list-heading .point-distribution { grid-column:1 / -1; grid-row:2; }
.view-switch { grid-column:2; grid-row:1; }
@container monitoring-pane (min-width:720px) {
  .list-heading { grid-template-columns:minmax(0,1fr) auto auto; }
  .list-heading .point-distribution { grid-column:2; grid-row:1; }
  .view-switch { grid-column:3; }
}
.group-pane h2,.device-pane h2 { flex:1; min-width:0; margin:0; font-size:var(--fs-16); font-weight:600; }
.heading-identity { display:flex; flex:1; align-items:center; gap:var(--space-2); min-width:0; }
.heading-identity h2 { flex:1; }
.group-list { display:flex; flex:1; min-height:0; flex-direction:column; align-items:stretch; gap:var(--space-1); padding:var(--space-3); overflow:auto; }
.group-item.ant-btn { display:flex; align-items:center; gap:var(--space-3); min-height:42px; height:auto; padding:var(--space-3); text-align:start; white-space:normal; }
.group-item.is-selected { color:var(--accent); background:var(--accent-soft); }
.group-item__name { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.group-item > :deep(.anticon),.group-item > :deep(.ant-badge) { flex:none; }
.group-count-loading { flex:none; width:24px; }
.group-count-loading :deep(.ant-skeleton-input) { width:24px; min-width:24px; }
.group-footnote { display:flex; flex:none; align-items:center; gap:var(--space-2); padding:var(--space-4); color:var(--ink-2); font-size:var(--fs-12); }
.point-distribution { display:flex; flex-wrap:wrap; align-items:center; gap:var(--space-1); max-width:100%; }
.distribution-item.ant-btn { display:inline-flex; flex:none; align-items:center; justify-content:center; gap:var(--space-2); padding-inline:var(--space-2); font-size:var(--fs-12); }
.distribution-item.is-selected { background:var(--accent-soft); color:var(--accent); }
.distribution-item :deep(.ant-badge-count) { font-variant-numeric:tabular-nums; }
.distribution-item :deep(.ant-skeleton-input) { width:24px; min-width:24px; max-width:100%; }
.device-scroll { flex:1; min-height:0; overflow:auto; overscroll-behavior:contain; }
.device-scroll--cards { padding:var(--space-4); }
.device-scroll:focus-visible { outline:2px solid var(--accent); outline-offset:-2px; }
.device-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,270px),1fr)); gap:var(--space-4); }
.point-card { display:flex; flex-direction:column; min-width:0; min-height:248px; border:1px solid var(--line); border-radius:var(--r-2); background:var(--surface); }
.point-card__heading { display:flex; align-items:center; gap:var(--space-3); padding:var(--space-4) var(--space-4) 0; }
.point-icon { display:flex; flex:none; align-items:center; justify-content:center; width:28px; color:var(--accent); font-size:20px; }
.point-identity { flex:1; min-width:0; }
.point-identity h3 { margin:0; font-size:var(--fs-14); font-weight:600; }
.point-identity > span { display:block; margin-top:var(--space-1); font-size:var(--fs-12); color:var(--ink-2); }
.point-card__heading :deep(.ant-badge-status-text) { margin-left:var(--space-1); font-size:var(--fs-12); }
.point-reading { display:flex; align-items:baseline; gap:var(--space-2); min-height:50px; padding:var(--space-4) var(--space-4) 0; }
.point-reading strong { font-size:28px; line-height:1.2; font-weight:600; font-variant-numeric:tabular-nums; }
.point-reading > span { color:var(--ink-2); font-size:var(--fs-14); }
.is-attention { color:var(--jet-theme-warning); }
.point-range { min-height:30px; padding:var(--space-2) var(--space-4) 0; font-size:var(--fs-12); color:var(--ink-2); }
.point-chart { flex:1; min-height:68px; padding:var(--space-2) var(--space-4) 0; }
.point-card__footer { display:flex; align-items:center; justify-content:space-between; gap:var(--space-2); min-height:36px; padding:0 var(--space-4) var(--space-2); color:var(--ink-2); font-size:var(--fs-12); }
.point-card__footer .ant-btn { padding-inline:0; }
.point-card--skeleton { padding:var(--space-4); }
.row-identity { display:flex; align-items:center; gap:var(--space-3); min-width:0; }
.row-identity > :first-child { color:var(--accent); font-size:18px; }
.row-identity > div { min-width:0; }
.point-name.ant-btn { height:auto; padding:0; white-space:normal; text-align:start; }
.row-identity > div > span { display:block; font-size:var(--fs-12); color:var(--ink-2); }
.row-value { font-size:var(--fs-16); font-weight:600; font-variant-numeric:tabular-nums; white-space:nowrap; }
.row-value small { font-size:var(--fs-12); color:var(--ink-2); font-weight:400; }
.range-text { color:var(--ink-2); font-size:var(--fs-12); white-space:nowrap; }
.drawer-identity { display:flex; align-items:center; gap:var(--space-3); }
.drawer-chart-title { margin:var(--space-5) 0 var(--space-3); font-size:var(--fs-14); }
.stream-state { display:flex; justify-content:center; align-items:center; flex-wrap:wrap; gap:var(--space-3); min-height:48px; margin-top:var(--space-2); color:var(--ink-2); font-size:var(--fs-12); }
.stream-state > span { color:var(--ink-2); }
@media(max-width:600px) { .group-item.ant-btn { min-height:44px; } }
</style>
