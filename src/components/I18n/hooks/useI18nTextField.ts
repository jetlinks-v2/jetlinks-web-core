import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { I18nTextFieldEmits, I18nTextFieldProps, I18nTextMessages } from '../types'

/** 同步主输入框与当前语言文本，仅通过事件更新调用方，不修改传入数据。 */
export function useI18nTextField(props: Readonly<I18nTextFieldProps>, emit: I18nTextFieldEmits) {
  const { t, locale } = useI18n()
  const visible = ref(false)
  const fieldI18nMessages = computed(() => props.i18nMessages?.[props.field] ?? {})
  const dialogTitle = computed(() => `${t('I18n.configure')} - ${props.label}`)
  const currentLanguage = computed(() => String(locale.value || 'zh').replace('_', '-').split('-')[0])

  /** 清空时删除当前语言翻译，保留其他语言和字段，确保清空可以持久化。 */
  function handleValueChange(value: string | undefined) {
    const nextValue = value ?? ''
    emit('update:value', nextValue)
    const messages = { ...(props.i18nMessages ?? {}) }
    const currentMessages = { ...(messages[props.field] ?? {}) }
    const text = nextValue.trim()
    if (text) {
      currentMessages[currentLanguage.value] = text
    } else {
      delete currentMessages[currentLanguage.value]
    }
    messages[props.field] = currentMessages
    emit('update:i18nMessages', messages)
  }

  /** 弹窗确认后按当前语言刷新主输入框，缺失时清空以避免残留旧值。 */
  function saveI18nMessages(messages: I18nTextMessages) {
    emit('update:i18nMessages', {
      ...(props.i18nMessages ?? {}),
      [props.field]: messages,
    })
    emit('update:value', messages[currentLanguage.value] ?? '')
  }

  return { visible, fieldI18nMessages, dialogTitle, handleValueChange, saveI18nMessages }
}
