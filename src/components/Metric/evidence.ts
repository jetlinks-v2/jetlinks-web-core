import { metricValueFields, metricValueLabels, metricValueSchema, metricValueUnit, schemaValueLabels, semanticValueText, type ValueTranslate } from './valueSemantics'
import type { MetricEvidence, MetricSnapshotValue, MetricTemplate } from './types'

/** Group only recorded values. Current template metadata supplies labels, never replacement data. */
export function evidenceGroups(evidence:MetricEvidence | undefined, template:MetricTemplate, kind:MetricSnapshotValue['kind'], outputId?:string) {
  const groups = new Map<string, { id:string; name:string; metricId:string; values:MetricSnapshotValue[]; input?:NonNullable<MetricEvidence['inputs']>[number] }>()
  const add = (id:string) => {
    if (!groups.has(id)) {
      const definition = template.definitions.find(rule=>rule.id === outputId || (rule.windowFamily as {ranges?:{outputs?:{id:string}[]}[]} | undefined)
        ?.ranges?.some(range=>range.outputs?.some(output=>output.id === outputId)))
      const binding = (Array.isArray(definition?.inputs) ? definition.inputs as { id:string; metricId:string }[] : []).find(item => item.id === id)
      const metricId = binding?.metricId || id
      const declaration = kind === 'calculatorParameter' ? undefined : kind === 'parameter' ? template.parameterDefinitions.find(item => item.id === id)
        : template.inputDefinitions.find(item => item.id === metricId) || template.definitions.find(item => item.id === metricId)
      groups.set(id, { id, metricId, name:String(declaration?.name || id), values:[], input:kind === 'input' ? evidence?.inputs?.find(item => item.inputId === id) : undefined })
    }
    return groups.get(id)!
  }
  for (const value of evidence?.execution?.values || []) if (value.kind === kind) add(value.id).values.push(value)
  if (kind === 'input') for (const input of evidence?.inputs || []) add(input.inputId)
  return [...groups.values()]
}

/** Render typed leaves with the existing schema/state/duration semantics; exact large integers remain text. */
export function evidenceValue(value:MetricSnapshotValue, metricId:string, template:MetricTemplate, locale:string, t:ValueTranslate) {
  const tokens = value.path.split('/').slice(1).map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'))
  const duration = tokens[0] === 'state' && tokens[1] === 'duration'
  const path = duration ? [] : tokens[0] === 'value' ? tokens.slice(1) : tokens
  let schema = value.kind === 'calculatorParameter' ? undefined : value.kind === 'parameter' ? template.parameterDefinitions.find(item => item.id === value.id)?.valueType : metricValueSchema(template,metricId)
  let unit = duration ? 's' : value.kind === 'input' ? metricValueUnit(template,metricId) : typeof schema?.unit === 'string' ? schema.unit : undefined
  const names:string[] = []
  for (const key of path) {
    const field = metricValueFields({ [key]:null },schema)[0]
    names.push(field?.name || key)
    schema = field?.schema
    unit = field?.unit
  }
  const label = duration ? t('evidenceStateDuration') : names.join(' / ')
  if (value.type === 'unavailable') return { label, text:t(`evidenceInput_${value.state}`) }
  if (value.type === 'omitted') return { label, text:t('evidenceOmitted') }
  if (value.type === 'null') return { label, text:t('evidenceNull') }
  let scalar:unknown = value.value
  if (value.type === 'boolean') scalar = value.value === 'true'
  if (value.type === 'number') {
    const number = Number(value.value)
    if (Number.isFinite(number) && (!Number.isInteger(number) || Number.isSafeInteger(number))) scalar = number
  }
  const labels = !path.length && value.kind === 'input' ? metricValueLabels(template,metricId) : schemaValueLabels(schema)
  const text = value.type === 'string' && scalar === '' ? t('evidenceEmptyString') : semanticValueText(scalar,{ labels,unit,locale },t)
  return { label, text:unit && !duration && !['s','ms','min','h'].includes(unit) ? `${text} ${unit}` : text }
}
