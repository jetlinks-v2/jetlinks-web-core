import { computed, ref } from 'vue'
import { useEmptyCreateState } from '../src/hooks/useEmptyCreateState'

const state = useEmptyCreateState(ref('keyword'))
const searching: boolean = state.hasSearch.value
const creating: boolean = state.showEmptyCreate.value
void [searching, creating]

useEmptyCreateState(() => [{ column: 'name', value: 'keyword' }] as const)
useEmptyCreateState(computed(() => true))
useEmptyCreateState(false)
useEmptyCreateState(undefined)

// @ts-expect-error 派生状态不能被调用方覆盖。
state.hasSearch.value = false
// @ts-expect-error 原查询方法不再是 Hook 入参，避免保留补查契约。
useEmptyCreateState(async (_query: object) => ({ total: 0 }))
// @ts-expect-error 必须传用户搜索状态，不能传混有默认业务条件的整个查询对象。
useEmptyCreateState({ terms: [{ column: 'parentId', value: 'parent-a' }] })
// @ts-expect-error Hook 不再接管列表请求。
state.request({})
