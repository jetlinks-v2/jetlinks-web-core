import type { MetricParameter, MetricTemplate } from '../types'

export function templateParameterDefault(template: MetricTemplate, parameter: MetricParameter): unknown {
  return Object.prototype.hasOwnProperty.call(template.parameters, parameter.id) ? template.parameters[parameter.id] : parameter.expands?.defaultValue
}

/** 参数身份与对应默认值一起更新，保留未参与编辑的参数。 */
export function updateTemplateParameter(template: MetricTemplate, index: number, fields: Partial<MetricParameter>): MetricTemplate {
  const previousId = template.parameterDefinitions[index].id
  const nextId = fields.id ?? previousId
  const parameters = { ...template.parameters }
  if (nextId !== previousId && Object.prototype.hasOwnProperty.call(parameters, previousId)) {
    parameters[nextId] = parameters[previousId]
    delete parameters[previousId]
  }
  return { ...template, parameters,
    parameterDefinitions: template.parameterDefinitions.map((item, i) => i === index ? { ...item, ...fields } : item) }
}

export function removeTemplateParameter(template: MetricTemplate, index: number): MetricTemplate {
  const parameters = { ...template.parameters }
  delete parameters[template.parameterDefinitions[index].id]
  return { ...template, parameters,
    parameterDefinitions: template.parameterDefinitions.filter((_, i) => i !== index) }
}
