import type { EChartsCoreOption } from 'echarts/core'

const components = new Set(['series', 'xAxis', 'yAxis', 'dataset'])
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

/** Compose initial/configuration options without merging data arrays by index.
 * Component ids preserve authored metadata; ordinary sample writes bypass composition entirely.
 */
export function composeStreamOption(option: EChartsCoreOption = {}, data?: EChartsCoreOption): EChartsCoreOption {
  if (!data) return option
  // ECharts ignores sibling fields when baseOption is authored explicitly.
  if (object(option.baseOption)) return { ...option, baseOption: composeStreamOption(option.baseOption as EChartsCoreOption, data) }
  function merge(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
    const result = { ...base }
    for (const [key, value] of Object.entries(patch)) result[key] = object(value) && object(base[key]) ? merge(base[key], value) : value
    return result
  }
  const result = { ...option } as Record<string, unknown>
  for (const [key, value] of Object.entries(data)) {
    if (!components.has(key)) { result[key] = object(value) && object(result[key]) ? merge(result[key], value) : value; continue }
    const authored = result[key], base = authored === undefined ? [] : Array.isArray(authored) ? authored : [authored]
    const patches = Array.isArray(value) ? value : [value], combined = [...base]
    patches.forEach((patch, index) => {
      if (!object(patch)) return
      const position = patch.id === undefined ? index : base.findIndex(item => object(item) && item.id === patch.id)
      const target = position < 0 ? combined.length : position
      combined[target] = merge(object(base[target]) ? base[target] : {}, patch)
    })
    result[key] = Array.isArray(authored) || Array.isArray(value) ? combined : combined[0]
  }
  return result as EChartsCoreOption
}
