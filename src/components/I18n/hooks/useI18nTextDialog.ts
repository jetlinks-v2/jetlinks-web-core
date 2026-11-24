import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import type { ValidateErrorEntity } from 'ant-design-vue/es/form/interface'
import type { I18nTextDialogEmits, I18nTextDialogProps, I18nTextMessages } from '../types'
import { languageOptions } from '../../../locales/languages'

/** 管理独立弹窗草稿，校验通过后提交；取消不会修改调用方数据。 */
export function useI18nTextDialog(props: Readonly<I18nTextDialogProps>, emit: I18nTextDialogEmits) {
  const { t, locale } = useI18n()
  const formRef = ref<FormInstance>()
  const formData = reactive<I18nTextMessages>({})
  const languages = computed(() => languageOptions.map(language => ({ code: language.value, label: language.label })))
  const currentLanguage = computed(() => String(locale.value || 'zh').replace('_', '-').split('-')[0])
  const activeLanguage = ref('')
  const confirming = ref(false)
  let session = 0
  const rules = computed<Record<string, Rule[]>>(() => Object.fromEntries(languages.value.map(language => [
    language.code, [{ max: props.maxLength, message: t('I18n.maxLength', { max: props.maxLength }), trigger: 'blur' }],
  ])))

  /** 每次打开重建全部语言草稿，缺失译文保持空值，回退文本仅用于提示。 */
  function initFormData() {
    Object.keys(formData).forEach((language) => delete formData[language])
    Object.assign(formData, props.data ?? {})
    languages.value.forEach((language) => {
      formData[language.code] = props.data?.[language.code] || ''
    })
    activeLanguage.value = languages.value.some(language => language.code === currentLanguage.value)
      ? currentLanguage.value : languages.value[0]?.code ?? ''
  }

  watch(() => props.visible, (visible) => {
    session++
    confirming.value = false
    if (visible) initFormData()
  }, { immediate: true })
  onScopeDispose(() => { session++ })

  /** 取消只关闭并重置表单，不发出确认事件。 */
  function handleCancel() {
    session++
    confirming.value = false
    emit('update:visible', false)
    formRef.value?.resetFields()
  }

  /** 校验失败由表单显示错误并保持打开，成功时提交去空白后的文本。 */
  async function handleOk() {
    if (!props.visible || !formRef.value || confirming.value) return
    const currentSession = session
    confirming.value = true
    try {
      try {
        await formRef.value.validate()
      } catch (error) {
        if (currentSession !== session || !props.visible) return
        if (error && typeof error === 'object' && 'errorFields' in error) {
          const language = (error as ValidateErrorEntity<I18nTextMessages>).errorFields[0]?.name[0]
          if (typeof language === 'string' && languages.value.some(item => item.code === language)) activeLanguage.value = language
          return false
        }
        throw error
      }
      if (currentSession !== session || !props.visible) return
      const result: I18nTextMessages = {}
      Object.entries(formData).forEach(([language, value]) => {
        const text = value?.trim()
        if (text) result[language] = text
      })
      emit('confirm', result)
      emit('update:visible', false)
      return true
    } finally {
      if (currentSession === session) confirming.value = false
    }
  }

  return { formRef, formData, languages, activeLanguage, rules, confirming, handleCancel, handleOk }
}
