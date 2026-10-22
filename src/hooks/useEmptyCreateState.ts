import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

export type EmptyCreateSearch = boolean | string | readonly unknown[] | null | undefined

/**
 * 在页面已有的成功空态内控制新增入口，不接管或补发列表请求。
 * 传入已生效的用户搜索状态，固定业务条件与未提交的输入草稿不属于搜索。
 */
export function useEmptyCreateState(search: MaybeRefOrGetter<EmptyCreateSearch>) {
  const hasSearch = computed(() => {
    const value = toValue(search)
    if (typeof value === 'string') return value.trim().length > 0
    return Array.isArray(value) ? value.length > 0 : Boolean(value)
  })
  const showEmptyCreate = computed(() => !hasSearch.value)

  return { hasSearch, showEmptyCreate }
}
