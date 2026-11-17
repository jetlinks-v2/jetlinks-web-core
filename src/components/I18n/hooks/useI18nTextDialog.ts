import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMediaQuery } from '@vueuse/core'
import { resolveI18nText } from '../text'
import type { I18nTextDialogEmits, I18nTextDialogProps, I18nTextMessages } from '../types'

/** 独立翻译草稿：切换语言不提交，应用一次回写，关闭丢弃本次输入。 */
export function useI18nTextDialog(props: Readonly<I18nTextDialogProps>, emit: I18nTextDialogEmits) {
  const { t, locale } = useI18n()
  const mobile = useMediaQuery('(max-width: 600px)')
  const editor = ref<{ focus: () => void }>()
  const formData = reactive<I18nTextMessages>({})
  const activeLanguage = ref('zh')
  const attempted = ref(false)
  let trigger: HTMLElement | null = null
  const currentLanguage = computed(() => {
    const current = String(locale.value || 'zh').replace(/_/g, '-').toLowerCase()
    return [...Object.keys(props.data ?? {}), ...Object.keys(props.fallbackMessages ?? {})].find(key => key.replace(/_/g, '-').toLowerCase() === current) ?? current.split('-')[0]
  })
  const languages = computed(() => [...new Set(['zh', 'en', ...Object.keys(props.data ?? {}), ...Object.keys(props.fallbackMessages ?? {}), currentLanguage.value])].map(code => ({
    code, label: code === 'zh' ? t('I18n.chinese') : code === 'en' ? t('I18n.english') : code,
  })))
  const invalidLanguage = computed(() => languages.value.find(language => (formData[language.code]?.length ?? 0) > (props.maxLength ?? 200))?.code)
  const error = computed(() => attempted.value && invalidLanguage.value ? t('I18n.maxLength', { max: props.maxLength ?? 200 }) : '')
  const defaultText = computed(() => resolveI18nText(props.displayValue, props.fallbackMessages, activeLanguage.value))
  const preview = computed(() => resolveI18nText(defaultText.value, formData, activeLanguage.value))
  const focusEditor = () => nextTick(() => editor.value?.focus())

  // 只在打开时初始化；保留额外语言，宿主刷新不会覆盖当前翻译草稿。
  watch(() => props.visible, visible => {
    if (!visible) return
    trigger = typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null
    Object.keys(formData).forEach(language => delete formData[language])
    Object.assign(formData, props.data ?? {})
    activeLanguage.value = currentLanguage.value
    if (!props.fallbackMessages && !formData[activeLanguage.value] && props.displayValue) formData[activeLanguage.value] = props.displayValue
    attempted.value = false
  }, { immediate: true })
  watch(activeLanguage, focusEditor)
  watch(editor, focusEditor, { flush: 'post' })

  function close() {
    emit('update:visible', false)
    // 调用方可能在确认事件中卸载面板；在DOM更新后归还到仍存在的触发项。
    nextTick(() => { if (trigger?.isConnected) trigger.focus({ preventScroll: true }) })
  }
  function handleCancel() { close() }
  function handleOk() {
    attempted.value = true
    if (invalidLanguage.value) { activeLanguage.value = invalidLanguage.value; focusEditor(); return }
    const result = Object.fromEntries(Object.entries(formData).flatMap(([language, value]) => value.trim() ? [[language, value.trim()]] : []))
    emit('confirm', result)
    close()
  }
  return { t, mobile, editor, formData, languages, activeLanguage, defaultText, preview, error, handleCancel, handleOk, focusEditor }
}
