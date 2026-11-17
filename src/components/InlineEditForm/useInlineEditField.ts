import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { InlineEditFieldProps } from './types'

const copy = (value: unknown): unknown => value === undefined ? undefined : JSON.parse(JSON.stringify(value))
const equal = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)

/** Own only editing state. The host owns draft persistence, validation and the asynchronous write. */
export function useInlineEditField(props: InlineEditFieldProps, change: (key: string, value: unknown) => void, cancelled?: (key: string) => void) {
  const value = ref<unknown>(copy(props.field.value))
  const editing = ref(!equal(props.field.value, props.field.initialValue) || !!props.field.error)
  const pending = ref(false)
  const failure = ref('')
  let generation = 0
  const active = computed(() => props.mode === 'form' || editing.value)
  const locked = computed(() => props.disabled || props.busy || pending.value || !!props.field.readonly)
  const error = computed(() => failure.value || props.field.error)
  const explicit = computed(() => ['custom', 'textarea'].includes(props.field.editor || ''))
  const display = computed(() => {
    if (props.field.editor === 'password') return props.field.secretSet ? '••••••••' : props.messages.empty
    if (props.field.displayValue !== undefined) return props.field.displayValue
    const saved = props.field.initialValue
    if (props.field.editor === 'select') return props.field.options?.find(option => option.value === saved)?.label ?? props.messages.empty
    return saved === undefined || saved === null || saved === '' ? props.messages.empty : typeof saved === 'object' ? JSON.stringify(saved) : String(saved)
  })

  function begin() {
    if (locked.value) return
    editing.value = true
    failure.value = ''
  }

  function update(next: unknown) {
    if (locked.value) return
    value.value = copy(next)
    failure.value = ''
    change(props.field.key, copy(next))
  }

  /** Cancellation is explicit and never starts a write, including when a failed value is still present. */
  function cancel() {
    if (pending.value || props.busy) return
    value.value = copy(props.field.initialValue)
    change(props.field.key, copy(props.field.initialValue))
    cancelled?.(props.field.key)
    failure.value = ''
    editing.value = false
  }

  async function commit() {
    if (props.mode === 'form' || locked.value || !props.submit || !editing.value) return
    if (equal(value.value, props.field.initialValue) || props.field.editor === 'password' && !value.value) {
      cancel()
      return
    }
    const version = ++generation
    pending.value = true
    failure.value = ''
    try {
      const result = await props.submit(props.field.key, copy(value.value))
      if (version !== generation) return
      if (result.ok) editing.value = false
      else failure.value = result.error || props.messages.failed
    } catch {
      if (version === generation) failure.value = props.messages.failed
    } finally {
      if (version === generation) pending.value = false
    }
  }

  /** Commit after focus leaves the whole editor, never between controls of a compound value. */
  async function blur(event: FocusEvent) {
    const scope = event.currentTarget as HTMLElement | null
    if (!scope || scope.contains(event.relatedTarget as Node | null)) return
    const version = generation
    await nextTick()
    if (version !== generation || scope.contains(scope.ownerDocument.activeElement)) return
    await commit()
  }

  function keydown(event: KeyboardEvent) {
    if (props.mode === 'form' || event.isComposing) return
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel() }
    if (event.key === 'Enter' && !explicit.value) { event.preventDefault(); void commit() }
  }

  watch(() => props.field.value, next => { value.value = copy(next) })
  watch(() => props.field.key, () => {
    ++generation
    pending.value = false
    failure.value = ''
    value.value = copy(props.field.value)
    editing.value = !equal(props.field.value, props.field.initialValue) || !!props.field.error
  })
  onBeforeUnmount(() => { ++generation })
  return { value, editing, active, pending, locked, error, explicit, display, begin, update, cancel, commit, blur, keydown }
}
