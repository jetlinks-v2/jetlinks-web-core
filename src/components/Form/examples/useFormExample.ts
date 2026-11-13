import { computed, ref, shallowRef } from 'vue'
import { cloneDeep } from 'lodash-es'
import { useFormExampleLocale } from './locale'
import type { FormAccess, FormField, FormLayout, FormSubmit, FormValues } from '../types'

const objectFields: FormField[] = [
  { key: 'name', label: '设备名称', i18nMessages: { label: { zh: '设备名称', en: 'Device name' } }, type: 'text', required: true },
  { key: 'code', label: '设备编号', i18nMessages: { label: { zh: '设备编号', en: 'Device code' } }, type: 'text', readonly: true },
  { key: 'maintenance.height', label: '安装高度', type: 'number', unit: 'm', description: '相对地面的安装高度', i18nMessages: { label: { zh: '安装高度', en: 'Installation height' }, description: { zh: '相对地面的安装高度', en: 'Height above ground' }, unit: { zh: 'm', en: 'm' } } },
  { key: 'installedOn', label: '安装日期', i18nMessages: { label: { zh: '安装日期', en: 'Installation date' } }, type: 'date' },
  { key: 'location', label: '安装位置', i18nMessages: { label: { zh: '安装位置', en: 'Location' } }, type: 'textarea' },
  { key: 'protection', label: '防护等级', i18nMessages: { label: { zh: '防护等级', en: 'Protection rating' } }, type: 'enum', options: [{ value: 'IP65', label: 'IP65', color: 'blue' }, { value: 'IP67', label: 'IP67', color: 'green' }] },
  { key: 'features', label: '功能特性', i18nMessages: { label: { zh: '功能特性', en: 'Features' } }, type: 'enum', multiple: true, options: [{ value: 1, label: '远程维护', i18nMessages: { label: { zh: '远程维护', en: 'Remote maintenance' } } }, { value: 2, label: '状态上报', i18nMessages: { label: { zh: '状态上报', en: 'Status reporting' } } }, { value: 3, label: '离线缓存', i18nMessages: { label: { zh: '离线缓存', en: 'Offline cache' } } }] },
  { key: 'enabled', label: '自动巡检', i18nMessages: { label: { zh: '自动巡检', en: 'Automatic inspection' } }, type: 'boolean' },
  { key: 'settings', label: '采样策略', i18nMessages: { label: { zh: '采样策略', en: 'Sampling policy' } }, type: 'custom', renderer: 'sampling' },
  { key: 'cost', label: '采购成本', type: 'number', unit: '元', i18nMessages: { label: { zh: '采购成本', en: 'Purchase cost' }, unit: { zh: '元', en: 'CNY' } } },
  { key: 'internalNote', label: '内部备注', i18nMessages: { label: { zh: '内部备注', en: 'Internal note' } }, type: 'text' },
  { key: 'notes', label: '补充说明', i18nMessages: { label: { zh: '补充说明', en: 'Additional notes' } }, type: 'textarea' },
]
const workflowFields: FormField[] = [
  { key: 'title', label: '申请事项', i18nMessages: { label: { zh: '申请事项', en: 'Request title' } }, type: 'text', required: true },
  { key: 'priority', label: '处理优先级', i18nMessages: { label: { zh: '处理优先级', en: 'Priority' } }, type: 'enum', options: [{ value: 0, label: '普通', i18nMessages: { label: { zh: '普通', en: 'Normal' } } }, { value: 1, label: '紧急', i18nMessages: { label: { zh: '紧急', en: 'Urgent' } }, color: 'orange' }] },
  { key: 'reason', label: '申请说明', i18nMessages: { label: { zh: '申请说明', en: 'Reason' } }, type: 'textarea', required: true },
  { key: 'budget', label: '预计费用', i18nMessages: { label: { zh: '预计费用', en: 'Estimated cost' } }, type: 'number', unit: '元' },
  { key: 'deadline', label: '期望完成时间', i18nMessages: { label: { zh: '期望完成时间', en: 'Expected completion' } }, type: 'datetime' },
  { key: 'approved', label: '已审核', i18nMessages: { label: { zh: '已审核', en: 'Reviewed' } }, type: 'boolean', readonly: true },
]
const objectLayout: FormLayout = { version: 1, sections: [
  { id: 'identity', label: '基本信息', i18nMessages: { label: { zh: '基本信息', en: 'Basic information' } }, items: [{ key: 'name' }, { key: 'code' }] },
  { id: 'installation', label: '安装信息', i18nMessages: { label: { zh: '安装信息', en: 'Installation' } }, items: [{ key: 'maintenance.height' }, { key: 'installedOn' }, { key: 'location' }, { key: 'protection' }] },
  { id: 'capabilities', label: '运行与维护', i18nMessages: { label: { zh: '运行与维护', en: 'Operation and maintenance' } }, items: [{ key: 'features' }, { key: 'enabled' }, { key: 'settings' }, { key: 'cost', thousands: true }, { key: 'internalNote' }] },
] }
const workflowLayout: FormLayout = { version: 1, sections: [{ id: 'request', label: '申请信息', i18nMessages: { label: { zh: '申请信息', en: 'Request information' } }, items: [{ key: 'title' }, { key: 'priority' }, { key: 'reason', span: 2 }, { key: 'budget', thousands: true }, { key: 'deadline' }, { key: 'approved' }] }] }

