import { computed, reactive, ref, watch } from 'vue'
import { Form } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import { useUserStore } from '@jetlinks-web-core/store'
import { updateMeInfo_api } from '@jetlinks-web-core/api/account/center'

type ContactField = 'telephone' | 'email'
type ContactValues = Record<ContactField, string>

const contactFields = [
  { key: 'telephone', label: 'AccountInfo.basicPhone', placeholder: 'AccountInfo.pleaseEnterPhone', type: 'tel' },
  { key: 'email', label: 'AccountInfo.basicEmail', placeholder: 'AccountInfo.pleaseEnterEmail', type: 'email' },
] as const

/** 编辑个人资料联系方式；登录身份仍由原验证码绑定流程维护。 */
export const useContactInfo = () => {
  const user = useUserStore()
  const { t } = useI18n()
  const profile = computed(() => user.userInfo as Partial<ContactValues>)
  const contactForm = reactive<ContactValues>({
    telephone: profile.value.telephone || '',
    email: profile.value.email || '',
  })
  const savingContact = ref<ContactField>()
  const contactRules = computed(() => ({
    telephone: [{ pattern: /^1[3456789]\d{9}$/, message: t('EditInfo.index.557023-12') }],
    email: [{ type: 'email', message: t('EditInfo.index.557023-15') }],
  }))
  const { validate, validateInfos } = Form.useForm(contactForm, contactRules)

  // 分字段同步，保存一个字段后刷新资料时保留另一个尚未提交的输入。
  contactFields.forEach(({ key }) => {
    watch(() => profile.value[key], value => {
      contactForm[key] = value || ''
    }, { immediate: true })
  })

  const contactChanged = computed(() => ({
    telephone: contactForm.telephone.trim() !== (profile.value.telephone || '').trim(),
    email: contactForm.email.trim() !== (profile.value.email || '').trim(),
  }))

  /** 独立校验和保存当前字段，串行提交避免完整资料快照相互覆盖。 */
  const saveContact = async (field: ContactField): Promise<void> => {
    if (savingContact.value || !contactChanged.value[field]) return
    savingContact.value = field
    try {
      contactForm[field] = contactForm[field].trim()
      try {
        await validate([field])
      } catch {
        // 校验错误由对应表单项展示，不发起保存请求。
        return
      }
      const response = await updateMeInfo_api({ ...user.userInfo, [field]: contactForm[field] })
      if (response.status === 200 || response.success) {
        await user.getUserInfo()
        onlyMessage(t('AccountInfo.saveSuccess'), 'success')
      }
    } catch {

    } finally {
      savingContact.value = undefined
    }
  }

  return { contactFields, contactForm, contactChanged, savingContact, validateInfos, saveContact }
}
