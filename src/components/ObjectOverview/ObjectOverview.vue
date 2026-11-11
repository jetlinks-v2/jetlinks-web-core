<script setup lang="ts">
import { computed, h, ref, shallowRef, toRef, watch } from 'vue'
import { Modal } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import { PlusOutlined, EditOutlined, ReloadOutlined, MoreOutlined } from '@ant-design/icons-vue'
import { DashBoardCanvas } from '../DashBoardCanvas'
import type { DashboardCatalog, DashboardValue } from '../DashBoardCanvas/types'
import ObjectContentGroup, { type ObjectContentEntry } from './ObjectContentGroup.vue'
import ObjectCapabilityPicker from './ObjectCapabilityPicker.vue'
import { objectOverviewMessages } from './messages'
import { useObjectCapabilities } from '../../object-capability/useObjectCapabilities'
import { useObjectRelatedData } from '../../object-capability/useObjectRelatedData'
import { useObjectViews, type ObjectViewStore } from '../../object-capability/views'
import { useObjectMemberPresentations } from '../../object-capability/useObjectMemberPresentations'
import { objectCapabilityId, sameObjectMember } from '../../object-capability/metadata'
import { dashboardSelections, isCurrentSelection, objectDashboardHeight, objectDefaultDashboard, selectionKey, type ObjectContentWidget } from '../../object-capability/dashboard'
import type { ObjectMemberSelection, ObjectReference } from '../../object-capability/types'
import type { VariableObjectSpec } from '../../types/relation'

const props = withDefaults(defineProps<{ object?: ObjectReference; store?: ObjectViewStore; viewId?: string; active?: boolean }>(), { active: true })
const { t } = useI18n({ useScope: 'local', messages: objectOverviewMessages })
const selected = shallowRef<string[]>([])
const capability = useObjectCapabilities(toRef(props, 'object'), { selected })
const defaults = computed(() => objectDefaultDashboard(capability.members.value, { data: t('data'), actions: t('operations') }))
const view = useObjectViews(toRef(props, 'object'), defaults, toRef(props, 'store'), toRef(props, 'viewId'))
watch(view.editing, editing => { if (editing && !view.name.value) view.name.value = t('newView') })
const selections = computed(() => dashboardSelections(view.value.value))
watch(selections, items => { selected.value = [...new Set(items.filter(item => isCurrentSelection(item) && item.member.kind !== 'action').map(item => objectCapabilityId(item.member)))] }, { immediate: true })
const ready = computed(() => !capability.loading.value && !capability.failed.value && Boolean(props.object))
const canvasHeight = computed(() => objectDashboardHeight(view.value.value))
const loading = computed(() => capability.loading.value || (view.busy.value && !view.loaded.value))
const canCustomize = computed(() => ready.value && Boolean(props.store) && view.loaded.value)
const related = useObjectRelatedData(selections, ready, capability.getRuntime)
const presentations = useObjectMemberPresentations(computed(() => props.object?.type))
const catalog = computed<DashboardCatalog>(() => ({ groups: [{ id: 'object', name: t('add') }], components: Object.fromEntries([
  ['object-data', t('data')], ['object-actions', t('operations')],
].map(([type, name]) => [type, { component: ObjectContentGroup, configs: [], groupId: 'object', defaultConfig: {
  type, name, componentProps: { gridItem: { w: 12, h: 6, minW: 4, minH: 3 }, selections: [] },
} }])) }))
const pickerOpen = ref(false), pickerObject = ref<VariableObjectSpec>()
const pickerOptions = computed(() => ({ origins: props.object ? [{ key: 'object', label: props.object.name || t('currentObject'),
  root: { objectType: props.object.type, objectSource: { source: 'upper' as const, upperKey: 'object' } } }] : [] }))
