import { computed, inject, onScopeDispose, provide, shallowReactive, toValue, watchEffect, type InjectionKey, type MaybeRefOrGetter, type Ref } from 'vue'
import { useElementSize } from '@vueuse/core'

type Row = 'header' | 'toolbar' | 'footer'
type Entry = { row: Row; height: number }
const rowsKey: InjectionKey<ReturnType<typeof createPaneRows>> = Symbol('splitter-pane-rows')

function createPaneRows(enabled: MaybeRefOrGetter<boolean>) {
  const entries = shallowReactive(new Map<symbol, Entry>())
  return {
    entries,
    height: (row: Row) => computed(() => toValue(enabled)
      ? Math.ceil(Math.max(0, ...[...entries.values()].filter(entry => entry.row === row).map(entry => entry.height))) : 0),
  }
}

/** 只测自然内容，统一高度施加在外层，内容缩短时也能恢复。 */
export function providePaneRows(enabled: MaybeRefOrGetter<boolean> = true) {
  const rows = createPaneRows(enabled)
  provide(rowsKey, rows)
  return rows
}

export function usePaneRow(row: Row, content: Ref<HTMLElement | undefined>, rows = inject(rowsKey, undefined)) {
  const { height } = useElementSize(content, { width: 0, height: 0 }, { box: 'border-box' })
  const key = Symbol(row)
  watchEffect(() => rows?.entries.set(key, { row, height: height.value || 0 }))
  onScopeDispose(() => rows?.entries.delete(key))
  return rows?.height(row) ?? computed(() => 0)
}
