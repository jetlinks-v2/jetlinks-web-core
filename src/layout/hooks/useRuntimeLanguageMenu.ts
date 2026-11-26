import { computed, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { LocalStore } from '@jetlinks-web/utils'
import { useSystemStore } from '@jetlinks-web-core/store'
import { langKey, ruleEditorKey } from '@jetlinks-web-core/utils/consts'
import { builtInLanguage, builtInLanguageOptions, DEFAULT_LANGUAGE, machineLanguageOptions, type BuiltInLanguage } from '@jetlinks-web-core/locales/translation/languages'
import type { ModelState } from '@jetlinks-web-core/locales/translation/models'
import { useTranslationRuntime } from '@jetlinks-web-core/locales/translation/runtime'

const icons: Record<ModelState['phase'], string> = {
  checking: 'LoadingOutlined',
  needed: 'DownloadOutlined',
  downloading: 'LoadingOutlined',
  ready: 'CheckOutlined',
  error: 'ReloadOutlined',
  unsupported: 'StopOutlined',
  modelUnavailable: 'StopOutlined',
}

interface LanguageMenuOption {
  value: string
  label: string
  disabled: boolean
  model?: { icon: string; label: string; enabled: boolean; percent?: number }
}

const languageOptions = [...builtInLanguageOptions, ...machineLanguageOptions]
const languageLabel = (value: string) => languageOptions.find(option => option.value === value)?.label ?? value

/** 切换内置词库时保留语言包的下载进度，额外语种使用已准备的翻译路径。 */
export function useRuntimeLanguageMenu() {
  const { locale, t } = useI18n({ useScope: 'global' })
  const systemStore = useSystemStore()
  const runtime = useTranslationRuntime()
  const open = ref(false)
  const pendingLocale = ref<BuiltInLanguage>()
  let selection = 0
  onScopeDispose(() => { selection++ })
  const base = computed(() => builtInLanguage(locale.value) ?? DEFAULT_LANGUAGE)
  const selected = runtime.language
  const sourceLabel = computed(() => languageLabel(selected.value))
  const supplementTarget = computed(() => pendingLocale.value ?? (selected.value === base.value ? base.value : undefined))

  function modelStatus(state: ModelState, language: string, automatic = false): NonNullable<LanguageMenuOption['model']> {
    const percent = state.phase === 'downloading' ? state.percent : undefined
    const key = percent !== undefined ? 'progress' : automatic && state.phase === 'error' ? 'supplementError' : state.phase
    return {
      icon: icons[state.phase],
      label: t(`localTranslation.${key}`, { language, percent: percent ?? 0 }),
      enabled: !automatic && (state.phase === 'needed' || state.phase === 'error'),
      percent,
    }
  }

  const options = computed<LanguageMenuOption[]>(() => [
    ...builtInLanguageOptions.map(option => {
      const item = { ...option, disabled: false }
      if (option.value === DEFAULT_LANGUAGE) return item
      const models = runtime.supplementModels(option.value)
      const downloading = models.find(({ state }) => state.phase === 'downloading')
      const issue = option.value === supplementTarget.value
        ? models.find(({ state }) => state.phase === 'error' || state.phase === 'unsupported' || state.phase === 'modelUnavailable')
        : undefined
      const active = downloading ?? issue
      if (!active) return item
      return { ...item, model: modelStatus(active.state, `${languageLabel(active.pair.sourceLanguage)} → ${option.label}`, true) }
    }),
    ...machineLanguageOptions.map(option => {
      if (option.value === selected.value) return { ...option, disabled: false }
      const state = runtime.state(option.value)
      return {
        ...option,
        disabled: state.phase !== 'ready',
        model: modelStatus(state, `${sourceLabel.value} → ${option.label}`),
      }
    }),
  ])
  const currentLabel = computed(() => options.value.find(option => option.value === selected.value)?.label ?? builtInLanguageOptions[0].label)
  const menuLabel = computed(() => t('Login.language'))

  watch([open, selected], ([visible]) => {
    if (!visible) return
    machineLanguageOptions.forEach(option => runtime.inspect(option.value))
    if (selected.value === base.value && base.value !== DEFAULT_LANGUAGE) runtime.inspectSupplements(base.value)
  })

  async function select(value: string): Promise<void> {
    const native = builtInLanguageOptions.find(option => option.value === value)
    if (!native) {
      if (runtime.select(value)) {
        selection++
        pendingLocale.value = undefined
        open.value = false
      }
      return
    }
    const request = ++selection
    const preparing = runtime.prepareBuiltIn(native.value)
    if (preparing) {
      pendingLocale.value = native.value
      await preparing
      // 另一次语言选择或菜单卸载应使旧下载的切换请求失效。
      if (request !== selection) return
    }
    pendingLocale.value = undefined
    runtime.select()
    open.value = false
    if (native.value === systemStore.language && native.value === base.value) return
    systemStore.language = native.value
    LocalStore.set(langKey, native.value)
    // 规则编辑器使用独立缓存，必须与全局语言保持同步。
    LocalStore.set(ruleEditorKey, native.value)
    window.location.reload()
  }

  return {
    open, options, selected, currentLabel, menuLabel, select, prepare: runtime.prepare,
  }
}
