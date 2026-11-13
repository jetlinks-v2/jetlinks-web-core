import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { cloneDeep, isEqual } from 'lodash-es'
import { fieldAccess, isEmpty } from './model'
import type { FormAccess, FormField, FormLayout, FormSubmit, FormValidate, FormValues } from './types'

interface SessionOptions {
  fields: () => FormField[]
  layout: () => FormLayout
  values: () => FormValues
  access: () => FormAccess | undefined
  readonly: () => boolean
  submit: () => FormSubmit | undefined
  validate: () => FormValidate | undefined
  requiredMessage: () => string
  failedMessage: () => string
  change: (changes: FormValues) => void
  saved: (values: FormValues) => void
  externalChange: (keys: string[]) => void
}

/** 每个渲染器拥有独立会话；不修改宿主对象，不请求接口或接管路由。 */
export function useFormSession(options: SessionOptions) {
  const baseline = shallowRef<FormValues>({})
  const changes = shallowRef<FormValues>({})
  const errors = shallowRef<Record<string, string>>({})
  const failure = ref('')
  const saving = ref(false)
  let alive = true
  const entries = computed(() => {
    const fields = new Map(options.fields().map(field => [field.key, field]))
    return options.layout().sections.flatMap(section => section.items.flatMap(item => {
      const field = fields.get(item.key)
      return field ? [{ field, item, access: fieldAccess(field, item, options.access()) }] : []
    }))
  })
  const writable = computed(() => new Map(entries.value.filter(entry => entry.access === 'write' && !options.readonly()).map(entry => [entry.field.key, entry.field])))
  const values = computed<FormValues>(() => Object.assign(Object.create(null), baseline.value, changes.value))
  const dirty = computed(() => Object.keys(changes.value).length)
  const value = (key: string) => Object.hasOwn(changes.value, key) ? changes.value[key] : Object.hasOwn(baseline.value, key) ? baseline.value[key] : undefined
  const canWrite = (key: string) => writable.value.has(key)

  // 外部刷新更新基线，保留本地差异并报告冲突；不实现通用合并或锁机制。
  watch(options.values, incoming => {
    const affected = Object.keys(changes.value).filter(key => !isEqual(incoming[key], baseline.value[key]) && !isEqual(incoming[key], changes.value[key]))
    baseline.value = cloneDeep(incoming)
    changes.value = Object.fromEntries(Object.entries(changes.value).filter(([key, value]) => !isEqual(value, incoming[key])))
    if (affected.length) options.externalChange(affected)
  }, { deep: true, immediate: true })

  // 撤权、移出布局和只读切换立即清理不可写草稿与错误，包含保存中的权限变化。
  watch(writable, allowed => {
    changes.value = Object.fromEntries(Object.entries(changes.value).filter(([key]) => allowed.has(key)))
    errors.value = Object.fromEntries(Object.entries(errors.value).filter(([key]) => allowed.has(key)))
  }, { flush: 'sync' })
  watch(changes, patch => options.change(cloneDeep(patch)))
  onScopeDispose(() => { alive = false })

  function validate(key: string, next: unknown, snapshot = values.value) {
    const field = writable.value.get(key)
    if (!field) return undefined
    return field.required && isEmpty(next) ? options.requiredMessage() : options.validate()?.(next, field, snapshot)
  }

  /** 单项确认只写入本地草稿，不触发宿主保存。 */
  function commit(key: string, next: unknown) {
    if (!canWrite(key) || saving.value) return false
    const error = validate(key, next, { ...values.value, [key]: next })
    errors.value = { ...errors.value, [key]: error ?? '' }
    if (error) return false
    const patch = { ...changes.value }
    if (isEqual(next, baseline.value[key])) delete patch[key]
    else patch[key] = cloneDeep(next)
    changes.value = patch
    failure.value = ''
    return true
  }

  function restore(key?: string) {
    if (saving.value) return
    if (key === undefined) { changes.value = {}; errors.value = {} }
    else {
      const patch = { ...changes.value }; delete patch[key]; changes.value = patch
      const remaining = { ...errors.value }; delete remaining[key]; errors.value = remaining
    }
    failure.value = ''
  }

  /** 只提交当前可写差异；失败保留草稿，卸载后的响应不再回写状态或发事件。 */
  async function save() {
    const submit = options.submit()
    if (saving.value || !dirty.value || !submit) return
    errors.value = Object.fromEntries([...writable.value.keys()].flatMap(key => {
      const error = validate(key, value(key))
      return error ? [[key, error]] : []
    }))
    if (Object.keys(errors.value).length) return
    const patch = cloneDeep(changes.value)
    saving.value = true
    failure.value = ''
    try {
      const result = await submit(cloneDeep(patch))
      if (!alive) return
      const fieldErrors = Object.fromEntries(Object.entries(result?.errors ?? {}).filter(([key, error]) => canWrite(key) && error))
      if (Object.values(result?.errors ?? {}).some(Boolean)) {
        errors.value = fieldErrors
        if (!Object.keys(fieldErrors).length) failure.value = options.failedMessage()
        return
      }
      const readable = new Set(entries.value.filter(entry => entry.access !== 'denied' && entry.access !== 'hidden').map(entry => entry.field.key))
      const accepted = Object.fromEntries(Object.entries({ ...patch, ...result?.values }).filter(([key]) => readable.has(key)))
      baseline.value = { ...baseline.value, ...cloneDeep(accepted) }
      changes.value = {}
      errors.value = {}
      options.saved(cloneDeep(accepted))
    } catch (error) {
      if (alive) failure.value = error instanceof Error ? error.message : options.failedMessage()
    } finally {
      if (alive) saving.value = false
    }
  }

  return { values, changes, errors, failure, saving, dirty, value, canWrite, commit, restore, save }
}
