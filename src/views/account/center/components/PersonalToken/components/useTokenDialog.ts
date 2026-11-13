import globalI18n from '@jetlinks-web-core/locales'
import { computed, nextTick, ref, watch } from 'vue'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { savePersonalToken_api } from '@jetlinks-web-core/api/account/center'
import { onlyMessage, randomString } from '@jetlinks-web/utils'
import type { Rule } from 'ant-design-vue/es/form'

import { copyTokenScope, resolvePermissionMode, withPermissionMode } from '../permissionMode'
import { isUnlimitedExpiry } from '../tokenPresentation'
import type { TokenDialogProps, TokenDialogEmit, TokenFormData } from '../types'

type ExpireType = number | 'custom' | 'never'

type FormRef = {
  validate: () => Promise<void>
  clearValidate: () => void
}

const createDefaultFormData = (): TokenFormData => ({
  name: '',
  expires: dayjs().add(30, 'day').valueOf(),
  description: '',
  scope: withPermissionMode({ permissions: [] }, 'follow'),
  sourceType: 'account-center',
  sourceId: randomString(8),
  sourceTypeName: globalI18n.global.t('PersonalToken.TokenDialog.sourceName'),
})

/** 统一新增与两种编辑保存；原令牌是否轮换由接口查询参数决定。 */
export const useTokenDialog = (props: TokenDialogProps, emit: TokenDialogEmit) => {
  const formRef = ref<FormRef>()
  const visible = ref(true)
  const showSuccessModal = ref(false)
  const generatedToken = ref('')
  const expireType = ref<ExpireType>(30)
  const loading = ref(false)
  const permissionsReady = ref(false)
  const savingWithRefresh = ref(true)
  const formData = ref<TokenFormData>(createDefaultFormData())

  // 日期控件使用 valueFormat=x 的字符串，编辑记录仍兼容后端返回的毫秒数。
  const customExpires = computed(() => formData.value.expires === null ? undefined : String(formData.value.expires))
  const handleCustomExpireChange = (value: unknown) => {
    formData.value.expires = dayjs.isDayjs(value) ? value.valueOf() : typeof value === 'string' ? value : null
  }

  const rules: Record<string, Rule[]> = {
    name: [
      { required: true, message: globalI18n.global.t('PersonalToken.TokenDialog.168178-8'), trigger: 'blur' },
      { max: 64, message: globalI18n.global.t('EditInfo.index.557023-3'), trigger: 'blur' },
    ],
    expires: [{ required: true, message: globalI18n.global.t('PersonalToken.TokenDialog.168178-17'), trigger: 'change' }],
  }

  const dialogTitle = computed(() => {
    const titles: Record<TokenDialogProps['mode'], string> = {
      add: globalI18n.global.t('PersonalToken.TokenDialog.addTitle'),
      edit: globalI18n.global.t('PersonalToken.TokenDialog.editTitle'),
      view: globalI18n.global.t('PersonalToken.TokenDialog.viewTitle'),
      regenerate: globalI18n.global.t('PersonalToken.prototype.regenerateTitle', { name: props.token?.name || '' }),
    }
    return titles[props.mode]
  })

  const nameDuplicate = computed(() => props.existingNames?.includes(formData.value.name.trim()) || false)
  const canSubmit = computed(() => {
    if (!formData.value.name.trim()) return false
    if (props.mode !== 'regenerate' && nameDuplicate.value) return false
    if (!expireType.value) return false
    if (expireType.value === 'custom' && !formData.value.expires) return false
    if (props.mode === 'regenerate') return true
    if (resolvePermissionMode(formData.value.scope) === 'follow') return true
    return permissionsReady.value && formData.value.scope.permissions.some(item => item.actions.length > 0)
  })

  // 当天仍可选择后续时间，具体时分秒限制由 disabledTime 控制。
  const disabledDate = (current: Dayjs) => !!current && current.endOf('day').isBefore(dayjs())

  const disabledTime = (current: Dayjs | null) => {
    if (current && dayjs(current).isSame(dayjs(), 'day')) {
      const now = dayjs()
      return {
        disabledHours: () => Array.from({ length: now.hour() }, (_, index) => index),
        disabledMinutes: (selectedHour: number) => selectedHour === now.hour()
          ? Array.from({ length: now.minute() }, (_, index) => index)
          : [],
        disabledSeconds: (selectedHour: number, selectedMinute: number) => selectedHour === now.hour() && selectedMinute === now.minute()
          ? Array.from({ length: now.second() }, (_, index) => index)
          : [],
      }
    }
    return {}
  }

  const handleExpireTypeChange = (value: unknown) => {
    if (value === 'custom') {
      formData.value.expires = null
    } else if (value === -1) {
      formData.value.expires = -1
    } else if (typeof value === 'number') {
      formData.value.expires = dayjs().add(value, 'day').valueOf()
    }
  }

  const resetForm = () => {
    formData.value = createDefaultFormData()
    permissionsReady.value = false
    showSuccessModal.value = false
    generatedToken.value = ''
    nextTick(() => {
      formRef.value?.clearValidate()
    })
  }

  const handleCancel = () => {
    if (loading.value) return
    emit('close')
    resetForm()
  }

  // 两种编辑保存共享校验；保留凭证时不展示接口返回的令牌，直接通知列表刷新。
  const handleOk = async (revokeAccessTokens = true) => {
    const rotateCredentials = props.mode === 'regenerate' || revokeAccessTokens
    if (loading.value) return
    if (props.mode === 'view') {
      handleCancel()
      return
    }

    if (!canSubmit.value || !formRef.value) return

    // 校验阶段也锁定提交，避免连续点击两种按钮触发不同的保存请求。
    loading.value = true
    savingWithRefresh.value = props.mode === 'add' || rotateCredentials
    try {
      await formRef.value?.validate()
    } catch {
      // 字段错误已由表单展示，保留输入供修改，不进入接口保存。
      loading.value = false
      return
    }

    try {
      if (!canSubmit.value) return
      if (props.mode !== 'regenerate') formData.value.scope = withPermissionMode(
        formData.value.scope, resolvePermissionMode(formData.value.scope),
      )
      const submitData = { ...formData.value, scope: copyTokenScope(formData.value.scope) }
      const params = props.mode === 'edit' || props.mode === 'regenerate' ? { revokeAccessTokens: rotateCredentials } : undefined
      const res = await savePersonalToken_api(submitData, params)
      if (!res.success) {
        onlyMessage(globalI18n.global.t('PersonalToken.TokenDialog.saveFailed'), 'error')
        return
      }
      if (props.mode === 'edit' && !revokeAccessTokens) {
        visible.value = false
        emit('save', submitData, false)
        return
      }
      const accessToken = res.result.accessToken
      if (!accessToken) {
        onlyMessage(globalI18n.global.t('PersonalToken.TokenDialog.saveFailed'), 'error')
        return
      }
      generatedToken.value = accessToken
      showSuccessModal.value = true
      visible.value = false
    } catch {
      onlyMessage(globalI18n.global.t('PersonalToken.TokenDialog.saveFailed'), 'error')
    } finally {
      loading.value = false
    }
  }

  const handleSuccessClose = () => {
    showSuccessModal.value = false
    emit('save', formData.value)
  }

  const getExpireType = (expireTime?: number | string | null): ExpireType => {
    if (isUnlimitedExpiry(expireTime)) return -1
    if (expireTime === null || expireTime === undefined || expireTime === '') return 'custom'
    const expires = dayjs(typeof expireTime === 'string' && /^\d+$/.test(expireTime) ? Number(expireTime) : expireTime)
    const now = dayjs(props.token?.createTime)
    const diffDays = expires.diff(now, 'day')

    if (diffDays === 7) return 7
    if (diffDays === 30) return 30
    if (diffDays === 60) return 60
    if (diffDays === 90) return 90
    return 'custom'
  }

  watch(
    () => props.visible,
    value => {
      if (value && props.token && props.mode !== 'add') {
        formData.value = {
          // 后端按 id 区分新增与编辑，保留凭证必须命中原令牌记录。
          id: props.token.id,
          name: props.token.name || '',
          expires: props.token.expires ?? null,
          description: props.token.description || '',
          sourceType: props.token.sourceType || 'account-center',
          sourceId: props.token.sourceId || randomString(8),
          sourceTypeName: props.token.sourceTypeName,
          scope: copyTokenScope(props.token.scope),
        }
        expireType.value = getExpireType(props.token.expires)
        if (props.mode === 'regenerate') {
          expireType.value = 30
          handleExpireTypeChange(30)
        }
      } else if (!value) {
        resetForm()
      }
    },
    { immediate: true },
  )

  return {
    canSubmit,
    nameDuplicate,
    permissionsReady,
    customExpires,
    dialogTitle,
    disabledDate,
    disabledTime,
    expireType,
    formData,
    formRef,
    generatedToken,
    handleCancel,
    handleCustomExpireChange,
    handleExpireTypeChange,
    handleOk,
    handleSuccessClose,
    loading,
    rules,
    savingWithRefresh,
    showSuccessModal,
    visible,
  }
}
