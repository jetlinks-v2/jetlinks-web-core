import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { settingsFieldScopes, visibleSettingsKeys } from './model'
import type { PlatformSettingKey, PlatformSettingsPatch, PlatformSettingsSectionProps } from './types'

/** 区块只管理编辑事务；持久化、权限和已保存基线仍由配置容器提供。 */
export function usePlatformSettingsSection(
  props: PlatformSettingsSectionProps,
  scope: 'front' | 'amap',
  emitChange: (patch: PlatformSettingsPatch) => void,
  emitUploading?: (key: string, busy: boolean) => void,
) {
  const { t } = useI18n()
  const active = ref(false)
  const saving = ref(false)
  const failure = ref('')
  const uploads = reactive(new Set<string>())
  let alive = true
  onBeforeUnmount(() => { alive = false })
  const keys = computed(() => visibleSettingsKeys(props.hidden || []).filter(key => settingsFieldScopes[key] === scope))
  const editing = computed(() => props.mode === 'form' || active.value)
  const disabled = computed(() => !editing.value || !!props.disabled || !!props.busy || saving.value)
  const actionsDisabled = computed(() => !!props.disabled || !!props.busy || saving.value || uploads.size > 0)
  const configured = computed(() => keys.value.some(key => !!props.saved[key]))
  const hasValues = computed(() => keys.value.some(key => !!props.model[key]))

  const pick = (source: PlatformSettingsPatch): PlatformSettingsPatch => Object.fromEntries(
    keys.value.filter(key => Object.hasOwn(source, key)).map(key => [key, source[key]]),
  )

  function start() {
    if (props.mode !== 'detail' || actionsDisabled.value) return
    emitChange(pick(props.saved))
    failure.value = ''
    active.value = true
  }

  function cancel() {
    if (props.mode !== 'detail' || actionsDisabled.value) return
    emitChange(pick(props.saved))
    failure.value = ''
    active.value = false
  }

  function change(patch: PlatformSettingsPatch) {
    if (!editing.value || props.disabled || saving.value) return
    // 另一块保存时仍接收在途上传的结果；禁用控件负责阻止新的用户输入。
    emitChange(pick(patch))
    failure.value = ''
  }

  async function save() {
    if (props.mode !== 'detail' || !active.value || actionsDisabled.value) return false
    const patch = pick(props.model)
    if ((Object.keys(patch) as PlatformSettingKey[]).every(key => patch[key] === props.saved[key])) {
      cancel()
      return true
    }
    saving.value = true
    failure.value = ''
    try {
      const result = await props.submit(patch)
      if (alive) {
        if (result.ok) active.value = false
        else failure.value = result.error || t('PlatformSettings.saveFailed')
      }
      return result.ok
    } catch {
      if (alive) failure.value = t('PlatformSettings.saveFailed')
      return false
    } finally {
      if (alive) saving.value = false
    }
  }

  function uploading(key: string, busy: boolean) {
    if (busy) uploads.add(key)
    else uploads.delete(key)
    emitUploading?.(key, busy)
  }

  return { editing, disabled, actionsDisabled, saving, failure, configured, hasValues, start, cancel, change, save, uploading }
}