function openPicker() { pickerObject.value = pickerOptions.value.origins[0]?.root; pickerOpen.value = true }
function add(selection: ObjectMemberSelection) {
  const type = selection.member.kind === 'action' ? 'object-actions' : 'object-data'
  const value = view.draft.value
  const widget = value.components.find(item => item.type === type) as ObjectContentWidget | undefined
  const exists = widget?.componentProps.selections || []
  if (exists.some(item => selectionKey(item) === selectionKey(selection))) return
  if (widget) view.draft.value = { ...value, components: value.components.map(item => item.id === widget.id
    ? { ...widget, componentProps: { ...widget.componentProps, selections: [...exists, selection] } } : item) }
  else view.draft.value = { ...value, components: [...value.components, { id: crypto.randomUUID(), type,
    name: t(type === 'object-data' ? 'data' : 'operations'), componentProps: { selections: [selection], gridItem: {
      x: 0, y: Math.max(0, ...value.components.map(item => Number(item.componentProps.gridItem?.y || 0) + Number(item.componentProps.gridItem?.h || 6))), w: 12, h: 6,
    } } }] }
}
function entries(widget: ObjectContentWidget): ObjectContentEntry[] {
  return (widget.componentProps.selections || []).map(selection => {
    const direct = isCurrentSelection(selection)
    const member = (direct ? capability.members.value : related.members.value).find(item => sameObjectMember(item.ref, selection.member))
    return { selection, member, related: !direct, presentation: presentations.value.find(item => item.ref.providerId === selection.member.providerId && item.ref.id === selection.member.id && item.ref.kind === selection.member.kind),
      state: !member ? { status: ready.value ? 'failed' : 'loading' }
        : selection.member.kind === 'action' ? { status: 'ready' }
          : direct ? capability.values.value[objectCapabilityId(selection.member)] || { status: 'loading' }
            : related.states.value[selectionKey(selection)] || { status: 'loading' } }
  })
}
function update(value: DashboardValue) { if (view.editing.value) view.draft.value = value }
function refresh() {
  void capability.refresh()
  if (view.failure.value === 'load') void view.reload()
}
function select(id?: string) {
  void beforeLeave().then(leave => { if (leave) view.select(id) })
}
function beforeLeave(): Promise<boolean> {
  if (view.pendingDrafts.value) return new Promise(resolve => {
    Modal.confirm({ title: t('unsaved'), content: t('otherDrafts'), okText: t('discard'), cancelText: t('continueEditing'),
      onOk: () => { view.discardAll(); resolve(true) }, onCancel: () => resolve(false) })
  })
  if (!view.editing.value) return Promise.resolve(true)
  return new Promise(resolve => {
    const dialog = Modal.confirm({ title: t('unsaved'), okText: t('save'), cancelText: t('continueEditing'),
      onOk: async () => { if (!await view.save()) throw new Error(t('saveFailed')); resolve(true) },
      onCancel: () => resolve(false),
      content: () => h('button', { type: 'button', onClick: () => { view.cancel(); dialog.destroy(); resolve(true) } }, t('discard')) })
  })
}
defineExpose({ beforeLeave })
function remove() { Modal.confirm({ title: t('remove'), onOk: view.remove }) }
async function newView() { if (await beforeLeave()) { view.select(); view.edit() } }
function removeSelection(widget: ObjectContentWidget, selection: ObjectMemberSelection) {
  view.draft.value = { ...view.draft.value, components: view.draft.value.components.map(item => item.id === widget.id
    ? { ...item, componentProps: { ...item.componentProps, selections: widget.componentProps.selections?.filter(value => selectionKey(value) !== selectionKey(selection)) } } : item) }
}
</script>
<template>
  <section class="object-overview" :aria-busy="capability.loading.value || view.busy.value">
    <header class="object-overview__toolbar">
      <a-select v-if="store && view.loaded.value" :value="view.currentId.value || ''" :disabled="view.busy.value" class="object-overview__views" @change="select(typeof $event === 'string' ? $event || undefined : undefined)">
        <a-select-option value="">{{ t('view') }}</a-select-option>
        <a-select-option v-for="item in view.views.value" :key="item.id" :value="item.id">{{ item.name }}{{ item.id === view.defaultId.value ? ' ★' : '' }}</a-select-option>
      </a-select>
      <strong v-else>{{ t('view') }}</strong>
      <a-space v-if="view.editing.value" wrap :size="4">
        <a-input v-model:value="view.name.value" :maxlength="128" :placeholder="t('name')" class="object-overview__name" />
        <a-button type="primary" :loading="view.busy.value" :disabled="!view.loaded.value || !view.name.value.trim()" @click="view.save()">{{ t('save') }}</a-button>
        <a-button v-if="view.currentId.value" :disabled="!view.loaded.value || view.busy.value || !view.name.value.trim()" @click="view.save(true)">{{ t('saveAs') }}</a-button>
        <a-button :disabled="view.busy.value" @click="view.cancel">{{ t('cancel') }}</a-button>
      </a-space>
      <a-space v-else :size="4">
        <slot name="actions" />
        <a-tooltip :title="t('retry')"><a-button type="text" :disabled="loading || view.busy.value" :aria-label="t('retry')" @click="refresh"><ReloadOutlined /></a-button></a-tooltip>
        <a-button v-if="canCustomize" type="text" @click="view.edit"><EditOutlined />{{ t('customize') }}</a-button>
        <a-dropdown v-if="canCustomize"><a-button type="text" :aria-label="t('more')"><MoreOutlined /></a-button><template #overlay><a-menu>
          <a-menu-item @click="newView">{{ t('newView') }}</a-menu-item>
          <a-menu-item v-if="view.currentId.value" @click="view.setDefault">{{ t('setDefault') }}</a-menu-item><a-menu-item v-if="view.currentId.value" danger @click="remove">{{ t('remove') }}</a-menu-item>
        </a-menu></template></a-dropdown>
      </a-space>
    </header>
    <a-alert v-if="ready && view.failed.value" type="warning" show-icon :message="t(view.failure.value === 'load' ? 'viewLoadFailed' : view.failure.value === 'save' ? 'saveFailed' : 'viewUpdateFailed')">
      <template v-if="view.failure.value === 'load'" #action><a-button type="link" size="small" :loading="view.busy.value" @click="view.reload">{{ t('retry') }}</a-button></template>
    </a-alert>
    <div v-if="view.editing.value" class="object-overview__editing"><a-button @click="openPicker"><PlusOutlined />{{ t('add') }}</a-button><a-button type="text" @click="view.reset">{{ t('reset') }}</a-button></div>
    <a-skeleton v-if="loading" active :title="false" :paragraph="{ rows: 2 }" />
    <a-alert v-else-if="capability.failed.value" type="warning" show-icon :message="t('dataLoadFailed')">
      <template #action><a-button type="link" size="small" @click="capability.refresh">{{ t('retry') }}</a-button></template>
    </a-alert>
    <template v-else-if="ready">
      <div v-if="canvasHeight || view.editing.value" class="object-overview__canvas" :class="{ 'object-overview__canvas--editing': view.editing.value }" :style="{ height: `${canvasHeight}px` }">
        <DashBoardCanvas :model-value="view.value.value" :catalog="catalog" :editable="view.editing.value" :layout-editable="view.editing.value" :preview-mode="view.editing.value" @update:model-value="update">
          <template #widget="{ widget }">
            <ObjectContentGroup v-if="catalog.components[widget.type]" :title="widget.name" :entries="entries(widget)" :preview="view.editing.value || !active" :runtime="capability.getRuntime" @retry="capability.refresh" @add="openPicker" />
            <a-alert v-else type="warning" :message="t('unavailable')" />
            <div v-if="view.editing.value" class="object-overview__selection-tools"><a-tag v-for="entry in entries(widget)" :key="selectionKey(entry.selection)" closable @close="removeSelection(widget, entry.selection)">{{ entry.member?.name || entry.selection.member.id }}</a-tag></div>
          </template>
        </DashBoardCanvas>
      </div>
      <p v-else class="object-overview__empty" role="status">{{ t('empty') }}</p>
    </template>
    <slot />
    <a-modal v-model:open="pickerOpen" :title="t('add')" :footer="null" :width="640" destroy-on-close>
      <ObjectCapabilityPicker v-model:object="pickerObject" :context-object="object" :options="pickerOptions" @select="add" />
    </a-modal>
  </section>
</template>
<style scoped>
.object-overview { display: grid; gap: 12px; min-width: 0; }.object-overview__toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.object-overview__views { min-width: 120px; max-width: 220px; }.object-overview__name { width: 150px; }.object-overview__editing { display: flex; gap: 8px; }
.object-overview__canvas { min-width: 0; }.object-overview__canvas--editing { min-height: 360px; }
.object-overview__empty { margin: 0; padding: 12px 0; color: var(--ant-color-text-secondary); }
.object-overview__selection-tools { position: absolute; bottom: 4px; left: 12px; right: 12px; display: flex; flex-wrap: wrap; gap: 4px; }
.object-overview :deep(.dashboard-setting-dock) { display: none; }
@media (max-width: 600px) { .object-overview__toolbar { align-items: flex-start; } }
</style>
