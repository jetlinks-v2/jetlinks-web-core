import type { ConditionFilterTerm } from './types'

/** 摘要保留显式分组和连接顺序，标签与值仍由条件编辑器解析。 */
export function buildConditionSummary(terms: ConditionFilterTerm[], display: {
  valid: (term: ConditionFilterTerm) => boolean
  clause: (term: ConditionFilterTerm) => string
  logic: (type: string) => string
}): string {
  return terms.flatMap(term => {
    const text = Array.isArray(term.terms)
      ? buildConditionSummary(term.terms, display)
      : display.valid(term) ? display.clause(term) : ''
    return text ? [{ text: Array.isArray(term.terms) ? `(${text})` : text, type: term.type || 'and' }] : []
  }).map((item, index) => `${index ? `${display.logic(item.type)} ` : ''}${item.text}`).join(' ')
}
