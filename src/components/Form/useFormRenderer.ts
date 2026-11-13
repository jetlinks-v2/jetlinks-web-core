import { computed, nextTick, ref, watch, type Slots } from 'vue'
import { cloneDeep, isEqual } from 'lodash-es'
import { useFormSession } from './useFormSession'
import { useFormLocale } from './locale'
import type { FormAccess, FormField, FormLayout, FormSubmit, FormValidate, FormValues } from './types'

interface RendererProps {
  fields: FormField[]; layout: FormLayout; values: FormValues; access?: FormAccess
  readonly: boolean; submit?: FormSubmit; validate?: FormValidate
}
interface RendererEvents {
  change: (values: FormValues) => void
  saved: (values: FormValues) => void
  dirty: (dirty: boolean) => void
  externalChange: (keys: string[]) => void
}

/** 将激活中的输入与已确认草稿分开，避免焦点切换或离开页面丢失未确认值。 */
export function useFormRenderer(props: RendererProps, slots: Slots, events: RendererEvents) {
  const { t, text, label } = useFormLocale()
  const root = ref<HTMLElement>()
  const active = ref<string>()
  const draft = ref<unknown>()
  const editorHeight = ref(26)
  let activationRemote: unknown
  const session = useFormSession({
    fields: () => props.fields, layout: () => props.layout, values: () => props.values, access: () => props.access,
    readonly: () => props.readonly, submit: () => props.submit, validate: () => props.validate,
    requiredMessage: () => t('required'), failedMessage: () => t('failed'),
    change: events.change, saved: events.saved, externalChange: events.externalChange,
  })
  const errorCount = computed(() => Object.values(session.errors.value).filter(Boolean).length)
  const firstError = computed(() => Object.values(session.errors.value).find(Boolean))
  const dirtyCount = computed(() => session.dirty.value + (active.value && !Object.hasOwn(session.changes.value, active.value) && !isEqual(normalizedDraft(), session.value(active.value)) ? 1 : 0))
  const editable = (field: FormField) => session.canWrite(field.key) && !session.saving.value && (field.type !== 'custom' || !!slots[`editor-${field.renderer || field.key}`])
  const updateDraft = (value: unknown) => { draft.value = value }
  watch(() => !!dirtyCount.value, events.dirty)
  watch(() => active.value && session.canWrite(active.value), allowed => { if (!allowed) active.value = undefined })
  watch(() => props.values, values => {
    if (!active.value || !session.canWrite(active.value)) return
    const incoming = values[active.value]
    if (!isEqual(incoming, activationRemote) && !isEqual(incoming, normalizedDraft())) events.externalChange([active.value])
    activationRemote = cloneDeep(incoming)
  }, { deep: true })

  function normalizedDraft() {
    const field = props.fields.find(field => field.key === active.value)
    if (field?.type === 'number' && typeof draft.value === 'string') return draft.value.trim() === '' ? null : Number(draft.value)
    return draft.value
  }
  /** 切换字段前确认当前输入；校验失败保留编辑器和输入。 */
  function begin(field: FormField) {
    if (!editable(field) || active.value === field.key || !confirm()) return
    const cell = [...(root.value?.querySelectorAll<HTMLElement>('[data-field-key]') ?? [])].find(node => node.dataset.fieldKey === field.key)
    editorHeight.value = cell?.querySelector('.fw-value')?.getBoundingClientRect().height ?? 26
    draft.value = cloneDeep(session.value(field.key))
    activationRemote = cloneDeep(props.values[field.key])
    active.value = field.key
  }
  function confirm() {
    if (!active.value) return true
    const value = normalizedDraft()
    if (typeof value === 'number' && !Number.isFinite(value)) {
      session.errors.value = { ...session.errors.value, [active.value]: t('invalidNumber') }
      nextTick(focusActive)
      return false
    }
    if (!session.commit(active.value, value)) { nextTick(focusActive); return false }
    active.value = undefined
    return true
  }
  function focusActive() { root.value?.querySelector<HTMLElement>('[data-editor] input, [data-editor] textarea')?.focus({ preventScroll: true }) }
  /** 自定义展示中的链接/按钮保留原行为；只处理值槽自身的编辑激活。 */
  function activateValue(event: MouseEvent | KeyboardEvent, field: FormField) {
    if (!editable(field) || field.type === 'custom') return
    if ((event.target as Element).closest('a, button, input, textarea, select, [role="link"], [contenteditable="true"]')) return
    if (event instanceof KeyboardEvent) {
      if (event.target !== event.currentTarget || event.isComposing || !['Enter', ' '].includes(event.key)) return
      event.preventDefault()
    }
    begin(field)
  }
  function activeKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || event.isComposing || event.keyCode === 229) return
    event.preventDefault(); event.stopPropagation(); cancel()
  }
  function focusField(key?: string) {
    const cell = [...(root.value?.querySelectorAll<HTMLElement>('[data-field-key]') ?? [])].find(node => node.dataset.fieldKey === key)
    cell?.querySelector<HTMLElement>('.fw-value-target > [role="button"], .fw-edit-icon')?.focus({ preventScroll: true })
  }
  /** 显式完成选择后回到字段；原位输入的失焦确认不抢走下一个控件的焦点。 */
  function confirmEditor() {
    const field = props.fields.find(field => field.key === active.value)
    if (confirm() && field && !['text', 'textarea', 'number'].includes(field.type)) nextTick(() => focusField(field.key))
  }
  function cancel() {
    const key = active.value
    active.value = undefined
    if (key) { const errors = { ...session.errors.value }; delete errors[key]; session.errors.value = errors }
    nextTick(() => focusField(key))
  }
  function navigate(reverse: boolean) {
    const key = active.value
    if (!confirm()) return
    const keys = props.layout.sections.flatMap(section => section.items.map(item => item.key)).filter(key => props.fields.some(field => field.key === key && editable(field)))
    const index = keys.indexOf(key ?? '') + (reverse ? -1 : 1)
    const field = props.fields.find(field => field.key === keys[index])
    if (field) begin(field)
    else nextTick(() => focusField(key))
  }
  function restoreField(key: string) { if (active.value === key) active.value = undefined; session.restore(key) }
  function restoreAll() { active.value = undefined; session.restore() }
  async function save() { if (confirm()) await session.save() }

  return { t, text, label, root, active, draft, editorHeight, session, dirtyCount, errorCount, firstError, editable, updateDraft, begin, activateValue, activeKeydown, confirm, confirmEditor, cancel, navigate, restoreField, restoreAll, save }
}
