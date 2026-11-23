import { computed, ref, watch, type Ref } from 'vue'
import { DEFAULT_PAGE_SIZE } from './defaults'

/** 只切分已过滤的数据；树表按根节点切片，不拆散子树。 */
export function useLocalPagination<T>(items: Readonly<Ref<T[]>>) {
  const current = ref(1)
  const pageSize = ref(DEFAULT_PAGE_SIZE)
  const total = computed(() => items.value.length)
  const lastPage = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
  watch(lastPage, last => { current.value = Math.min(current.value, last) })
  const rows = computed(() => items.value.slice((current.value - 1) * pageSize.value, current.value * pageSize.value))
  function changePage(page: number, size: number) {
    current.value = size === pageSize.value ? Math.min(page, lastPage.value) : 1
    pageSize.value = size
  }
  return { current, pageSize, total, rows, changePage, reset: () => { current.value = 1 } }
}
