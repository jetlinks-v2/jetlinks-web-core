import { computed, onScopeDispose, ref } from 'vue'
import { countDevices, countGroups, groups, queryDetails, queryNoPaging, type Device, type DeviceDetail, type DeviceCounts, type Query } from './data.ts'
import type { ConditionFilterTerm, ConditionExpressionNode } from '../../../src/components/ConditionFilter/types'

function isStatusCondition(term: ConditionFilterTerm): boolean {
  if (term.terms) return term.terms.length > 0 && term.terms.every((item, index) => (!index || item.type === 'or') && 'column' in item && item.column === 'status' && item.termType === 'eq' && typeof item.value === 'string')
  return term.column === 'status' && term.termType === 'eq' && typeof term.value === 'string'
}
function splitStatus(terms: ConditionFilterTerm[]) {
  // A mixed top-level OR remains one search expression; shortcut status intersects it.
  if (terms.some((term, index) => index > 0 && term.type === 'or')) return { base: terms, status: [] }
  return { base: terms.filter(term => !isStatusCondition(term)), status: terms.filter(isStatusCondition) }
}

export function useDeviceList() {
  const group = ref('cooling'), terms = ref<ConditionFilterTerm[]>([])
  const rows = ref<Device[]>([]), details = ref<Record<string, DeviceDetail>>({})
  const counts = ref<DeviceCounts>(), countLoading = ref(false), countError = ref(false)
  const groupCounts = ref<Record<string, number>>(), groupCountLoading = ref(false), groupCountError = ref(false)
  const total = computed(() => counts.value?.total)
  const loading = ref(false), pendingSlots = ref(0), ended = ref(false), error = ref('')
  const detailErrors = ref<string[]>([]), revision = ref(0)
  const groupName = computed(() => groups.find(item => item.id === group.value)?.name ?? '全部点位')
  const activeDistribution = computed(() => {
    const status = splitStatus(terms.value).status
    if (!status.length) return 'total'
    if (status.length !== 1) return undefined
    const values = status[0].terms?.map(item => 'value' in item ? item.value : undefined) ?? [status[0].value]
    return values.length === 2 && values.includes('high') && values.includes('low') ? 'attention'
      : values.length === 1 && ['normal', 'offline'].includes(values[0]) ? values[0] as 'normal' | 'offline' : undefined
  })
  let owner = new AbortController(), countOwner = new AbortController(), query: Query, countQuery: Query
  let appliedTerms: ConditionFilterTerm[] = [], countIdentity = '', groupCountIdentity = ''
  let groupCountOwner = new AbortController(), groupCountTerms: ConditionFilterTerm[] = []
  let detailQueue = Promise.resolve()

  async function loadGroupCounts() {
    const scope = groupCountOwner, snapshot = groupCountTerms
    groupCountLoading.value = true; groupCountError.value = false
    try {
      const result = await countGroups(snapshot, scope.signal)
      if (scope === groupCountOwner && !scope.signal.aborted) groupCounts.value = result
    } catch {
      if (scope === groupCountOwner && !scope.signal.aborted) groupCountError.value = true
    } finally {
      if (scope === groupCountOwner) groupCountLoading.value = false
    }
  }

  async function loadCount() {
    const scope = countOwner, snapshot = countQuery
    countLoading.value = true; countError.value = false
    try {
      const count = await countDevices(snapshot, scope.signal)
      if (scope === countOwner && !scope.signal.aborted) counts.value = count
    } catch {
      if (scope === countOwner && !scope.signal.aborted) countError.value = true
    } finally {
      if (scope === countOwner) countLoading.value = false
    }
  }
  function loadDetails(ids: string[]) {
    const scope = owner
    detailErrors.value = detailErrors.value.filter(id => !ids.includes(id))
    detailQueue = detailQueue.then(async () => {
      if (scope !== owner || scope.signal.aborted) return
      try {
        const result = await queryDetails(ids, scope.signal)
        if (scope === owner && !scope.signal.aborted) Object.assign(details.value, result)
      } catch {
        if (scope === owner && !scope.signal.aborted) detailErrors.value.push(...ids)
      }
    })
  }
  async function loadMore() {
    if (loading.value || ended.value || owner.signal.aborted) return
    const scope = owner, snapshot = query, ids: string[] = []
    loading.value = true; pendingSlots.value = 6; error.value = ''
    try {
      for await (const item of queryNoPaging(snapshot, rows.value.length, scope.signal)) {
        if (scope !== owner || scope.signal.aborted) return
        rows.value.push(item); ids.push(item.id); pendingSlots.value--
      }
      if (scope !== owner || scope.signal.aborted) return
      ended.value = ids.length < 6
      if (ids.length) loadDetails(ids)
    } catch {
      if (scope === owner && !scope.signal.aborted) error.value = '点位暂未加载成功'
    } finally {
      if (scope === owner) { loading.value = false; pendingSlots.value = 0 }
    }
  }
  function reload() {
    owner.abort(); owner = new AbortController(); detailQueue = Promise.resolve()
    query = { group: group.value, terms: JSON.parse(JSON.stringify(appliedTerms)) }
    rows.value = []; details.value = {}; detailErrors.value = []
    loading.value = false; ended.value = false; revision.value++
    const nextCountQuery = { ...query, terms: splitStatus(query.terms).base }
    const identity = JSON.stringify(nextCountQuery)
    const groupIdentity = JSON.stringify(nextCountQuery.terms)
    if (groupIdentity !== groupCountIdentity) {
      groupCountOwner.abort(); groupCountOwner = new AbortController(); groupCountIdentity = groupIdentity
      groupCountTerms = nextCountQuery.terms; groupCounts.value = undefined
      void loadGroupCounts()
    }
    if (identity !== countIdentity) {
      countOwner.abort(); countOwner = new AbortController(); countIdentity = identity
      countQuery = nextCountQuery; counts.value = undefined
      void loadCount()
    }
    void loadMore()
  }
  function applyTerms(value: ConditionFilterTerm[]) { appliedTerms = value; reload() }
  function chooseDistribution(key: keyof DeviceCounts) {
    const { base } = splitStatus(terms.value)
    const next: ConditionFilterTerm[] = base.some((term, index) => index > 0 && term.type === 'or')
      ? [{ terms: base as ConditionExpressionNode[] }] : [...base]
    if (key !== 'total' && activeDistribution.value !== key) next.push(key === 'attention'
      ? { type: 'and', terms: [{ column: 'status', termType: 'eq', value: 'high' }, { column: 'status', termType: 'eq', value: 'low', type: 'or' }] }
      : { type: 'and', column: 'status', termType: 'eq', value: key })
    terms.value = next
  }
  function chooseGroup(value: string) { group.value = value; reload() }
  onScopeDispose(() => { owner.abort(); countOwner.abort(); groupCountOwner.abort() })
  reload()
  return { group, terms, groupName, rows, details, total, counts, countLoading, countError, loading, pendingSlots,
    groupCounts, groupCountLoading, groupCountError, loadGroupCounts,
    ended, error, detailErrors, revision, activeDistribution, applyTerms, chooseDistribution, reload, chooseGroup, loadMore, loadCount, loadDetails }
}
