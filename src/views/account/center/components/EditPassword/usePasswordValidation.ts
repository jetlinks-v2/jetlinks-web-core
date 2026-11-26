import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { checkOldPassword_api, validateField_api } from '@jetlinks-web-core/api/account/center'

interface PasswordFields { newPassword: string }
interface ValidationResult { passed?: boolean; reason?: string }
interface ValidationResponse { status?: number; success?: boolean; result?: ValidationResult }

/** 沿用服务端密码规则，区分校验未通过与无法获取校验结果。 */
export function usePasswordValidation(form: Ref<PasswordFields>) {
  const { t } = useI18n()

  async function validateRequest(request: () => Promise<ValidationResponse>, current: boolean) {
    let response: ValidationResponse
    try {
      response = await request()
    } catch {
      throw new Error(t('EditPassword.validationUnavailable'))
    }
    if (response?.success === false || (response?.success !== true && response?.status !== 200) || typeof response.result?.passed !== 'boolean') {
      throw new Error(t('EditPassword.validationUnavailable'))
    }
    if (!response.result.passed) {
      const reason = response.result.reason || t('EditPassword.validationNotPassed')
      throw new Error(current ? t('EditPassword.currentPasswordNotVerified', { reason }) : reason)
    }
  }

  return {
    old: async (_rule: unknown, value: string) => {
      if (value) await validateRequest(() => checkOldPassword_api(value), true)
    },
    new: async (_rule: unknown, value: string) => {
      if (value) await validateRequest(() => validateField_api('password', value), false)
    },
    confirm: async (_rule: unknown, value: string) => {
      if (!value) return
      if (form.value.newPassword && value !== form.value.newPassword) throw new Error(t('EditPassword.index.010161-18'))
      await validateRequest(() => validateField_api('password', value), false)
    },
  }
}
