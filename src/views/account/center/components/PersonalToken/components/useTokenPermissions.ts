import { computed, onMounted, onUnmounted, ref } from 'vue'
import { queryPermission_api } from '@jetlinks-web-core/api/system/permission'
import i18n from '@jetlinks-web-core/locales'
import { handleData, type PermissionDefinition, type PermissionScope } from './data'

interface PermissionProps {
  value: PermissionScope[]
  disabled: boolean
}

/** 新增、编辑初始化最新全量授权；搜索仅改变展示，查看保留原授权。 */
export const useTokenPermissions = (
  props: PermissionProps,
  emit: (event: 'update:value', value: PermissionScope[]) => void,
) => {
  const searchKeyword = ref('')
  const sourceList = ref<PermissionDefinition[]>([])
  const loading = ref(false)
  const loadError = ref(false)
  const initialized = ref(false)
  let disposed = false

  const list = computed(() => handleData(sourceList.value, props.value))
  const selectedCount = computed(() => props.value.reduce((count, item) => count + item.actions.length, 0))
  const columns = computed(() => [
    { title: i18n.global.t('PersonalToken.PermissionList.061384-8'), dataIndex: 'name', key: 'name', width: 150 },
    { title: i18n.global.t('PersonalToken.PermissionList.061384-9'), dataIndex: 'actions', key: 'actions' },
  ])

  // 首次完整查询前清空旧授权，避免保存尚未同步的权限；查看模式不改原范围。
  const loadPermissions = async (keyword = '', initialize = false) => {
    if (loading.value || disposed) return
    const params: { paging: boolean; terms?: { column: string; value: string }[] } = { paging: false }
    if (keyword) params.terms = [{ column: 'name$like', value: `%${keyword}%` }]
    if (initialize && !props.disabled) emit('update:value', [])
    loading.value = true
    loadError.value = false
    try {
      const response: { success: boolean; result?: PermissionDefinition[] } = await queryPermission_api(params)
      if (disposed) return
      if (!response.success) {
        loadError.value = true
        return
      }
      sourceList.value = response.result || []
      if (initialize) {
        if (!props.disabled) {
          emit('update:value', sourceList.value.map(item => ({
            id: item.id,
            actions: (item.actions || []).map(action => action.action),
          })))
        }
        initialized.value = true
      }
    } catch {
      if (!disposed) loadError.value = true
    } finally {
      loading.value = false
    }
  }

  // 初始化失败时先重试完整列表，再搜索，保证提交范围不会退化为搜索结果。
  const onSearch = async (keyword: string) => {
    if (loading.value) return
    if (!initialized.value) {
      await loadPermissions('', true)
      if (!initialized.value || !keyword) return
    }
    await loadPermissions(keyword)
  }

  onMounted(() => { void loadPermissions('', true) })
  onUnmounted(() => { disposed = true })

  return { searchKeyword, list, loading, loadError, selectedCount, columns, onSearch }
}
