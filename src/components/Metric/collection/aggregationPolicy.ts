import type { MetricTemplateOutput } from '../types'
import type { MetricReadAggregation, ReadOperation, ReadSemantic } from './types'

/** Suggestions are based on declared meaning and type; algorithm IDs never grant summation. */
export function suggestedReadSemantic(output: MetricTemplateOutput): ReadSemantic {
  if (['boolean','enum','string'].includes(output.valueType || '') || ['boolean','level','state'].includes(output.metricKind || '')) return 'state'
  if (output.metricKind === 'score') return 'score'
  if (output.metricKind === 'duration') return 'duration'
  if (output.metricKind === 'rate') return 'ratio'
  return 'numeric'
}
export function compatibleReadOperations(semantic: ReadSemantic, exclusive = false): ReadOperation[] {
  if (semantic === 'state') return ['collection','distribution']
  if (semantic === 'ratio') return ['collection']
  return ['collection','average','min','max', ...(semantic === 'quantity' && exclusive ? ['sum' as const] : [])]
}
export function readPolicy(semantic: ReadSemantic): MetricReadAggregation {
  const operations = compatibleReadOperations(semantic)
  return { semantic, operations, defaultOperation:semantic === 'state' ? 'distribution' : semantic === 'duration' ? 'max' : semantic === 'ratio' ? 'collection' : 'average', defaultView:'list' }
}
export function updateReadPolicy(output: MetricTemplateOutput, policy?: MetricReadAggregation): Pick<MetricTemplateOutput,'options'> {
  const options = { ...output.options }
  if (policy) options.readAggregation = policy
  else delete options.readAggregation
  return { options }
}
