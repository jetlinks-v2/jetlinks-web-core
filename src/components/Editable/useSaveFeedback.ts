import { computed, onScopeDispose, ref, watch } from 'vue'

export type SaveFeedbackState = '' | 'unsaved' | 'saving' | 'saved'

/** 只呈现宿主的保存回执，不发起请求或改变字段提交边界。 */
export function useSaveFeedback(options: { enabled?: () => boolean; saving: () => boolean; dirty: () => boolean }) {
  const saved = ref(false)
  const enabled = () => options.enabled?.() ?? true
  const feedback = computed<SaveFeedbackState>(() => !enabled() ? '' : options.saving() ? 'saving' : saved.value ? 'saved' : options.dirty() ? 'unsaved' : '')
  let savedTimer: ReturnType<typeof setTimeout> | undefined
  let disposed = false
  const pending = new Set<() => void>()

  function resetFeedback() {
    if (savedTimer !== undefined) clearTimeout(savedTimer)
    savedTimer = undefined
    saved.value = false
  }

  function markSaved() {
    resetFeedback()
    if (!enabled() || disposed) return
    saved.value = true
    savedTimer = setTimeout(resetFeedback, 2000)
  }

  function minimumFeedback() {
    if (!enabled() || disposed) return Promise.resolve()
    return new Promise<void>(resolve => {
      const finish = () => { clearTimeout(timer); pending.delete(finish); resolve() }
      const timer = setTimeout(finish, 500)
      pending.add(finish)
    })
  }

  watch(enabled, value => { if (!value) resetFeedback() })
  onScopeDispose(() => {
    disposed = true
    resetFeedback()
    for (const finish of pending) finish()
  })
  return { feedback, resetFeedback, markSaved, minimumFeedback }
}
