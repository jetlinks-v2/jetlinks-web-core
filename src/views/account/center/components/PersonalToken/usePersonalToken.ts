import { computed, ref } from 'vue'
import { tokenStatus } from './tokenPresentation'
import { useRequest } from '@jetlinks-web/hooks'
import { onlyMessage } from '@jetlinks-web/utils'
import i18n from '@jetlinks-web-core/locales'
import { getCreatedPersonalTokens_api, deletePersonalToken_api } from '@jetlinks-web-core/api/account/center'
import type { PersonalToken, TokenDialogMode, TokenFormData } from './types'

/** 令牌列表、弹窗模式与保存后反馈；沿用现有查询和删除接口。 */
export const usePersonalToken = () => {
  const tokenList = ref<PersonalToken[]>([])
  const dialogVisible = ref(false)
  const dialogMode = ref<TokenDialogMode>('add')
  const selectedToken = ref<PersonalToken | null>(null)
  const loadError = ref(false)
  const deleting = ref('')
  const deleteError = ref(false)
  // 只用真实状态与到期时间分组；未知状态单独展示，不能推断为有效或失效。
  const tokenGroups = computed(() => {
    const now = Date.now()
    const groups: { active: PersonalToken[]; inactive: PersonalToken[]; unknown: PersonalToken[] } = { active: [], inactive: [], unknown: [] }
    for (const token of tokenList.value) {
      const key = tokenStatus(token, now).key
      if (key === 'PersonalCenter.valid' || key === 'PersonalCenter.expiring') groups.active.push(token)
      else if (key === 'PersonalCenter.expired' || key === 'PersonalCenter.disabled') groups.inactive.push(token)
      else groups.unknown.push(token)
    }
    return groups
  })

  const { reload, loading } = useRequest<unknown, PersonalToken[]>(getCreatedPersonalTokens_api, {
    defaultParams: { paging: false, sorts: [{ name: 'createTime', order: 'desc' }] },
    onSuccess: response => {
      loadError.value = false
      tokenList.value = response.result || []
    },
    onError: () => { loadError.value = true },
    onWarn: () => { loadError.value = true },
  })

  const handleAdd = () => {
    selectedToken.value = null
    dialogMode.value = 'add'
    dialogVisible.value = true
  }

  const handleView = (token: PersonalToken) => {
    selectedToken.value = token
    dialogMode.value = 'view'
    dialogVisible.value = true
  }

  const handleEdit = (token: PersonalToken) => {
    selectedToken.value = token
    dialogMode.value = 'edit'
    dialogVisible.value = true
  }
  const handleRegenerate = (token: PersonalToken) => {
    selectedToken.value = token
    dialogMode.value = 'regenerate'
    dialogVisible.value = true
  }

  /** 撤销仍使用已有删除接口；失败保留原列表，避免重复提交同一操作。 */
  const handleDelete = async (token: PersonalToken) => {
    if (deleting.value) return
    deleting.value = token.id
    deleteError.value = false
    try {
      const response = await deletePersonalToken_api(token.id)
      if (response.success === false || (response.success !== true && response.status !== 200)) throw new Error('Token revocation failed')
      reload()
      onlyMessage(i18n.global.t('PersonalCenter.tokenRevoked', { name: token.name || '' }))
    } catch { deleteError.value = true }
    finally { deleting.value = '' }
  }

  // 按原型使用保存反馈，刷新仍发生在保存或完整令牌弹窗关闭后。
  const handleDialogOk = (_data?: TokenFormData, _revokeAccessTokens = true) => {
    reload()
    onlyMessage(i18n.global.t('PersonalCenter.prototype.saved'))
    dialogVisible.value = false
  }

  return {
    tokenList, tokenGroups, deleting, deleteError, dialogVisible, dialogMode, selectedToken, loading, loadError, reload,
    handleAdd, handleView, handleEdit, handleRegenerate, handleDelete, handleDialogOk,
  }
}
