import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { LocalStore } from '@jetlinks-web/utils'
import { useSystemStore } from '@jetlinks-web-core/store'
import { langKey, ruleEditorKey } from '@jetlinks-web-core/utils/consts'
import { builtInLanguage, builtInLanguageOptions, machineLanguageOptions } from '@jetlinks-web-core/locales/translation/languages'
import type { ModelState } from '@jetlinks-web-core/locales/translation/models'
import { useTranslationRuntime } from '@jetlinks-web-core/locales/translation/runtime'

const icons: Record<ModelState['phase'], string> = {
  checking: 'LoadingOutlined',
  needed: 'DownloadOutlined',
  downloading: 'LoadingOutlined',
  ready: 'CheckOutlined',
  error: 'ReloadOutlined',
  unsupported: 'StopOutlined',
}

interface LanguageMenuOption {
  value: string
  label: string
  disabled: boolean
  model?: { icon: string; label: string; enabled: boolean; percent?: number }
}

/** 内置选项走原有切换；机器选项只切展示偏好，不修改应用、编辑器或请求语言。 */
export function useRuntimeLanguageMenu() {
  const { locale, t } = useI18n({ useScope: 'global' })
  const systemStore = useSystemStore()
  const runtime = useTranslationRuntime()
  const open = ref(false)
  const base = computed(() => builtInLanguage(locale.value) ?? 'zh')
  const selected = runtime.language
  const sourceLabel = computed(() => [...builtInLanguageOptions, ...machineLanguageOptions]
    .find(option => option.value === selected.value)?.label ?? selected.value)
  const options = computed<LanguageMenuOption[]>(() => [
    ...builtInLanguageOptions.map(option => ({ ...option, disabled: false })),
    ...machineLanguageOptions.map(option => {
      if (option.value === selected.value) return { ...option, disabled: false }
      const state = runtime.state(option.value)
      const language = `${sourceLabel.value} → ${option.label}`
      const percent = state.phase === 'downloading' ? state.percent : undefined
      const key = percent === undefined ? state.phase : 'progress'
      return {
        ...option,
        disabled: state.phase !== 'ready',
        model: {
          icon: icons[state.phase],
          label: t(`localTranslation.${key}`, { language, percent: percent ?? 0 }),
          enabled: state.phase === 'needed' || state.phase === 'error',
          percent,
        },
      }
    }),
  ])
  const currentLabel = computed(() => options.value.find(option => option.value === selected.value)?.label ?? builtInLanguageOptions[0].label)
  const menuLabel = computed(() => t('Login.language'))

  watch([open, selected], ([visible]) => {
    if (visible) machineLanguageOptions.forEach(option => runtime.inspect(option.value))
  })

  function select(value: string): void {
    const native = builtInLanguageOptions.find(option => option.value === value)
    if (!native) {
      if (runtime.select(value)) open.value = false
      return
    }
    runtime.select()
    open.value = false
    if (native.value === systemStore.language && native.value === base.value) return
    systemStore.language = native.value
    LocalStore.set(langKey, native.value)
    // 规则编辑器使用独立缓存，必须与全局语言保持同步。
    LocalStore.set(ruleEditorKey, native.value)
    window.location.reload()
  }

  return { open, options, selected, currentLabel, menuLabel, select, prepare: runtime.prepare }
}
