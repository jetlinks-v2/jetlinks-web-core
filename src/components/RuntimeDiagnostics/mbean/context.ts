import { computed, inject, onScopeDispose, readonly, shallowRef, watch, type ComputedRef, type InjectionKey } from 'vue'
import type { ActionAccess, MBeanDescriptor, MBeanInvocation, MBeanInvocationOutcome, MBeanQuerySnapshot, MBeanRendererContext } from '../types'
import { availableMBeanQueries, mbeanQueryInvocation } from './queries'

export const mbeanRendererContextKey: InjectionKey<MBeanRendererContext> = Symbol('MBeanRendererContext')
/** 自定义 renderer 可选消费；独立使用摘要时无执行能力，默认关闭操作。 */
export const useMBeanRendererContext = () => inject(mbeanRendererContextKey, undefined)

interface QueryContextOptions {
  bean: ComputedRef<MBeanDescriptor | undefined>; target: ComputedRef<string>; active: ComputedRef<boolean>
  access: ComputedRef<ActionAccess>; busy: ComputedRef<boolean>
  execute: ComputedRef<((invocation: MBeanInvocation) => Promise<MBeanInvocationOutcome | undefined>) | undefined>
}

/** 一次请求一个身份；停用只作废在途结果，目标变化或撤权才清除已完成的阅读内容。 */
export function useMBeanQueryContext(options: QueryContextOptions) {
  const snapshot = shallowRef<MBeanQuerySnapshot>(), pending = shallowRef(false)
  const resultSource = shallowRef<'summary' | 'generic'>('generic')
  const availableQueries = computed(() => availableMBeanQueries(options.bean.value))
  const access = computed<ActionAccess>(() => ({ allowed: options.access.value.allowed && !!options.execute.value && !!options.target.value,
    reason: options.access.value.reason }))
  const busy = computed(() => options.busy.value || pending.value)
  let generation = 0, settled: MBeanQuerySnapshot | undefined
  function invalidate(clear: boolean) {
    generation++; pending.value = false
    if (clear) { settled = undefined; snapshot.value = undefined }
    else snapshot.value = settled
  }
  const context: MBeanRendererContext = {
    access, busy, availableQueries, snapshot: readonly(snapshot),
    async query(id, values) {
      const bean = options.bean.value, execute = options.execute.value
      if (!bean || !execute || !options.active.value || !access.value.allowed || busy.value) return
      const invocation = mbeanQueryInvocation(bean, id, values)
      if (!invocation) return
      const requestId = ++generation, target = options.target.value, objectName = bean.objectName
      const identity = { requestId, target, objectName, queryId: id }
      pending.value = true; resultSource.value = 'summary'
      snapshot.value = { ...identity, state: { status: 'loading' }, result: settled?.queryId === id ? settled.result : undefined }
      try {
        const outcome = await execute(invocation)
        if (generation !== requestId) return
        if (outcome) settled = { ...identity, ...outcome }
        snapshot.value = settled
      } catch (error) {
        if (generation === requestId) {
          settled = { ...identity, state: { status: 'error', message: error instanceof Error ? error.message : undefined } }
          snapshot.value = settled
        }
      } finally { if (generation === requestId) pending.value = false }
    },
  }
  watch([options.target, () => options.bean.value?.objectName, () => options.access.value.allowed], () => invalidate(true), { flush: 'sync' })
  watch(options.active, active => { if (!active) invalidate(false) }, { flush: 'sync' })
  watch(options.execute, () => invalidate(true), { flush: 'sync' })
  watch(availableQueries, ids => { if (snapshot.value && !ids.includes(snapshot.value.queryId)) invalidate(true) }, { flush: 'sync' })
  onScopeDispose(() => invalidate(true))
  /** 普通方法仍由原确认表单执行，其返回值不能被摘要查询消费，反之亦然。 */
  function beginGenericInvocation() { invalidate(false); resultSource.value = 'generic' }
  return { context, resultSource, beginGenericInvocation }
}
