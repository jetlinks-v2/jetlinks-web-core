import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { componentsRegistry } from '@jetlinks-web-core/utils/components-registry'
import { resolvePublicAssetUrl } from '@jetlinks-web-core/utils/public-asset'
import { BASIS_FORM_MODULE_CODE, BASIS_FORM_PAGE_CODE } from '../components/PlatformSettings/fieldRegistry'
import { mergeSettingsPatch, settingsFieldScopes, toSettingsModel, validateSettings, visibleSettingsKeys } from '../components/PlatformSettings/model'
import type { PlatformSettingKey, PlatformSettingsErrors, PlatformSettingsMode, PlatformSettingsPatch, PlatformSettingsScopes, PlatformSettingsSource, PlatformSettingsSubmit } from '../components/PlatformSettings/types'

/** Shared state owns drafts and persistence; the page injects the current deployment's configuration source. */
export function usePlatformSettings(source: PlatformSettingsSource, mode: PlatformSettingsMode, canEdit: () => boolean = () => true) {
  const { t } = useI18n()
  const baseUrl = `${window.location.origin}/api`
  const empty: PlatformSettingsScopes = { front: {}, amap: {}, paths: {} }
  const scopes = ref<PlatformSettingsScopes>(empty)
  const saved = ref(toSettingsModel(empty, baseUrl))
  const model = reactive(toSettingsModel(empty, baseUrl))
  const errors = ref<PlatformSettingsErrors>({})
  const loading = ref(true)
  const busy = ref(false)
  const error = ref('')
  const warning = ref('')
  let alive = true
  onBeforeUnmount(() => { alive = false })
  const hidden = componentsRegistry.getRegistry(`${BASIS_FORM_PAGE_CODE}:${BASIS_FORM_MODULE_CODE}`)
    .filter(item => item.mode === 'hide').map(item => String(item.target))
  const keys = visibleSettingsKeys(hidden)
  const disabled = computed(() => !canEdit())
  const assets = computed(() => ({
    logo: resolvePublicAssetUrl(model.logo || 'images/login/logo.png'),
    ico: resolvePublicAssetUrl(model.ico || model.logo || 'favicon.ico'),
    background: hidden.includes('background') ? '' : resolvePublicAssetUrl(model.background || 'images/login/login.png'),
  }))

  function change(patch: PlatformSettingsPatch) {
    if (busy.value || disabled.value) return
    for (const key of Object.keys(patch) as PlatformSettingKey[]) {
      if (keys.includes(key)) Object.assign(model, { [key]: patch[key] })
      delete errors.value[key]
    }
  }

  async function load(preserveDraft = false) {
    error.value = ''
    loading.value = !preserveDraft
    try {
      const data = await source.load()
      if (!alive) return false
      const next = toSettingsModel(data, baseUrl)
      for (const key of keys) {
        if (!preserveDraft || model[key] === saved.value[key]) Object.assign(model, { [key]: next[key] })
      }
      scopes.value = data
      saved.value = next
      warning.value = ''
      return true
    } catch {
      if (alive) {
        if (preserveDraft) warning.value = t('PlatformSettings.refreshFailed')
        else error.value = t('PlatformSettings.loadFailed')
      }
      return false
    } finally { if (alive) loading.value = false }
  }

  const persist: PlatformSettingsSubmit = async patch => {
    if (busy.value || loading.value || error.value || disabled.value) return { ok: false, error: t('PlatformSettings.saveFailed') }
    const allowed = Object.fromEntries(Object.entries(patch).filter(([key]) => keys.includes(key as PlatformSettingKey))) as PlatformSettingsPatch
    const changedKeys = Object.keys(allowed) as PlatformSettingKey[]
    const next = { ...(mode === 'detail' ? saved.value : model), ...allowed }
    errors.value = validateSettings(next, changedKeys, t)
    if (Object.keys(errors.value).length) return { ok: false, error: Object.values(errors.value)[0] }
    Object.assign(model, allowed)
    if (mode === 'form') return { ok: true }
    return write(allowed)
  }

  async function write(patch: PlatformSettingsPatch) {
    if (!Object.keys(patch).length) return { ok: true }
    busy.value = true
    const merged = mergeSettingsPatch(scopes.value, patch)
    try {
      const response = await source.save(merged.payload)
      if (!response.success) throw new Error('save')
      if (!alive) return { ok: true }
      scopes.value = merged.scopes
      saved.value = { ...saved.value, ...patch }
      // A successful write remains successful if its subsequent read fails; never encourage duplicate writes.
      await load(true)
      return { ok: true }
    } catch {
      return { ok: false, error: t('PlatformSettings.saveFailed') }
    } finally { if (alive) busy.value = false }
  }

  async function submitAll() {
    if (busy.value || loading.value || error.value || disabled.value) return false
    errors.value = validateSettings(model, keys, t)
    if (Object.keys(errors.value).length) return false
    const patch = Object.fromEntries(keys.filter(key => model[key] !== saved.value[key]
      || scopes.value[settingsFieldScopes[key]][key] === undefined)
      .map(key => [key, model[key]])) as PlatformSettingsPatch
    const result = await write(patch)
    return result.ok
  }

  async function reload() {
    if (busy.value || loading.value) return false
    busy.value = true
    try { return await load(!error.value) }
    finally { if (alive) busy.value = false }
  }

  onMounted(() => { void load() })
  return { model, saved, errors, loading, busy, error, warning, hidden, assets, disabled, change, persist, submitAll, reload }
}
