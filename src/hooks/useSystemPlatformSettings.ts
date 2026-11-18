import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSystemStore } from '@jetlinks-web-core/store/system'
import { useAuthStore } from '@jetlinks-web-core/store/auth'
import { useUserStore } from '@jetlinks-web-core/store/user'
import { save_api } from '@jetlinks-web-core/api/system/basis'
import { usePlatformSettings } from './usePlatformSettings'
import type { PlatformSettingsMode, PlatformSettingsScopes, PlatformSettingsSource } from '../components/PlatformSettings/types'

/** Bind the shared editor to the active system-store source, including SaaS store overrides. */
export function useSystemPlatformSettings(mode: PlatformSettingsMode, save: PlatformSettingsSource['save'] = save_api) {
  const system = useSystemStore()
  const auth = useAuthStore()
  const user = useUserStore()
  const { t } = useI18n()
  const uploads = reactive(new Set<string>())
  // 按账号而不是运行模式授权；isAdmin 也包含项目负责人。
  const canConfigureLanguages = () => user.userInfo.username === 'admin'
  const state = usePlatformSettings({
    async load() {
      const response = await system.queryInfo()
      if (response?.success === false) throw new Error('Configuration load failed')
      const info = system.systemInfo
      // Initialization retains its historical layout defaults without changing existing installations.
      return {
        front: { ...(mode === 'form' ? { headerTheme: 'light', layout: 'mix', layoutVariant: 'project' } : {}), ...info.front },
        amap: { ...info.amap }, paths: { ...info.paths },
      } satisfies PlatformSettingsScopes
    },
    save,
    onSaved({ languages }) {
      if (languages !== undefined) system.applySavedFrontLanguages(languages)
    },
  }, mode, () => mode === 'form' || auth.hasPermission('system/Basis:update'), canConfigureLanguages)

  function uploading(key: string, busy: boolean) {
    if (busy) uploads.add(key)
    else uploads.delete(key)
    if (!uploads.size && state.warning.value === t('PlatformSettings.waitUpload')) state.warning.value = ''
  }
  async function submit() {
    if (uploads.size) { state.warning.value = t('PlatformSettings.waitUpload'); return false }
    return state.submitAll()
  }
  return { ...state, uploading, submit }
}
