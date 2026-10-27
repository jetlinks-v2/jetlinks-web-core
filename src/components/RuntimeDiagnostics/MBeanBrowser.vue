<template>
  <div ref="browser" class="bean-browser" @keydown.esc="onDirectoryEscape">
  <DiagnosticsState :state="state" @retry="emit('refresh')">
    <div ref="toolbar" class="diagnostics-toolbar diagnostics-compact-toolbar bean-toolbar">
      <div v-if="compact" ref="directoryEntry" class="bean-directory-entry"><a-button :aria-label="t('runtimeDiagnostics.beanDirectory')" :aria-expanded="navigationVisible" :aria-controls="navigationId" :title="bean?.objectName" @click="directoryOpen = !directoryOpen"><UnorderedListOutlined /><span>{{ bean?.name || t('runtimeDiagnostics.selectBean') }}</span><DownOutlined :rotate="navigationVisible ? 180 : 0" /></a-button></div>
      <a-input-search v-show="navigationVisible" v-model:value="search" class="bean-search" :placeholder="t('runtimeDiagnostics.beanSearch')" allow-clear />
      <span class="bean-count">{{ t('runtimeDiagnostics.objectCount', { count: beans.length }) }}</span><a-tooltip :title="t('runtimeDiagnostics.refresh')"><a-button type="text" size="small" :aria-label="t('runtimeDiagnostics.refresh')" @click="emit('refresh')"><ReloadOutlined /></a-button></a-tooltip>
    </div>
    <div class="bean-workspace">
      <div v-show="navigationVisible" :id="navigationId" ref="navigation" class="bean-navigation" @scroll="navigationReading.onScroll">
        <div class="bean-navigation-content">
        <a-tree :expanded-keys="expanded" :tree-data="tree" :selected-keys="selected ? [selected] : []" :auto-expand-parent="!!search" block-node @expand="expand" @select="select">
          <template #title="node"><a-tooltip :title="node.description || node.title"><span class="bean-tree-title" :data-mbean-object="node.isLeaf ? node.key : undefined">{{ node.title }}<small v-if="node.technical && node.technical !== node.title">{{ node.technical }}</small><small v-if="node.count !== undefined">{{ node.count }}</small></span></a-tooltip></template>
        </a-tree>
        <a-empty v-if="!tree.length" :description="t('runtimeDiagnostics.noMatches')" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
        </div>
      </div>
      <div v-if="bean" ref="detail" class="diagnostics-detail bean-detail" @scroll="detailReading.onScroll">
        <div class="bean-heading"><div><strong>{{ beanTitle(bean) }}</strong><p v-if="description">{{ description }}</p></div><a-tag>{{ bean.type }}</a-tag></div>
        <a-typography-paragraph class="bean-object-name" :copyable="{ text: bean.objectName }">{{ bean.objectName }}</a-typography-paragraph>
        <DiagnosticsState :state="detailState" @retry="emit('refresh')">
          <a-tabs class="diagnostics-mode-tabs" :active-key="section" size="small" @change="changeSection">
            <a-tab-pane v-if="renderer" key="summary" :tab="t('runtimeDiagnostics.summary')">
              <MBeanRendererBoundary :key="`${target}:${bean.objectName}`"><component :is="renderer" :bean="bean" @request-section="requestSection" /><template #fallback><a-alert :message="t('runtimeDiagnostics.rendererFallback')" type="warning" show-icon /><MBeanAttributes :attributes="bean.attributes" /></template></MBeanRendererBoundary>
            </a-tab-pane>
            <a-tab-pane key="attributes" :tab="`${t('runtimeDiagnostics.attributes')} ${bean.attributes.length}`"><MBeanAttributes :attributes="bean.attributes" /></a-tab-pane>
            <a-tab-pane v-if="bean.operations.length" key="operations" :tab="`${t('runtimeDiagnostics.methods')} ${bean.operations.length}`"><MBeanOperations :key="bean.objectName" :bean="bean" :target="target" :invoke-access="invokeAccess" :busy="queryContext.busy.value" :result="genericResult" :result-state="genericState" @invoke="invokeGeneric" /></a-tab-pane>
          </a-tabs>
        </DiagnosticsState>
      </div>
      <a-empty v-else :description="t('runtimeDiagnostics.selectBean')" />
    </div>
  </DiagnosticsState>
  </div>
