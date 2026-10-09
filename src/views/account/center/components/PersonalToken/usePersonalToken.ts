import { ref } from 'vue'
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

  const handleDelete = async (token: PersonalToken) => {
    const response = await deletePersonalToken_api(token.id)
    if (response.success) {
      reload()
      onlyMessage(i18n.global.t('center.index.661180-3'))
    }
  }

  // 不刷新保存强调权限在原令牌生效；轮换、新增仍在复制弹窗关闭后刷新列表。
  const handleDialogOk = (_data?: TokenFormData, revokeAccessTokens = true) => {
    reload()
    onlyMessage(i18n.global.t(revokeAccessTokens
      ? 'center.index.661180-3'
      : 'PersonalToken.TokenDialog.savedWithoutRefresh'))
    dialogVisible.value = false
  }

  return {
    tokenList, dialogVisible, dialogMode, selectedToken, loading, loadError, reload,
    handleAdd, handleView, handleEdit, handleDelete, handleDialogOk,
  }
}
