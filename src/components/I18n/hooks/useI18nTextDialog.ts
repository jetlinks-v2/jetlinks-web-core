import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import type { I18nTextDialogEmits, I18nTextDialogProps, I18nTextMessages } from '../types'

/** 管理独立弹窗草稿，校验通过后提交；取消不会修改调用方数据。 */
export function useI18nTextDialog(props: Readonly<I18nTextDialogProps>, emit: I18nTextDialogEmits) {
  const { t, locale } = useI18n()
  const formRef = ref<FormInstance>()
  const formData = reactive<I18nTextMessages>({})
  const languages = computed(() => [
    { code: 'zh', label: t('I18n.chinese') },
    { code: 'en', label: t('I18n.english') },
  ])
  const currentLanguage = computed(() => String(locale.value || 'zh').replace('_', '-').split('-')[0])
  const rules = computed<Record<string, Rule[]>>(() => ({
    zh: [{ max: props.maxLength, message: t('I18n.maxLength', { max: props.maxLength }), trigger: 'blur' }],
    en: [{ max: props.maxLength, message: t('I18n.maxLength', { max: props.maxLength }), trigger: 'blur' }],
  }))

  /** 每次打开重建草稿，并保留未提供编辑控件的语言；缺少当前语言时回填展示值。 */
  function initFormData() {
    Object.keys(formData).forEach((language) => delete formData[language])
    Object.assign(formData, props.data ?? {})
    languages.value.forEach((language) => {
      formData[language.code] = props.data?.[language.code] || ''
    })
    if (!formData[currentLanguage.value] && props.displayValue) {
      formData[currentLanguage.value] = props.displayValue
    }
  }

  watch(() => props.visible, (visible) => {
    if (visible) initFormData()
  }, { immediate: true })

  /** 取消只关闭并重置表单，不发出确认事件。 */
  function handleCancel() {
    emit('update:visible', false)
    formRef.value?.resetFields()
  }

  /** 校验失败由表单显示错误并保持打开，成功时提交去空白后的文本。 */
  async function handleOk() {
    if (!formRef.value) return
    try {
      await formRef.value.validate()
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return
      throw error
    }
    const result: I18nTextMessages = {}
    Object.entries(formData).forEach(([language, value]) => {
      const text = value?.trim()
      if (text) result[language] = text
    })
    emit('confirm', result)
    emit('update:visible', false)
  }

  return { formRef, formData, languages, rules, handleCancel, handleOk }
}
