import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { queryPermission_api } from '@jetlinks-web-core/api/system/permission'
import i18n from '@jetlinks-web-core/locales'
import { handleData, type PermissionDefinition, type PermissionScope } from './data'
import type { TokenPermissionMode, TokenPermissionSelection } from '../types'
import {
  allPermissionOperations, clonePermissions, expandPermissionOperations, followsAccount, readonlyPermissions,
  TOKEN_PERMISSION_MODES,
} from '../permissionMode'

interface PermissionProps {
  value: PermissionScope[]
  disabled: boolean
  permissionMode?: TokenPermissionMode
  busy?: boolean
}

type PermissionEmit = {
  (event: 'update:value', value: PermissionScope[]): void
  (event: 'mode-change', value: TokenPermissionSelection): void
  (event: 'ready-change', ready: boolean): void
}

/** 模式切换只在用户操作时生成范围；加载、查看和搜索绝不重写已有授权。 */
export const useTokenPermissions = (props: PermissionProps, emit: PermissionEmit) => {
  const searchKeyword = ref('')
  const sourceList = ref<PermissionDefinition[]>([])
  const allDefinitions = ref<PermissionDefinition[]>([])
  const loading = ref(false)
  const loadError = ref(false)
  const initialized = ref(false)
  let disposed = false
  let customDraft = followsAccount({ permissions: props.value }) ? [] : clonePermissions(props.value)

  const inherited = computed(() => followsAccount({ permissions: props.value }))
  const selectedPermissions = computed(() => inherited.value ? allPermissionOperations(allDefinitions.value) : expandPermissionOperations(props.value, allDefinitions.value))
  const list = computed(() => handleData(sourceList.value, selectedPermissions.value))
  const selectedCount = computed(() => selectedPermissions.value.reduce((count, item) => count + item.actions.length, 0))
  const custom = computed(() => props.permissionMode === 'custom' && !props.disabled)
  const controlsDisabled = computed(() => loading.value || !!props.busy || props.disabled || !initialized.value)
  const modeOptions = computed(() => TOKEN_PERMISSION_MODES.map(mode => ({
    value: mode,
    label: i18n.global.t('PersonalToken.permissionMode.' + mode),
    description: i18n.global.t('PersonalToken.permissionMode.' + mode + 'Hint'),
    disabled: !!props.busy || props.disabled || (mode !== 'follow' && (!initialized.value
      || !(mode === 'readonly' ? readonlyPermissions(allDefinitions.value) : allPermissionOperations(allDefinitions.value)).length)),
  })))
  const columns = computed(() => [
    { title: i18n.global.t('PersonalToken.PermissionList.061384-8'), dataIndex: 'name', key: 'name', width: 150 },
    { title: i18n.global.t('PersonalToken.PermissionList.061384-9'), dataIndex: 'actions', key: 'actions' },
  ])

  watch(initialized, ready => emit('ready-change', ready), { immediate: true })

  const loadPermissions = async (keyword = '', initialize = false) => {
    if (loading.value || disposed) return
    const params: { paging: boolean; terms?: { column: string; value: string }[] } = { paging: false }
    if (keyword) params.terms = [{ column: 'name$like', value: '%' + keyword + '%' }]
    loading.value = true
    loadError.value = false
    try {
      const response: { success: boolean; result?: PermissionDefinition[] } = await queryPermission_api(params)
      if (disposed) return
      if (!response.success) { loadError.value = true; return }
      sourceList.value = response.result || []
      if (initialize) {
        allDefinitions.value = sourceList.value
        initialized.value = true
      }
    } catch {
      if (!disposed) loadError.value = true
    } finally {
      if (!disposed) loading.value = false
    }
  }

  const onSearch = async (keyword: string) => {
    if (loading.value || props.busy) return
    if (!initialized.value) {
      await loadPermissions('', true)
      if (!initialized.value || !keyword) return
    }
    await loadPermissions(keyword)
  }

  function selectMode(value: unknown) {
    if (!TOKEN_PERMISSION_MODES.includes(value as TokenPermissionMode)) return
    const mode = value as TokenPermissionMode
    if (mode === props.permissionMode || modeOptions.value.find(option => option.value === mode)?.disabled) return
    if (custom.value) customDraft = clonePermissions(props.value)
    const permissions = mode === 'follow' ? [{ id: '*', actions: ['*'] }]
      : mode === 'readonly' ? readonlyPermissions(allDefinitions.value) : clonePermissions(customDraft)
    emit('mode-change', { mode, permissions })
  }

  function toggleAction(permissionId: string, action: string, checked: boolean) {
    if (!custom.value || controlsDisabled.value || permissionId === '*') return
    const definition = allDefinitions.value.find(item => item.id === permissionId)
    if (!definition?.actions?.some(item => item.action === action)) return
    const previous = props.value.find(item => item.id === permissionId)
    const actions = new Set(previous?.actions.includes('*')
      ? definition.actions.map(item => item.action) : previous?.actions || [])
    if (checked) actions.add(action)
    else actions.delete(action)
    const next = props.value.filter(item => item.id !== permissionId)
    if (actions.size) next.push({ id: permissionId, actions: [...actions] })
    emit('update:value', clonePermissions(next))
  }

  function toggleGroup(permissionId: string, checked: boolean) {
    if (!custom.value || controlsDisabled.value || permissionId === '*') return
    const definition = allDefinitions.value.find(item => item.id === permissionId)
    if (!definition?.actions?.length) return
    const next = props.value.filter(item => item.id !== permissionId)
    if (checked) next.push({ id: permissionId, actions: definition.actions.map(item => item.action) })
    emit('update:value', clonePermissions(next))
  }

  onMounted(() => { void loadPermissions('', true) })
  onUnmounted(() => { disposed = true })
  return {
    searchKeyword, list, loading, loadError, initialized, selectedCount, columns, custom,
    controlsDisabled, modeOptions, onSearch, selectMode, toggleAction, toggleGroup,
  }
}
