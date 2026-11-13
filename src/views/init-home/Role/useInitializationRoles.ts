import { ref } from 'vue'
import type { FormInstance } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import { randomString } from '@jetlinks-web/utils'
import { updateRoleMenu, addRole, getRoleMenu, addRoleGroup } from '@jetlinks-web-core/api/initHome'
import RoleMenuData, { RoleData } from '../data/RoleData'
import type { MenuPermissionNode } from '../../../hooks/menuAssetPermissionEditor.types'

type RoleKey = keyof typeof RoleData
interface RoleGroup { id: string; name: string; show: boolean; selected: boolean; closeIcon?: boolean }
const findMenu = (menus: MenuPermissionNode[], code: string): MenuPermissionNode | undefined => {
  for (const menu of menus) {
    if (menu.code === code) return menu
    const child = menu.children && findMenu(menu.children, code)
    if (child) return child
  }
}

export function useInitializationRoles() {
  const { t } = useI18n()
  const keys = ref<string[]>([])
  const group = ref<RoleGroup[]>(['15', '16', '17'].map((suffix, index) => ({
    name: t(`Role.index.263636-${suffix}`), show: false, selected: index === 0,
    id: index === 0 ? 'default_group' : randomString(),
  })))
  const showAdd = ref(false)
  const selectedGroup = ref<number>()
  const formData = ref({ name: '' })
  const formRef = ref<FormInstance>()
  const getCheckValue = (values: unknown[]) => { keys.value = values.filter((value): value is RoleKey => typeof value === 'string' && value in RoleData) }
  const showButton = (item: RoleGroup) => { if (item.id !== 'default_group') item.show = true }
  const hiddenButton = (item: RoleGroup) => { item.show = false }
  const selectGroup = (item: RoleGroup) => { item.selected = !item.selected }
  const showAddGroup = () => { formData.value.name = ''; selectedGroup.value = undefined; showAdd.value = true }
  const showEditGroup = (item: RoleGroup, index: number) => { formData.value.name = item.name; selectedGroup.value = index; showAdd.value = true }
  async function addGroup() {
    try { await formRef.value?.validate() } catch { return }
    if (selectedGroup.value === undefined) group.value.push({ name: formData.value.name, selected: true, show: false, closeIcon: true, id: randomString() })
    else group.value[selectedGroup.value].name = formData.value.name
    showAdd.value = false
  }

  async function submitRole() {
    // Let rejected requests reach the host's failure boundary, instead of leaving a wrapping Promise pending.
    for (const key of keys.value as RoleKey[]) {
      const response = await addRole(RoleData[key])
      if (!response.success || !response.result?.id) return false
      const detail = await getRoleMenu(response.result.id)
      if (!detail.success || !Array.isArray(detail.result?.menus)) return false
      const menus = RoleMenuData[key].flatMap(item => {
        const matched = findMenu(detail.result.menus, item.code)
        return matched ? [{ ...item, id: matched.id, parentId: matched.parentId, createTime: matched.createTime }] : []
      })
      if (!(await updateRoleMenu(response.result.id, { menus })).success) return false
    }
    return true
  }
  async function submitRoleGroup() {
    for (const item of group.value.filter(item => item.selected)) {
      if (!(await addRoleGroup({ id: item.id, name: item.name })).success) return false
    }
    return true
  }
  return { keys, group, showAdd, formData, formRef, getCheckValue, showButton, hiddenButton, selectGroup, showAddGroup, showEditGroup, addGroup, submitRole, submitRoleGroup }
}
