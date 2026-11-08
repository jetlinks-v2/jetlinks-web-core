import type { MetricCalculatorDescriptor, MetricCalculatorSpec, MetricParameter, MetricTemplate } from '../types'
import type { TemplateRule } from './designer'
import { ruleDataReferences } from './formula'
import { copy } from '../service'
import { encodeConfiguration } from './configurationText'

export const calculatorKey = (item: MetricCalculatorDescriptor) => JSON.stringify([item.configuration.provider, item.configuration.providerVersion, item.id])
/** 功能选择同时匹配提供者、精确版本和操作；不能把未知操作误认成默认算法。 */
export function findCalculator(spec: MetricCalculatorSpec | undefined, items: MetricCalculatorDescriptor[]) {
  return items.find(item => item.configuration.provider === spec?.provider && item.configuration.providerVersion === spec?.providerVersion
    && item.configuration.parameters?.operation === spec?.parameters?.operation)
}
export function interactiveCalculator(spec: MetricCalculatorSpec | undefined, descriptor?: MetricCalculatorDescriptor) {
  const aliases = Object.keys(descriptor?.configuration.inputTypes || {})
  return !!aliases.length && !!spec && aliases.length === Object.keys(spec.inputTypes || {}).length
    && aliases.every(id => Object.hasOwn(spec.inputTypes || {}, id))
}
export function algorithmSources(template: MetricTemplate, rule: TemplateRule) {
  return ruleDataReferences(template, rule).map(item => {
    const input = template.inputDefinitions.find(input => input.id === item.id)
    const calculation = template.definitions.find(definition => definition.id === item.id) as TemplateRule | undefined
    return { ...item, valueType: input?.valueType || calculation?.calculator?.outputType, lookback: input?.source?.lookback }
  })
}
/** 显式更换算法时使用提供者的配置起点；只保留名称相同的输入绑定。 */
export function chooseAlgorithm(rule: TemplateRule, item: MetricCalculatorDescriptor): Partial<TemplateRule> {
  const calculator = copy(item.configuration)
  const inputs = (rule.inputs || []).filter(input => input.id && Object.hasOwn(calculator.inputTypes || {}, input.id))
  return { calculator, inputs, sourceMetric: undefined }
}
/** 关联来源只修改当前别名，不重写其他节点的历史取数范围。 */
export function bindAlgorithmInput(rule: TemplateRule, alias: string, metricId: string, valueType?: Record<string, unknown>, descriptor?: MetricCalculatorDescriptor): Partial<TemplateRule> {
  const calculator = copy(rule.calculator || {})
  const previous = rule.inputs?.find(input => input.id === alias)
  const inputs = (rule.inputs || []).filter(input => input.id !== alias)
  if (metricId) inputs.push({ ...previous, id: alias, metricId, source: undefined })
  if (valueType && calculator.inputTypes?.[alias]) {
    const expected = calculator.inputTypes[alias]
    calculator.inputTypes[alias] = expected.type === 'array' && valueType.type !== 'array'
      ? { ...expected, elementType: copy(valueType) } : copy(valueType)
    // 输入类型改变后，不能把旧数字悄悄显示为一个布尔开关值。要求用户明确选定新的状态含义。
    if (valueType.type === 'boolean') {
      calculator.parameters = { ...calculator.parameters }
      for (const parameter of descriptor?.parameterDefinitions || []) {
        if (parameter.expands?.typeFromInput === alias && typeof calculator.parameters[parameter.id] !== 'boolean') delete calculator.parameters[parameter.id]
      }
    }
  }
  return { calculator, inputs }
}
export function algorithmParameter(parameter: MetricParameter, spec: MetricCalculatorSpec): MetricParameter {
  const alias = parameter.expands?.typeFromInput
  const input = typeof alias === 'string' ? spec.inputTypes?.[alias] : undefined
  const valueType = input?.type === 'array' ? input.elementType : input
  return valueType && typeof valueType === 'object' && !Array.isArray(valueType)
    ? { ...parameter, valueType: valueType as MetricParameter['valueType'] } : parameter
}
export function visibleAlgorithmParameters(descriptor: MetricCalculatorDescriptor | undefined, spec: MetricCalculatorSpec, advanced: boolean) {
  return (descriptor?.parameterDefinitions || []).filter(parameter => {
    if (!!parameter.expands?.advanced !== advanced) return false
    const condition = parameter.expands?.visibleWhen
    return !condition || typeof condition !== 'object' || Object.entries(condition).every(([key, value]) => spec.parameters?.[key] === value)
  }).map(parameter => algorithmParameter(parameter, spec))
}
/** 输出沿用实际类型；已有声明没有展示名称时只借用描述名称，不修改执行类型。 */
export function algorithmOutputFields(spec: MetricCalculatorSpec, descriptor?: MetricCalculatorDescriptor) {
  const properties = spec.outputType?.properties
  if (!Array.isArray(properties)) return []
  const defaults = descriptor?.configuration.outputType?.properties
  return properties.map((property: MetricParameter) => ({ ...property,
    name: property.name || (Array.isArray(defaults) ? defaults.find(item => item.id === property.id)?.name : undefined) || property.id }))
}

