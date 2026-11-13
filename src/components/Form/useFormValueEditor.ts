import { computed, nextTick, ref, watch } from 'vue'
import dayjs, { type Dayjs } from 'dayjs'
import 'dayjs/locale/zh-cn'
import { useElementVisibility, useMediaQuery, watchOnce } from '@vueuse/core'
import { formLabel, formText } from './text'
import type { FormField, FormLayoutItem, FormOption } from './types'

interface EditorEvents {
  update: (value: unknown) => void
  confirm: () => void
  cancel: () => void
  navigate: (reverse: boolean) => void
}

/** 只适配基础控件事件和原位输入焦点；远端请求、验证与保存属于宿主及会话。 */
export function useFormValueEditor(props: { field: FormField; item?: FormLayoutItem; value?: unknown }, events: EditorEvents, locale: () => string, booleanLabels: () => string[]) {
  const root = ref<HTMLElement>()
  const inline = computed(() => ['text', 'textarea', 'number'].includes(props.field.type))
  const text = computed(() => props.value === null || props.value === undefined ? '' : String(props.value))
  const mobile = useMediaQuery('(max-width: 600px)')
  const overlayProps = computed(() => mobile.value
    ? { placement: 'bottom' as const, height: 'auto', title: props.item ? formLabel(props.field, props.item, locale()) : formText(props.field, 'label', locale()), rootClassName: 'fw-value-drawer', bodyStyle: { padding: 0 }, destroyOnClose: true, afterOpenChange: focusEditor }
    : { placement: 'bottomLeft' as const, trigger: 'click' as const, arrow: false, overlayClassName: 'fw-value-popover', overlayStyle: { maxWidth: 'calc(100vw - 24px)' } })
  // 未知选项继续展示和保留，直到用户明确移除；不因选项目录更新静默清空值。
  const optionPool = computed(() => {
    if (props.field.type === 'boolean') return [{ value: true, label: booleanLabels()[0] }, { value: false, label: booleanLabels()[1] }]
    const pool = [...(props.field.options ?? [])]
    const values = props.field.multiple ? (Array.isArray(props.value) ? props.value : []) : [props.value]
    for (const value of values) {
      if (['string', 'number', 'boolean'].includes(typeof value) && !pool.some(option => Object.is(option.value, value))) pool.push({ value: value as FormOption['value'], label: String(value) })
    }
    return pool
  })
  const options = computed(() => optionPool.value.map((option, index) => ({ value: String(index), option, label: formText(option, 'label', locale()) })))
  const query = ref('')
  const visibleOptions = computed(() => options.value.filter(option => option.label.toLocaleLowerCase(locale()).includes(query.value.trim().toLocaleLowerCase(locale()))))
  const editorStyle = computed(() => props.item?.editor && props.item.editor !== 'auto' ? props.item.editor : options.value.length <= 5 ? 'tags' : 'list')
  const selection = computed(() => {
    const values = props.field.multiple ? (Array.isArray(props.value) ? props.value : []) : [props.value]
    const keys = values.flatMap(value => {
      const index = optionPool.value.findIndex(option => Object.is(option.value, value))
      return index < 0 ? [] : [String(index)]
    })
    return props.field.multiple ? keys : keys[0]
  })
  const dateLocale = () => locale().toLowerCase().replace(/^zh$/, 'zh-cn')
  const date = computed(() => typeof props.value === 'string' && dayjs(props.value).isValid() ? dayjs(props.value).locale(dateLocale()) : undefined)

  // Popover内容先隐藏挂载，待实际可见再聚焦；Drawer沿用其打开完成事件。
  watch(root, node => { if (node && inline.value) focusEditor(true) }, { flush: 'post' })
  watchOnce(useElementVisibility(root), visible => { if (visible && !inline.value && !mobile.value) focusEditor(true) })
  async function focusEditor(open: boolean) {
    if (!open) return
    await nextTick()
    const node = root.value
    if (!node?.isConnected) return
    const input = (node.querySelector('input:checked') ?? node.querySelector('input, textarea')) as HTMLInputElement | HTMLTextAreaElement | null
    input?.focus({ preventScroll: true })
    if (input && (input instanceof HTMLTextAreaElement || input.type === 'text')) input.setSelectionRange(input.value.length, input.value.length)
  }
  function onKeydown(event: KeyboardEvent) {
    if (event.isComposing || event.keyCode === 229) return
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); events.cancel() }
    if (event.key === 'Enter' && (props.field.type !== 'textarea' || event.ctrlKey || event.metaKey)) { event.preventDefault(); events.confirm() }
    if (event.key === 'Tab') { event.preventDefault(); events.navigate(event.shiftKey) }
  }
  function onBlur(event: FocusEvent) {
    if (!root.value?.contains(event.relatedTarget as Node | null)) events.confirm()
  }
  function selectValue(value: string | string[] | undefined) {
    const keys = Array.isArray(value) ? value : value === undefined ? [] : [value]
    const values = keys.flatMap(key => {
      const option = optionPool.value[Number(key)]
      return option ? [option.value] : []
    })
    events.update(props.field.multiple ? values : values[0] ?? null)
  }
  function setDate(value: Dayjs | string | null | (Dayjs | string)[]) {
    // 日期直接采用DatePicker的选择/输入结果；日期时间沿用控件内置的确认。
    events.update(value && !Array.isArray(value) ? dayjs(value).format(props.field.type === 'datetime' ? 'YYYY-MM-DDTHH:mm:ss' : 'YYYY-MM-DD') : null)
    events.confirm()
  }
  return { root, inline, text, mobile, overlayProps, editorStyle, options, visibleOptions, query, selection, date, onKeydown, onBlur, selectValue, setDate }
}
