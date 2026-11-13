import { computed, nextTick, onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'
import { cloneDeep, isEqual } from 'lodash-es'
import { moveField } from './model'
import { formLabel, formText } from './text'
import { updateI18nText } from '../I18n/text'
import type { I18nTextMessages } from '../I18n/types'
import type { FormField, FormLayout, FormLayoutItem, FormSection, FormValues } from './types'

interface DesignerOptions {
  layout: () => FormLayout
  fields: () => FormField[]
  sampleValues: () => FormValues
  update: (layout: FormLayout) => void
  sectionLabel: () => Pick<FormSection, 'label' | 'i18nMessages'>
  locale: () => string
}

/** 编排只持有选择、布局撤销和指针状态，不保存字段定义或业务值。 */
export function useFormDesigner(options: DesignerOptions, root: Ref<HTMLElement | undefined>) {
  const selected = ref<string>()
  const settingsSide = ref<'left' | 'right'>('right')
  const sectionId = ref<string>()
  const titleKey = ref<string>()
  const titleDraft = ref('')
  const editingSection = ref<string>()
  const sectionDraft = ref('')
  const translationTarget = ref<{ kind: 'section' | 'field'; key: string }>()
  let titleLocale = ''
  let sectionLocale = ''
  const libraryOpen = ref(false)
  const preview = ref(false)
  const previewValues = shallowRef<FormValues>({})
  const history = shallowRef<FormLayout[]>([])
  const drop = ref<{ section: string; before?: string; target?: string; after?: boolean }>()
  const dragging = ref(false)
  let pointer: { id: number; x: number; y: number; key: string; node: HTMLElement } | undefined
  let suppressUntil = 0
  let sequence = 0
  const selectedField = computed(() => options.fields().find(field => field.key === selected.value))
  const selectedItem = computed(() => options.layout().sections.flatMap(section => section.items).find(item => item.key === selected.value))
  const translationSource = computed(() => translationTarget.value?.kind === 'section'
    ? options.layout().sections.find(section => section.id === translationTarget.value?.key)
    : options.layout().sections.flatMap(section => section.items).find(item => item.key === translationTarget.value?.key))
  const translationField = computed(() => translationTarget.value?.kind === 'field' ? options.fields().find(field => field.key === translationTarget.value?.key) : undefined)
  const translationDefault = computed(() => translationSource.value?.label ?? translationField.value?.label ?? '')
  const translationFallback = computed(() => translationSource.value?.label ? {} : translationField.value?.i18nMessages?.label ?? {})
  const translationLabel = computed(() => {
    const field = options.fields().find(field => field.key === translationTarget.value?.key)
    return translationTarget.value?.kind === 'field' && field && translationSource.value ? formLabel(field, translationSource.value as FormLayoutItem, options.locale()) : translationSource.value ? formText(translationSource.value, 'label', options.locale()) : ''
  })
  const available = computed(() => {
    const used = new Set(options.layout().sections.flatMap(section => section.items.map(item => item.key)))
    return options.fields().filter(field => !used.has(field.key))
  })

  function update(layout: FormLayout) {
    if (isEqual(layout, options.layout())) return
    history.value = [...history.value.slice(-19), cloneDeep(options.layout())]
    options.update(layout)
  }
  function undo() {
    const prior = history.value.at(-1)
    if (prior) { history.value = history.value.slice(0, -1); options.update(prior) }
  }
  function select(key: string) {
    if (Date.now() < suppressUntil) return
    finishTitle()
    selected.value = key
    sectionId.value = options.layout().sections.find(section => section.items.some(item => item.key === key))?.id
    nextTick(() => {
      const node = root.value
      if (!node) return
      const cell = [...node.querySelectorAll<HTMLElement>('[data-field-key]')].find(cell => cell.dataset.fieldKey === key)
      if (node.clientWidth > 600) {
        settingsSide.value = cell && cell.getBoundingClientRect().left > node.getBoundingClientRect().left + node.clientWidth / 2 ? 'left' : 'right'
        return
      }
      const scroller = node.querySelector<HTMLElement>('.fw-designer-scroll')
      const panel = node.querySelector<HTMLElement>('.fw-settings')
      if (scroller && cell && panel && cell.getBoundingClientRect().bottom > panel.getBoundingClientRect().top - 16) {
        scroller.scrollTop += cell.getBoundingClientRect().bottom - panel.getBoundingClientRect().top + 24
      }
    })
  }
  function addField(key: string) {
    if (Date.now() < suppressUntil) return
    let layout = options.layout()
    if (!layout.sections.length) layout = { ...layout, sections: [{ id: `section-${++sequence}`, ...options.sectionLabel(), items: [] }] }
    const target = layout.sections.find(section => section.id === sectionId.value)?.id ?? layout.sections[0].id
    update(moveField(layout, key, target))
    selected.value = key; sectionId.value = target; libraryOpen.value = false
    nextTick(() => select(key))
  }
  function addSection() {
    const existing = new Set(options.layout().sections.map(section => section.id))
    let id: string
    do { id = `section-${++sequence}` } while (existing.has(id))
    update({ ...options.layout(), sections: [...options.layout().sections, { id, ...options.sectionLabel(), items: [] }] })
    sectionId.value = id
  }
  function editSection(section: FormSection) {
    editingSection.value = section.id; sectionId.value = section.id
    sectionLocale = options.locale(); sectionDraft.value = formText(section, 'label', sectionLocale)
  }
  function finishSection() {
    const source = options.layout().sections.find(section => section.id === editingSection.value)
    if (source && sectionDraft.value.trim() && sectionDraft.value.trim() !== formText(source, 'label', sectionLocale)) {
      update({ ...options.layout(), sections: options.layout().sections.map(section => section === source
        ? { ...section, i18nMessages: { ...section.i18nMessages, label: updateI18nText(section.i18nMessages?.label, sectionLocale, sectionDraft.value) } } : section) })
    }
    editingSection.value = undefined
  }
  function removeSection(id: string) {
    update({ ...options.layout(), sections: options.layout().sections.filter(section => section.id !== id || section.items.length) })
  }
  function patchItem(patch: Partial<FormLayoutItem>) {
    update({ ...options.layout(), sections: options.layout().sections.map(section => ({ ...section, items: section.items.map(item => item.key === selected.value ? { ...item, ...patch } : item) })) })
  }
  function remove() {
    update({ ...options.layout(), sections: options.layout().sections.map(section => ({ ...section, items: section.items.filter(item => item.key !== selected.value) })) })
    selected.value = undefined; titleKey.value = undefined
  }
  function editTitle(key: string) {
    select(key)
    titleKey.value = key
    titleLocale = options.locale()
    titleDraft.value = selectedItem.value && selectedField.value ? formLabel(selectedField.value, selectedItem.value, titleLocale) : ''
    nextTick(() => {
      const input = root.value?.querySelector<HTMLInputElement>('.fw-title-input')
      input?.focus({ preventScroll: true }); input?.setSelectionRange(input.value.length, input.value.length)
    })
  }
  function finishTitle() {
    if (titleKey.value && selectedItem.value && selectedField.value && titleDraft.value.trim() && titleDraft.value.trim() !== formLabel(selectedField.value, selectedItem.value, titleLocale)) {
      patchItem({ i18nMessages: { ...selectedItem.value.i18nMessages, label: updateI18nText(selectedItem.value.i18nMessages?.label, titleLocale, titleDraft.value) } })
    }
    titleKey.value = undefined
  }
  function editTranslations(kind: 'section' | 'field', key: string) {
    finishTitle(); finishSection()
    translationTarget.value = { kind, key }
  }
  function saveTranslations(messages: I18nTextMessages) {
    const target = translationTarget.value
    if (!target) return
    if (isEqual(messages, translationSource.value?.i18nMessages?.label ?? {})) { translationTarget.value = undefined; return }
    const patch = <T extends { i18nMessages?: FormSection['i18nMessages'] }>(source: T): T => ({ ...source, i18nMessages: { ...source.i18nMessages, label: { ...messages } } })
    update({ ...options.layout(), sections: options.layout().sections.map(section => target.kind === 'section'
      ? section.id === target.key ? patch(section) : section
      : { ...section, items: section.items.map(item => item.key === target.key ? patch(item) : item) }) })
    translationTarget.value = undefined
  }
  // 在语言切换前按激活时的语言确认名称，避免把旧语言输入写到新语言。
  watch(options.locale, () => { finishTitle(); finishSection() }, { flush: 'sync' })
  function titleKeydown(event: KeyboardEvent) {
    if (event.isComposing || event.keyCode === 229) return
    if (event.key === 'Enter') { event.preventDefault(); finishTitle() }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); titleKey.value = undefined }
  }
  function togglePreview() {
    finishTitle(); selected.value = undefined
    preview.value = !preview.value
    if (preview.value) previewValues.value = cloneDeep(options.sampleValues())
  }
  function closeSettings() {
    const key = selected.value
    selected.value = undefined
    nextTick(() => [...(root.value?.querySelectorAll<HTMLElement>('[data-field-key]') ?? [])].find(cell => cell.dataset.fieldKey === key)?.querySelector<HTMLElement>('.fw-design-target')?.focus({ preventScroll: true }))
  }
  function canvasClick(event: MouseEvent) {
    if (!(event.target as Element).closest('[data-field-key], .fw-section-head, .fw-drop-empty, a, button, input')) closeSettings()
  }
  function shift(direction: -1 | 1) {
    const section = options.layout().sections.find(section => section.items.some(item => item.key === selected.value))
    if (!section || !selected.value) return
    const index = section.items.findIndex(item => item.key === selected.value)
    if (index + direction < 0 || index + direction >= section.items.length) return
    update(moveField(options.layout(), selected.value, section.id, section.items[index + (direction < 0 ? -1 : 2)]?.key))
  }
  function moveToSection(id: string) { if (selected.value) { update(moveField(options.layout(), selected.value, id)); sectionId.value = id } }
  function keydown(event: KeyboardEvent, key: string) {
    if ((event.target as HTMLElement).closest('input, textarea, [role="combobox"]')) return
    if (event.key === 'Escape') { clearPointer(); selected.value = undefined; return }
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); selected.value = key; remove() }
    if (event.altKey && ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(event.key)) { event.preventDefault(); selected.value = key; shift(event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1) }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(key) }
  }

  /** 鼠标可从区块拖动；触屏只从手柄启动，保留画布的正常纵向滚动。 */
  function pointerDown(event: PointerEvent, key: string) {
    if (event.button !== 0 || preview.value || (event.target as HTMLElement).closest('input, textarea, .ant-select')) return
    if (event.pointerType === 'touch' && !(event.target as HTMLElement).closest('.fw-drag-handle')) return
    if ((event.target as HTMLElement).closest('button:not(.fw-drag-handle)')) return
    const node = event.currentTarget as HTMLElement
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, key, node }
    node.setPointerCapture(event.pointerId)
  }
  function pointerMove(event: PointerEvent) {
    if (!pointer || pointer.id !== event.pointerId || Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 6) return
    dragging.value = true; titleKey.value = undefined
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-field-key], [data-section-id]')
    if (!target || !root.value?.contains(target)) { drop.value = undefined; return }
    const section = target.closest<HTMLElement>('[data-section-id]')?.dataset.sectionId
    if (!section) return
    const key = target.dataset.fieldKey
    const rect = target.getBoundingClientRect()
    const before = event.clientY < rect.top + rect.height * 0.25 || (event.clientY < rect.bottom - rect.height * 0.25 && event.clientX < rect.left + rect.width / 2)
    const items = options.layout().sections.find(entry => entry.id === section)?.items ?? []
    const index = items.findIndex(item => item.key === key)
    drop.value = { section, target: key, before: key ? (before ? key : items[index + 1]?.key) : undefined, after: !before }
  }
  function pointerUp(event: PointerEvent) {
    if (!pointer || pointer.id !== event.pointerId) return
    if (dragging.value && drop.value) update(moveField(options.layout(), pointer.key, drop.value.section, drop.value.before))
    if (dragging.value) { suppressUntil = Date.now() + 250; libraryOpen.value = false }
    clearPointer()
  }
  function clearPointer() {
    if (pointer?.node.hasPointerCapture(pointer.id)) pointer.node.releasePointerCapture(pointer.id)
    pointer = undefined; dragging.value = false; drop.value = undefined
  }
  onScopeDispose(clearPointer)

  return { selected, settingsSide, sectionId, selectedField, selectedItem, titleKey, titleDraft, editingSection, sectionDraft, translationTarget, translationSource, translationLabel, translationDefault, translationFallback, libraryOpen, preview, previewValues, history, available, drop, dragging, update, undo, select, addField, addSection, editSection, finishSection, removeSection, patchItem, remove, editTitle, finishTitle, titleKeydown, editTranslations, saveTranslations, togglePreview, closeSettings, canvasClick, shift, moveToSection, keydown, pointerDown, pointerMove, pointerUp, clearPointer }
}
