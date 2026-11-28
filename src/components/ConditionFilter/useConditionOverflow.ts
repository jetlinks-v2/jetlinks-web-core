import { computed, nextTick, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import { useResizeObserver } from '@vueuse/core'

/** 只改变溢出条件的呈现，不复制编辑器或参与查询提交。 */
export function useConditionOverflow(options: {
  enabled: MaybeRefOrGetter<boolean>
  shell: Ref<HTMLElement | undefined>
  content: Ref<HTMLElement | undefined>
  more?: Ref<HTMLElement | undefined>
  label: MaybeRefOrGetter<string>
  panelsOpen: MaybeRefOrGetter<boolean>
}) {
  const focused = ref(false), overflowed = ref(false)
  const expanded = computed(() => toValue(options.enabled) && overflowed.value && (focused.value || toValue(options.panelsOpen)))
  const showSummary = computed(() => toValue(options.enabled) && overflowed.value && !expanded.value)
  function measure() {
    if (!toValue(options.enabled) || !toValue(options.label)) { overflowed.value = false; return }
    // 展开后内容已换行，不能用换行后的宽度反过来关闭浮层。
    if (expanded.value) return
    const content = options.content.value
    const reserved = options.more?.value ? options.more.value.getBoundingClientRect().width + 4 : 0
    if (content?.clientWidth) overflowed.value = content.scrollWidth > content.clientWidth + reserved + 1
  }
  const schedule = () => { void nextTick(measure) }
  useResizeObserver([options.shell, options.content], schedule)
  watch([() => toValue(options.enabled), () => toValue(options.label), expanded], schedule, { immediate: true })
  function focusOut(event: FocusEvent) {
    focused.value = !!event.relatedTarget && !!options.shell.value?.contains(event.relatedTarget as Node)
  }
  function finish() {
    options.shell.value?.querySelector<HTMLElement>(':focus')?.blur()
    focused.value = false
  }
  return { expanded, showSummary, focused, focusOut, finish, measure }
}