</template>
<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onScopeDispose, provide, ref, shallowRef, watch, type PropType } from 'vue'
import { DownOutlined, ReloadOutlined, UnorderedListOutlined } from '@ant-design/icons-vue'
import { Empty } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import DiagnosticsState from './DiagnosticsState.vue'
import MBeanSummary from './MBeanSummary.vue'
import MBeanRendererBoundary from './MBeanRendererBoundary.vue'
import MBeanAttributes from './MBeanAttributes.vue'
import MBeanOperations from './mbean/MBeanOperations.vue'
import { compareMBeanDomain, isJetLinksDomain, mbeanCatalogEntry, mbeanGroupKey, resolveMBeanRenderer, supportsMBeanSummary } from './registry'
import type { MBeanDescriptor, MBeanDisplayConfig, MBeanInvocation, MBeanInvocationOutcome, ViewState, ActionAccess } from './types'
import { mbeanRendererContextKey, useMBeanQueryContext } from './mbean/context'
import { revealMBeanSelection } from './mbean/selectionVisibility'
import { useRetainedScroll } from '../../hooks/useRetainedScroll'
import { useDiagnosticWidth } from './useDiagnosticWidth'
const props = defineProps({
  beans: { type: Array as PropType<MBeanDescriptor[]>, default: () => [] },
  state: { type: Object as PropType<ViewState>, default: () => ({ status: 'ready' }) },
  detailState: { type: Object as PropType<ViewState>, default: () => ({ status: 'ready' }) },
  resultState: { type: Object as PropType<ViewState>, default: () => ({ status: 'ready' }) },
  invokeAccess: { type: Object as PropType<ActionAccess>, default: () => ({ allowed: false }) },
  config: { type: Object as PropType<MBeanDisplayConfig>, default: undefined },
  active: { type: Boolean, default: true },
  busy: { type: Boolean, default: false }, result: { type: null, default: undefined },
  selectedObject: { type: String, default: '' }, target: { type: String, default: '' },
  executeInvocation: { type: Function as PropType<(invocation: MBeanInvocation) => Promise<MBeanInvocationOutcome | undefined>>, default: undefined },
})
const emit = defineEmits<{
  (event: 'refresh'): void; (event: 'select', objectName: string): void; (event: 'invoke', invocation: MBeanInvocation): void
  (event: 'update:config', config: MBeanDisplayConfig): void
}>()
const { t } = useI18n()
const search = ref(''), selected = ref(''), initialized = ref(false)
const browser = ref<HTMLElement>(), toolbar = ref<HTMLElement>(), directoryEntry = ref<HTMLElement>(), directoryOpen = ref(false)
const width = useDiagnosticWidth(browser), compact = computed(() => width.value > 0 && width.value <= 720)
const navigationVisible = computed(() => !compact.value || directoryOpen.value)
const navigationId = `mbean-directory-${getCurrentInstance()?.uid}`
const navigation = ref<HTMLDivElement>(), detail = ref<HTMLDivElement>()
const navigationReading = useRetainedScroll(navigation, () => props.active && navigationVisible.value), detailReading = useRetainedScroll(detail, () => props.active)
const localConfig = ref<MBeanDisplayConfig>({ expandedKeys: [], section: 'summary' })
const display = computed(() => props.config ?? localConfig.value)
const bean = computed(() => props.beans.find(item => item.objectName === selected.value))
const queryAccess = computed(() => ({ ...props.invokeAccess, allowed: props.invokeAccess.allowed && !['forbidden', 'unsupported'].includes(props.state.status) && !['forbidden', 'unsupported'].includes(props.detailState.status) }))
const queries = useMBeanQueryContext({ bean, target: computed(() => props.target), active: computed(() => props.active), access: queryAccess, busy: computed(() => props.busy), execute: computed(() => props.executeInvocation) })
const queryContext = queries.context
provide(mbeanRendererContextKey, queryContext)
const genericValue = shallowRef<unknown>(), genericOutcome = shallowRef<ViewState>({ status: 'ready' })
let genericIssued = false
const genericResult = computed(() => queries.resultSource.value === 'generic' ? genericValue.value : undefined)
const genericState = computed<ViewState>(() => queries.resultSource.value === 'generic' ? genericOutcome.value : { status: 'ready' })
/** 原通用确认表单继续走事件；独立保存结果来源，不能显示先前的摘要查询返回值。 */
function invokeGeneric(value: MBeanInvocation) {
  if (!props.active || !props.invokeAccess.allowed || queryContext.busy.value || !props.target) return
  queries.beginGenericInvocation(); genericIssued = true; genericValue.value = undefined; genericOutcome.value = { status: 'ready' }
  emit('invoke', value)
}
watch([() => props.result, () => props.resultState], () => {
  if (!genericIssued || queries.resultSource.value !== 'generic') return
  genericOutcome.value = props.resultState
  if (props.resultState.status !== 'loading') genericValue.value = props.result
})
watch([() => props.target, () => bean.value?.objectName, () => queryAccess.value.allowed], () => { genericIssued = false; genericValue.value = undefined; genericOutcome.value = { status: 'ready' } }, { flush: 'sync' })
const renderer = computed(() => bean.value && (resolveMBeanRenderer(bean.value) ?? (supportsMBeanSummary(bean.value) ? MBeanSummary : undefined)))
const section = computed(() => display.value.section === 'summary' && !renderer.value || display.value.section === 'operations' && !bean.value?.operations.length ? 'attributes' : display.value.section)
const description = computed(() => { const entry = bean.value && mbeanCatalogEntry(bean.value); return entry ? t(entry.descriptionKey) : '' })
function beanTitle(item: MBeanDescriptor) { const entry = mbeanCatalogEntry(item); return entry ? t(entry.nameKey, item.type) : item.type }
function matches(item: MBeanDescriptor) {
  const entry = mbeanCatalogEntry(item)
  const labels = entry ? ['zh', 'en'].flatMap(locale => [t(entry.nameKey, {}, { locale }), t(entry.descriptionKey, {}, { locale })]) : []
  return [item.objectName, item.name, ...labels].join(' ').toLowerCase().includes(search.value.trim().toLowerCase())
}
const tree = computed(() => {
  const domains = new Map<string, Map<string, MBeanDescriptor[]>>()
  for (const item of props.beans.filter(matches)) {
    if (!domains.has(item.domain)) domains.set(item.domain, new Map())
    const types = domains.get(item.domain)!
    if (!types.has(item.type)) types.set(item.type, [])
    types.get(item.type)!.push(item)
  }
  return [...domains].sort(([a], [b]) => compareMBeanDomain(a, b)).map(([domain, types]) => ({ key: mbeanGroupKey(domain), title: domain, selectable: false,
    children: [...types].sort(([a], [b]) => a.localeCompare(b)).map(([type, items]) => ({ key: mbeanGroupKey(domain, type), title: beanTitle(items[0]), technical: type, count: items.length, selectable: false,
      description: mbeanCatalogEntry(items[0]) ? t(mbeanCatalogEntry(items[0])!.descriptionKey) : undefined,
      children: items.sort((a, b) => a.name.localeCompare(b.name)).map(item => ({ key: item.objectName, title: item.name, isLeaf: true })) })) }))
})
const expanded = computed(() => search.value ? tree.value.flatMap(domain => [domain.key, ...domain.children.map(type => type.key)]) : display.value.expandedKeys)
function updateConfig(patch: Partial<MBeanDisplayConfig>) { const next = { ...display.value, ...patch }; localConfig.value = next; emit('update:config', next) }
function expand(keys: (string | number)[]) { if (!search.value) updateConfig({ expandedKeys: keys.map(String) }) }
function changeSection(value: string | number) { if (value === 'summary' || value === 'attributes' || value === 'operations') updateConfig({ section: value }) }
/** 专用摘要只请求切换现有页签；方法执行仍经过独立动作权限和确认。 */
function requestSection(value: unknown) { if (value === 'attributes' || value === 'summary' && renderer.value || value === 'operations' && bean.value?.operations.length) changeSection(String(value)) }
/** 只隐藏现有目录实例，保留搜索、展开和双轴阅读位置；键盘返回当前对象入口。 */
async function closeDirectory() {
  if (!compact.value || !directoryOpen.value) return
  directoryOpen.value = false
  await nextTick()
  directoryEntry.value?.querySelector<HTMLButtonElement>('button')?.focus()
}
/** Esc 覆盖入口、搜索及树；详情方法表单仍保有自身的取消行为。 */
function onDirectoryEscape(event: KeyboardEvent) {
  if (!compact.value || !directoryOpen.value) return
  const path = event.composedPath()
  if (![toolbar.value, navigation.value].some(element => element && path.includes(element))) return
  event.preventDefault(); event.stopPropagation()
  void closeDirectory()
}
function select(keys: (string | number)[]) { const next = String(keys[0] ?? selected.value); if (next !== selected.value) { selected.value = next; emit('select', next) }; void closeDirectory() }
/** 默认只展开 JetLinks；搜索的临时展开不覆盖用户浏览配置。 */
watch(() => props.beans, () => {
  if (!initialized.value && props.beans.length) {
    initialized.value = true
    if (!props.config) localConfig.value.expandedKeys = tree.value.filter(domain => isJetLinksDomain(domain.title)).flatMap(domain => [domain.key, ...domain.children.map(type => type.key)])
  }
}, { immediate: true })
watch([() => props.beans, () => props.selectedObject], () => {
  const next = props.beans.find(item => item.objectName === props.selectedObject)?.objectName ?? props.beans.find(item => item.objectName === selected.value)?.objectName ?? tree.value[0]?.children[0]?.children[0]?.key ?? ''
  if (next !== selected.value) { selected.value = next; if (next) emit('select', next) }
}, { immediate: true })
watch(selected, () => detailReading.reset(), { flush: 'sync' })
let revealGeneration = 0, revealFrame: number | undefined
/** 等待保留滚动位置恢复后，只在身份/目录恢复时将选中项移入视口；普通阅读滚动不触发。 */
watch([selected, () => props.active, navigationVisible, navigation], async () => {
  const current = ++revealGeneration
  if (revealFrame !== undefined) cancelAnimationFrame(revealFrame)
  if (!props.active || !navigationVisible.value || compact.value) return
  await nextTick()
  revealFrame = requestAnimationFrame(() => {
    revealFrame = undefined
    if (current === revealGeneration && navigation.value && revealMBeanSelection(navigation.value, selected.value)) navigationReading.onScroll()
  })
}, { flush: 'post' })
onScopeDispose(() => { revealGeneration++; if (revealFrame !== undefined) cancelAnimationFrame(revealFrame) })
watch(() => props.target, () => { navigationReading.reset(); detailReading.reset(); search.value = ''; directoryOpen.value = false; if (!props.config) { initialized.value = false; localConfig.value = { expandedKeys: [], section: 'summary' } } })
watch(() => props.state.status, value => { if (value === 'forbidden' || value === 'unsupported') { navigationReading.reset(); detailReading.reset() } }, { flush: 'sync' })
</script>
<style scoped>
.bean-browser { min-width:0; container-type:inline-size; }
.bean-directory-entry { flex:1; min-width:0; }
.bean-directory-entry :deep(.ant-btn) { display:flex; align-items:center; gap:6px; width:100%; }
.bean-directory-entry :deep(.ant-btn > span:not(.anticon)) { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; text-align:start; }
.bean-directory-entry :deep(.ant-btn > span + span) { margin-inline-start:0; }
.bean-workspace { display:grid; grid-template-columns:248px minmax(0,1fr); gap:16px; min-width:0; align-items:start; }
.bean-navigation { min-width:0; max-height:68vh; overflow:auto; border-inline-end:1px solid var(--line); padding-inline-end:8px; scrollbar-gutter:stable; }
.bean-navigation-content { width:max-content; min-width:100%; }
.bean-tree-title { display:inline-flex; align-items:baseline; gap:6px; white-space:nowrap; }
.bean-navigation :deep(.ant-tree-treenode),.bean-navigation :deep(.ant-tree-node-content-wrapper),.bean-navigation :deep(.ant-tree-title) { white-space:nowrap; }
.bean-navigation :deep(.ant-tree-node-content-wrapper) { flex-shrink:0; }
.bean-detail { min-width:0; max-height:68vh; overflow:auto; scrollbar-gutter:stable; }
.bean-tree-title small,.bean-count,.bean-heading p { color:var(--ink-3); font-size:var(--fs-caption,12px); }
.bean-tree-title small { font-weight:400; }
.bean-heading { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; }
.bean-heading > div { min-width:0; }
.bean-heading strong { font-size:var(--fs-title-4,16px); font-weight:600; }
.bean-heading p { margin:4px 0 8px; }
.bean-object-name { font-family:var(--font-mono,monospace); font-size:var(--fs-caption,12px); color:var(--ink-3); margin-bottom:4px; }
@container(max-width:720px) { .bean-workspace { grid-template-columns:minmax(0,1fr); gap:8px; }.bean-toolbar { gap:6px; margin-block:6px; }.bean-toolbar > .bean-search { order:3; width:100%; max-width:none; }.bean-navigation { max-height:320px; border-inline-end:0; border-bottom:1px solid var(--line); padding-block-end:8px; } }
</style>
