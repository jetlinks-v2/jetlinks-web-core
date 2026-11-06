import { onScopeDispose, shallowRef, watch, type Ref } from 'vue'
import { metricApi } from './api'
import type { MetricApi, MetricCalculatorDescriptor } from './types'

/** 面板共用当前语言的算法元数据，刷新数值不重复加载；过期语言响应不覆盖新语言。 */
export function useMetricCalculators(locale: Readonly<Ref<string>>, api: MetricApi = metricApi) {
  const calculators = shallowRef<MetricCalculatorDescriptor[]>([])
  let generation = 0
  watch(() => locale.value, async () => {
    const token = ++generation
    calculators.value = []
    try {
      const values = await api.calculators()
      if (token === generation) calculators.value = values
    } catch {
      // 元数据不可读时仍按模板声明显示；不阻断业务结果，也不猜测算法字段含义。
      if (token === generation) calculators.value = []
    }
  }, { immediate:true })
  onScopeDispose(() => { generation++ })
  return calculators
}