/** 示例宿主负责来源投影、发布、授权与业务payload，组件不感知这些约定。 */
export function useFormExample() {
  const { t } = useFormExampleLocale()
  const scene = ref('object')
  const mode = ref('design')
  const epoch = ref(0)
  const layout = shallowRef<FormLayout>(cloneDeep(objectLayout))
  const published = shallowRef<FormLayout>(cloneDeep(objectLayout))
  const draft = shallowRef<FormLayout>()
  const restricted = ref(false)
  const revoke = ref(false)
  const failNext = ref(false)
  const readonly = ref(false)
  const dirty = ref(false)
  const status = ref('')
  const json = ref('')
  const jsonError = ref('')
  const lastPayload = ref('')
  const entity = ref({ name: '一号车间环境传感器', code: 'TH-2026-0916', maintenance: { height: 12.523345 }, installedOn: '2026-09-16', location: '一号车间 · A 区', protection: 'IP65', features: [1, 2], enabled: true, settings: { interval: 30 }, cost: 16800, internalNote: '定期核对标定值', notes: '' })
  const workflow = ref<FormValues>({ title: '传感器检修申请', priority: 0, reason: '更换过滤组件并复核安装位置。', budget: 0, deadline: '2026-11-20T14:00:00', approved: false })
  const fields = computed(() => scene.value === 'object' ? objectFields : workflowFields)
  const access = computed<FormAccess>(() => scene.value === 'object' ? { cost: restricted.value ? 'denied' : 'write', internalNote: restricted.value ? 'hidden' : 'write', 'maintenance.height': revoke.value ? 'read' : 'write' } : {})
  const values = computed<FormValues>(() => {
    const all = scene.value === 'object' ? { ...entity.value, 'maintenance.height': entity.value.maintenance.height } : workflow.value
    return Object.fromEntries(fields.value.filter(field => access.value[field.key] !== 'denied' && access.value[field.key] !== 'hidden').map(field => [field.key, all[field.key as keyof typeof all]]))
  })
  const submit: FormSubmit = async changes => {
    const requestedEpoch = epoch.value
    await new Promise(resolve => setTimeout(resolve, 350))
    if (requestedEpoch !== epoch.value) return
    if (failNext.value) { failNext.value = false; throw new Error(t('failed')) }
    if (typeof changes['maintenance.height'] === 'number' && changes['maintenance.height'] < 0) return { errors: { 'maintenance.height': t('heightError') } }
    if (scene.value === 'object') {
      const payload = Object.fromEntries(Object.entries(changes).filter(([key]) => key !== 'maintenance.height'))
      if (Object.hasOwn(changes, 'maintenance.height')) payload.maintenance = { height: changes['maintenance.height'] }
      lastPayload.value = JSON.stringify(payload, null, 2)
      entity.value = { ...entity.value, ...payload, maintenance: { ...entity.value.maintenance, ...(payload.maintenance as object ?? {}) } }
    } else {
      workflow.value = { ...workflow.value, ...changes }
      lastPayload.value = JSON.stringify(changes, null, 2)
    }
    status.value = 'saved'
  }
  function switchScene(next: string) {
    scene.value = next; epoch.value++; dirty.value = false; revoke.value = false
    layout.value = cloneDeep(next === 'object' ? objectLayout : workflowLayout)
    published.value = cloneDeep(layout.value); draft.value = undefined
    lastPayload.value = ''; status.value = ''; mode.value = 'design'
  }
  function setMode(next: string) {
    if (dirty.value && next !== mode.value && !window.confirm(t('leave'))) return
    mode.value = next; epoch.value++; dirty.value = false
    if (next === 'json') json.value = JSON.stringify(layout.value, null, 2)
  }
  function saveDraft() { draft.value = cloneDeep(layout.value); status.value = 'draftSaved' }
  function restoreDraft() { if (draft.value) layout.value = cloneDeep(draft.value) }
  function publish() { published.value = cloneDeep(layout.value); status.value = 'published'; setMode('use') }
  function importJson() {
    try {
      const value: unknown = JSON.parse(json.value)
      if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1 || !('sections' in value) || !Array.isArray(value.sections)) throw new Error(t('jsonStructure'))
      const valid = value.sections.every(section => typeof section?.id === 'string' && typeof section?.label === 'string' && Array.isArray(section.items) && section.items.every((item: { key?: unknown }) => typeof item?.key === 'string'))
      if (!valid) throw new Error(t('jsonFields'))
      layout.value = value as FormLayout; jsonError.value = ''; setMode('design')
    } catch (error) { jsonError.value = error instanceof Error ? error.message : t('jsonInvalid') }
  }
  const bindings = computed(() => mode.value === 'design'
    ? { fields: fields.value, layout: layout.value, sampleValues: values.value }
    : { fields: fields.value, layout: published.value, values: values.value, access: access.value, readonly: readonly.value, submit })
  return { t, scene, mode, epoch, layout, draft, restricted, revoke, failNext, readonly, dirty, status, json, jsonError, lastPayload, fields, values, bindings, switchScene, setMode, saveDraft, restoreDraft, publish, importJson }
}
