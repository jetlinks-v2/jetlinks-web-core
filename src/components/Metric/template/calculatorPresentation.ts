import type { MetricCalculatorDescriptor, MetricCalculatorSpec } from '../types'

// 内置操作的图标只承担展示职责，不能用于识别能力或推断执行声明。
const icons: Record<string, Record<string, string>> = {
  measurement:{ increase:'RiseOutlined', integral:'AreaChartOutlined' },
  state:{ duration:'ClockCircleOutlined' },
  signal:{ rms:'DashboardOutlined', mad:'DotChartOutlined', rate:'LineChartOutlined', ewma:'SlidersOutlined', difference:'SwapOutlined' },
}

export function calculatorIcon(item?: MetricCalculatorDescriptor): string {
  if (!item) return 'CalculatorOutlined'
  return icons[item.configuration.provider || '']?.[item.id]
    || (Object.keys(item.configuration.inputTypes || {}).length ? 'CalculatorOutlined' : 'CodeOutlined')
}

/** 图例解释对应版本的算法契约，不按业务模板名或本地化名称猜测。 */
export type CalculatorGuide = 'stateDuration' | 'increase' | 'integral' | 'rms' | 'mad' | 'rate' | 'ewma' | 'difference' | 'align' | 'hampel' | 'spectrum'
export function calculatorGuide(spec: MetricCalculatorSpec): CalculatorGuide | undefined {
  if (spec.providerVersion !== '1') return
  const operation = spec.parameters?.operation
  if (spec.provider === 'state' && (operation == null || operation === 'duration')) return 'stateDuration'
  if (spec.provider === 'measurement' && (operation === 'increase' || operation === 'integral')) return operation
  if (spec.provider === 'signal' && ['rms','mad','rate','ewma','difference','align','hampel','spectrum'].includes(String(operation))) return operation as CalculatorGuide
}

export function calculatorOption(item: MetricCalculatorDescriptor, t: (key:string, values?:Record<string, unknown>) => string) {
  const description = item.description || (!Object.keys(item.configuration.inputTypes || {}).length ? t('algorithmYamlOptionHint') : '')
  const version = item.configuration.providerVersion
  return { label:item.name || item.id, icon:calculatorIcon(item), description:[description, version ? t('algorithmVersion', { version }) : ''].filter(Boolean).join(' · ') }
}
