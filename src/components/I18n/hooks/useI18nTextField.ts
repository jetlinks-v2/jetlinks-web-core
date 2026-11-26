import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { translatedI18nText, updateI18nText } from '../text'
import type { I18nMessages, I18nTextFieldEmits, I18nTextFieldProps, I18nTextMessages } from '../types'

/** 同步主输入框与当前语言文本，仅通过事件更新调用方，不修改传入数据。 */
export function useI18nTextField(props: Readonly<I18nTextFieldProps>, emit: I18nTextFieldEmits, changed?: (value: string, messages: I18nMessages) => void) {
  const { t, locale } = useI18n()
  const visible = ref(false)
  const fieldI18nMessages = computed(() => props.i18nMessages?.[props.field] ?? {})
  const dialogTitle = computed(() => `${t('I18n.configure')} - ${props.label}`)

  /** 清空时删除当前语言翻译，保留其他语言和字段，确保清空可以持久化。 */
  function handleValueChange(value: string | undefined) {
    const nextValue = value ?? ''
    emit('update:value', nextValue)
    const messages = { ...(props.i18nMessages ?? {}) }
    messages[props.field] = updateI18nText(messages[props.field], locale.value, nextValue)
    emit('update:i18nMessages', messages)
    changed?.(nextValue, messages)
  }

  /** 确认后同步当前语言，原位编辑可保留缺失翻译时的回退文本。 */
  function saveI18nMessages(messages: I18nTextMessages, fallbackValue = '') {
    const allMessages = {
      ...(props.i18nMessages ?? {}),
      [props.field]: messages,
    }
    emit('update:i18nMessages', allMessages)
    const value = translatedI18nText(messages, locale.value) ?? fallbackValue
    emit('update:value', value)
    changed?.(value, allMessages)
  }

  return { visible, fieldI18nMessages, dialogTitle, handleValueChange, saveI18nMessages }
}