export interface AlgorithmSuggestion { label: string; detail?: string; insertText: string }
/** 轻量 YAML 键/值建议。只分析光标之前的缩进，不维护第二套算法语义校验器。 */
export function algorithmSuggestions(prefix: string, spec: MetricCalculatorSpec, descriptor: MetricCalculatorDescriptor | undefined, descriptors: MetricCalculatorDescriptor[]): AlgorithmSuggestion[] {
  const lines = prefix.split('\n')
  const current = lines.pop() || ''
  const stack: { key: string; indent: number }[] = []
  const indent = current.search(/\S|$/)
  for (const line of lines) {
    const match = line.match(/^( *)([\w-]+):\s*(?:#.*)?$/)
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    const level = line.search(/\S/)
    while (stack.length && stack.at(-1)!.indent >= level) stack.pop()
    if (match) stack.push({ key: match[2], indent: match[1].length })
  }
  while (stack.length && stack.at(-1)!.indent >= indent) stack.pop()
  const path = stack.map(item => item.key).join('.')
  const entry = current.trimStart().match(/^([\w-]+):\s*([^#]*)$/)
  const values = (items: { value: unknown; text?: string }[]) => items.map(item => ({ label: String(item.value), detail: item.text,
    insertText: encodeConfiguration(item.value, 'yaml').trim() }))
  if (entry) {
    if (!path && entry[1] === 'provider') return values([...new Set(descriptors.map(item => item.configuration.provider).filter(Boolean))].map(value => ({ value })))
    if (!path && entry[1] === 'providerVersion') return values([...new Set(descriptors.filter(item => item.configuration.provider === spec.provider).map(item => item.configuration.providerVersion))].map(value => ({ value })))
    if (path === 'parameters') {
      const parameter = descriptor?.parameterDefinitions.find(item => item.id === entry[1])
      const elements = parameter?.valueType?.elements
      if (Array.isArray(elements)) return values(elements)
      if (parameter?.expands?.editor === 'duration') return values(['PT1M', 'PT5M', 'PT1H'].map(value => ({ value })))
      if (entry[1] === 'operation') return values(descriptors.filter(item => item.configuration.provider === spec.provider && item.configuration.providerVersion === spec.providerVersion)
        .flatMap(item => item.configuration.parameters?.operation ? [{ value: item.configuration.parameters.operation, text: item.name }] : []))
    }
    return []
  }
  const keys = path === 'parameters'
    ? [...new Set([...Object.keys(spec.parameters || {}), ...(descriptor?.parameterDefinitions || []).map(item => item.id)])]
    : !path ? ['provider', 'providerVersion', 'modelVersion', 'inputTypes', 'outputType', 'outputUnit', 'parameters', 'predictionHorizon'] : []
  return keys.map(key => {
    const parameter = descriptor?.parameterDefinitions.find(item => item.id === key)
    const value = path === 'parameters' ? spec.parameters?.[key] ?? descriptor?.configuration.parameters?.[key] : spec[key]
    const encoded = value === undefined ? '' : encodeConfiguration(value, 'yaml').trimEnd()
    const serialized = encoded.includes('\n') ? `\n${encoded.split('\n').map(line => ' '.repeat(indent + 2) + line).join('\n')}` : ` ${encoded}`
    return { label: key, detail: parameter?.name, insertText: `${key}:${serialized}` }
  })
}
