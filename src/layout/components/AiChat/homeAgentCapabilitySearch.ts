import type { HomeAgentCapability } from './homeAgentContracts'

const MAX_QUERY_TERMS = 24

interface WeightedText {
  value: unknown
  weight: number
}

const normalize = (value: unknown) => String(value || '').trim().toLocaleLowerCase()

const codePointLength = (value: string) => Array.from(value).length

const isHanText = (value: string) => (
  !!value && Array.from(value).every(char => /\p{Script=Han}/u.test(char))
)

const queryTerms = (value: unknown) => {
  const groups = normalize(value).match(/[\p{L}\p{N}_.-]+/gu) || []
  const segmented = groups.map((group) => {
    if (!isHanText(group) || codePointLength(group) <= 2) return [group]
    const points = Array.from(group)
    const terms = new Set<string>([group])
    for (let start = 0; start < points.length; start += 1) {
      for (let size = 2; size <= Math.min(4, points.length - start); size += 1) {
        terms.add(points.slice(start, start + size).join(''))
      }
    }
    return Array.from(terms)
  })
  const result = new Set<string>()
  for (let index = 0; result.size < MAX_QUERY_TERMS; index += 1) {
    let found = false
    segmented.forEach((segment) => {
      if (segment[index] && result.size < MAX_QUERY_TERMS) {
        result.add(segment[index])
        found = true
      }
    })
    if (!found) break
  }
  return Array.from(result)
}

const termScore = (term: string, fields: WeightedText[]) => fields.reduce((best, field) => {
  const text = normalize(field.value)
  if (!text) return best
  const specificity = Math.min(codePointLength(term), 12)
  if (text === term) return Math.max(best, field.weight * (100 + specificity))
  if (text.startsWith(term)) return Math.max(best, field.weight * (60 + specificity))
  if (text.includes(term)) return Math.max(best, field.weight * (36 + specificity))
  if (codePointLength(text) >= 2 && term.includes(text)) {
    return Math.max(best, field.weight * (12 + Math.min(codePointLength(text), 12)))
  }
  return best
}, 0)

const searchableFields = (item: HomeAgentCapability): WeightedText[] => [
  { value: item.id, weight: 7 },
  { value: item.name, weight: 7 },
  ...(item.keywords || []).map(value => ({ value, weight: 8 })),
  { value: item.description, weight: 5 },
  { value: item.clientId, weight: 4 },
  { value: item.menuCode, weight: 3 },
  { value: item.routeName, weight: 3 },
  { value: item.path, weight: 2 },
  { value: item.category, weight: 1 },
  { value: item.kind, weight: 1 },
]

/**
 * Bounded multi-concept search over the already-authorized browser catalog.
 * Kind/category remain hard filters; natural-language terms only rank that filtered set and never trim session tools.
 */
export const searchHomeAgentCapabilities = (
  capabilities: HomeAgentCapability[],
  args: Record<string, any>,
) => {
  const kind = normalize(args.kind)
  const category = normalize(args.category)
  const filtered = capabilities.filter(item => (
    (!kind || normalize(item.kind) === kind)
    && (!category || normalize(item.category) === category)
  ))
  const terms = queryTerms(args.keyword)
  if (!terms.length) return filtered

  return filtered
    .map((item, index) => {
      const fields = searchableFields(item)
      const scores = terms.map(term => termScore(term, fields))
      const matchedTerms = scores.filter(score => score > 0).length
      return {
        item,
        index,
        matchedTerms,
        coverage: matchedTerms / terms.length,
        score: scores.reduce((total, score) => total + score, 0),
      }
    })
    .filter(candidate => candidate.matchedTerms > 0)
    .sort((left, right) => (
      right.coverage - left.coverage
      || right.matchedTerms - left.matchedTerms
      || right.score - left.score
      || left.index - right.index
    ))
    .map(candidate => candidate.item)
}
