import { computed, ref, watch } from 'vue'
import type { SlantedTabKey, SlantedTabOption } from '../../SlantedTabs'
import { BUILTIN_CONFIG_TABS } from './types'
import type { ModelConfigProps } from './types'
import type { ModelConfigState } from './useModelConfigState'
import type { useModelConfigEditor } from './useModelConfigEditor'

// 扩展页签沿用字符串 key，文件入口使用数字，避免占用已有扩展名称。
const FILES_TAB_KEY = 0

export function useModelConfigNavigation(
  props: ModelConfigProps,
  state: ModelConfigState,
  editor: ReturnType<typeof useModelConfigEditor>
) {
  const { activeType, configTab, text, editing, selectedFile, filePreviewLoaded, editorValue, draftValue } = state
  const normalizedExtraConfigTabs = computed(() => {
    const keys = new Set<string>(BUILTIN_CONFIG_TABS)
    return props.extraConfigTabs.filter(item => {
      if (!item?.key || keys.has(item.key)) return false
      keys.add(item.key)
      return true
    })
  })
  const availableConfigTabs = computed(() => [
    'definition',
    ...(props.showManifest ? ['manifest'] : []),
    ...normalizedExtraConfigTabs.value.map(item => item.key)
  ])
  const isExtraConfigTab = computed(() => normalizedExtraConfigTabs.value.some(item => item.key === configTab.value))
  const primaryTab = computed(() => activeType.value === 'file' ? FILES_TAB_KEY : configTab.value)
  const pendingTab = ref<SlantedTabKey>()
  const leaveConfirmVisible = computed(() => pendingTab.value !== undefined)
  const primaryTabs = computed<SlantedTabOption[]>(() => [
    { key: 'definition', label: text.value.modelParams },
    { key: FILES_TAB_KEY, label: text.value.modelFiles },
    ...(props.showManifest ? [{ key: 'manifest', label: text.value.basicInfo }] : []),
    ...normalizedExtraConfigTabs.value.map(item => ({ ...item, disabled: editing.value || item.disabled }))
  ])

  watch(availableConfigTabs, tabs => {
    if (!tabs.includes(configTab.value)) configTab.value = 'definition'
  }, { immediate: true })

  function changePrimaryTab(key: SlantedTabKey) {
    if (state.fileSaving.value || leaveConfirmVisible.value || key === primaryTab.value) return
    if (editor.hasUnsavedChanges()) {
      pendingTab.value = key
      return
    }
    if (editing.value) editor.cancelEdit()
    applyPrimaryTab(key)
  }

  function cancelTabChange() {
    pendingTab.value = undefined
  }

  async function saveAndChangeTab() {
    const key = pendingTab.value
    if (key === undefined) return
    // 先关闭弹窗并消费目标；校验失败的错误定位不能被原切页请求覆盖。
    cancelTabChange()
    if (await editor.saveEdit()) applyPrimaryTab(key)
  }

  function discardAndChangeTab() {
    const key = pendingTab.value
    if (key === undefined) return
    cancelTabChange()
    editor.cancelEdit()
    applyPrimaryTab(key)
  }

  function applyPrimaryTab(key: SlantedTabKey) {
    if (key === FILES_TAB_KEY) {
      activeType.value = 'file'
      editing.value = false
      if (!selectedFile.value) {
        editorValue.value = ''
        draftValue.value = ''
        filePreviewLoaded.value = false
      }
      return
    }
    configTab.value = String(key)
    if (activeType.value === 'file') editor.selectModelConfig()
    else editor.refreshEditorValue()
  }

  return { primaryTab, primaryTabs, isExtraConfigTab, changePrimaryTab, leaveConfirmVisible, cancelTabChange, saveAndChangeTab, discardAndChangeTab }
}
