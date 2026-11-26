import { computed, defineAsyncComponent, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { assetBindingsApi as api } from '../../api/asset-bindings'
import { resolveAssetDimensionFilter } from '../AssetOwnershipCondition/registry'
import type { AssetDimensionOption, AssetDimensionSelector } from '../AssetOwnershipCondition/types'
import type { ObjectRelationChange, ObjectRelationContext } from '../../types/object-relation'
import type { AssetBindingDetail, AssetBindingDraft, AssetBindingSettings, AssetRelationDeclaration } from './types'
import { readBindingTargets } from './source'
import { assetBindingPermissions } from './permissions'

/** 按来源事实回显当前批次，统一提交明确的草稿差量；未知目标与取消选择不能变成全量替换。 */
export function useAssetRelationEditor(
  context: () => ObjectRelationContext,
  events: {
    changed: (change?: ObjectRelationChange) => void
    busy: (value: boolean) => void
    close: () => void
  }
) {
  const settings = ref<AssetBindingSettings>(),
    selector = shallowRef<AssetDimensionSelector>()
  const options = ref<AssetDimensionOption[]>([]),
    drafts = ref<AssetBindingDraft[]>([])
  const initializing = ref(false),
    saving = ref(false),
    error = ref('')
  const known = ref(new Map<string, AssetBindingDetail | undefined>()),
    pending = ref(new Set<string>())
  const failed = new Set<string>()
  const identities = new Map<string, string>()
  const loading = computed(() => initializing.value || pending.value.size > 0)
  const declaration = computed(() => context().maintenance as unknown as AssetRelationDeclaration)
  const assetId = computed(() => String(context().subject.data[declaration.value.assetIdProperty] ?? ''))
  const multiple = computed(() => !!context().reverse || settings.value?.multiple !== false)
  const initialPermissions = (original?: AssetBindingDetail) =>
    original ? [...original.grantedPermissions] : assetBindingPermissions(settings.value)
  const ids = computed(() => drafts.value.filter((row) => !row.removed).map((row) => row.id))
  const samePermissions = (row: AssetBindingDraft) =>
    [...row.permissions].sort().join('\0') === [...(row.original?.grantedPermissions || [])].sort().join('\0')
  const changes = computed(() => ({
    added: drafts.value.filter((row) => row.resolved && !row.original && !row.removed),
    updated: drafts.value.filter(
      (row) =>
        settings.value?.permissionSupported &&
        row.original &&
        row.original.relation !== 'owner' &&
        !row.removed &&
        !samePermissions(row)
    ),
    removed: drafts.value.filter((row) => row.original && row.original.relation !== 'owner' && row.removed)
  }))
  const dirty = computed(() => Object.values(changes.value).some((rows) => rows.length > 0))
  const reviewIds = computed(() =>
    context().reverse
      ? Object.values(changes.value)
          .flat()
          .map((row) => row.id)
      : drafts.value.map((row) => row.id)
  )
  const selectorOptions = computed(() => {
    const locked = !multiple.value && drafts.value.some((row) => row.original)
    const visit = (rows: AssetDimensionOption[]): AssetDimensionOption[] =>
      rows.map((row) => ({
        ...row,
        disabled:
          row.disabled || known.value.get(row.value)?.relation === 'owner' || (locked && !known.value.get(row.value)),
        children: row.children && visit(row.children)
      }))
    return visit(options.value)
  })
  const labels = computed(() => {
    const result = new Map<string, string>()
    const visit = (rows: AssetDimensionOption[]) =>
      rows.forEach((row) => {
        result.set(row.value, row.label)
        if (row.children) visit(row.children)
      })
    visit(options.value)
    return result
  })
  let generation = 0
  const message = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause))
  async function load() {
    const current = ++generation
    initializing.value = true
    error.value = ''
    drafts.value = []
    known.value.clear()
    identities.clear()
    pending.value.clear()
    failed.clear()
    settings.value = undefined
    try {
      if (!context().reverse && !assetId.value) throw new Error('Missing source asset identity')
      selector.value = context().reverse
        ? {
            component: defineAsyncComponent(() => import('./RelationObjectCandidates.vue')),
            componentProps: { context: context() },
            supportsOptionExtra: true
          }
        : resolveAssetDimensionFilter(declaration.value.dimensionType)?.createSelector?.({
            assetType: declaration.value.assetType
          })
      if (!selector.value) throw new Error('Dimension selector unavailable')
      const [features, rows] = await Promise.all([
        api.settings(declaration.value),
        selector.value?.optionPanel?.loadOptions?.() ?? Promise.resolve(selector.value?.options || [])
      ])
      if (current !== generation) return
      settings.value = features
      options.value = rows
    } catch (cause) {
      if (current === generation) error.value = message(cause)
    } finally {
      if (current === generation) initializing.value = false
    }
    if (current === generation && settings.value && !error.value)
      await resolveTargets([
        ...new Set([...(context().targets || []), ...(context().target ? [context().target!] : [])])
      ])
  }
  /** 仅核验当前可见批次及显式目标，不遍历目录，也不把宿主未返回的目标视作未关联。 */
  async function resolveTargets(values: string[]) {
    if (!settings.value || saving.value) return
    const missing = [...new Set(values)].filter((id) => !known.value.has(id) && !pending.value.has(id))
    if (!missing.length) return
    const current = generation
    missing.forEach((id) => pending.value.add(id))
    try {
      for (let index = 0; index < missing.length; index += 50) {
        const batch = missing.slice(index, index + 50)
        const bindings = await readBindingTargets(context(), batch)
        if (current !== generation) return
        for (const id of batch) {
          const resolved = bindings.find((binding) => binding.id === id)!
          const original = resolved.binding
          identities.set(id, resolved.assetId)
          known.value.set(id, original)
          failed.delete(id)
          let row = drafts.value.find((item) => item.id === id)
          if (!row && original) {
            row = { id, permissions: [] }
            drafts.value.push(row)
          }
          if (row && !row.resolved) {
            row.assetId = resolved.assetId
            row.original = original
            row.permissions = initialPermissions(original)
            row.resolved = true
          }
        }
      }
      if (!failed.size) error.value = ''
    } catch (cause) {
      if (current === generation) {
        missing.filter((id) => !known.value.has(id)).forEach((id) => failed.add(id))
        error.value = message(cause)
      }
    } finally {
      if (current === generation) missing.forEach((id) => pending.value.delete(id))
    }
  }
  async function select(values: string[]) {
    if (!settings.value || saving.value || loading.value) return
    const next = new Set(multiple.value ? values : values.slice(-1))
    const locked = !multiple.value && drafts.value.find((row) => row.original)
    if (locked && [...next].some((id) => id !== locked.id)) return
    drafts.value = drafts.value.filter((row) => {
      if (row.original?.relation === 'owner') return true
      row.removed = !next.has(row.id)
      return !!row.original || !row.removed
    })
    for (const id of next) {
      if (drafts.value.some((row) => row.id === id)) continue
      const original = known.value.get(id)
      drafts.value.push({
        id,
        permissions: initialPermissions(original),
        assetId: identities.get(id),
        original,
        resolved: known.value.has(id)
      })
    }
    await resolveTargets([...next])
  }
  function undo(row: AssetBindingDraft) {
    if (saving.value || loading.value) return
    if (!row.original) drafts.value = drafts.value.filter((item) => item.id !== row.id)
    else {
      row.removed = false
      row.permissions = [...row.original.grantedPermissions]
    }
  }
  function remove(row: AssetBindingDraft) {
    if (row.original?.relation === 'owner' || saving.value || loading.value) return
    if (row.original) row.removed = true
    else undo(row)
  }
  function busy(value: boolean) {
    saving.value = value
    events.busy(value)
  }
  async function save() {
    if (
      saving.value ||
      loading.value ||
      error.value ||
      !settings.value ||
      !dirty.value ||
      drafts.value.some((row) => !row.resolved)
    )
      return
    const current = generation
    busy(true)
    error.value = ''
    let close = false,
      changed = false
    const addedIds: string[] = []
    try {
      const { added, updated, removed } = changes.value
      if (added.length) {
        // 各目标独立权限；不发送 allPermission，不通过全量替换删除未选择的其他组织。
        await api.bind(
          declaration.value,
          added.map((row) => ({
            assetId: row.assetId!,
            targetId: context().reverse ? context().subject.id : row.id,
            permissions: settings.value!.permissionSupported ? row.permissions : []
          }))
        )
        if (current !== generation) return
        added.forEach((row) => {
          row.original = {
            targetId: context().reverse ? context().subject.id : row.id,
            grantedPermissions: [...row.permissions]
          }
          known.value.set(row.id, row.original)
          addedIds.push(row.id)
        })
        changed = true
      }
      if (settings.value.permissionSupported)
        for (const row of updated) {
          await api.permissions(
            declaration.value,
            row.assetId!,
            context().reverse ? context().subject.id : row.id,
            row.permissions
          )
          if (current !== generation) return
          row.original!.grantedPermissions = [...row.permissions]
          changed = true
        }
      for (const row of removed) {
        await api.unbind(declaration.value, row.assetId!, context().reverse ? context().subject.id : row.id)
        if (current !== generation) return
        drafts.value = drafts.value.filter((item) => item.id !== row.id)
        known.value.set(row.id, undefined)
        changed = true
      }
      close = true
    } catch (cause) {
      if (current === generation) error.value = message(cause)
    } finally {
      if (current === generation) {
        // 一次保存只刷新一次；部分成功时也通知宿主，失败草稿仍可继续重试。
        if (changed) events.changed({ added: addedIds })
        busy(false)
      }
    }
    if (close && current === generation) events.close()
  }
  function retry() {
    error.value = ''
    return !settings.value
      ? load()
      : resolveTargets([...failed, ...drafts.value.filter((row) => !row.resolved).map((row) => row.id)])
  }
  function setPermissions(row: AssetBindingDraft, permissions: string[]) {
    if (
      !settings.value?.permissionSupported ||
      row.removed ||
      row.original?.relation === 'owner' ||
      saving.value ||
      loading.value
    )
      return
    row.permissions = assetBindingPermissions(settings.value, permissions)
  }
  function applyPermissions(source: AssetBindingDraft) {
    const permissions = [...source.permissions]
    drafts.value.forEach((row) => setPermissions(row, permissions))
  }
  function updateOptions(rows: AssetDimensionOption[]) {
    options.value = [...new Map([...options.value, ...rows].map((row) => [row.value, row])).values()]
  }
  watch(context, load, { immediate: true })
  onScopeDispose(() => {
    generation++
    events.busy(false)
  })
  return {
    settings,
    multiple,
    selector,
    options,
    selectorOptions,
    drafts,
    ids,
    labels,
    known,
    dirty,
    changes,
    reviewIds,
    loading,
    saving,
    error,
    load,
    retry,
    select,
    resolveTargets,
    remove,
    undo,
    save,
    setPermissions,
    applyPermissions,
    updateOptions
  }
}
