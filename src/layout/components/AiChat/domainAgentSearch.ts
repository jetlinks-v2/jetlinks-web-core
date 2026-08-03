export interface DomainAgentSearchResult<T> {
  data: T[]
  total: number
  terms: string[]
}

const DOMAIN_AGENT_SEARCH_MAX_TERMS = 16

const domainAgentSearchTerms = (value: unknown) => {
  const source = Array.isArray(value) ? value.join(' ') : String(value || '')
  const matches = source.toLocaleLowerCase().match(/[\p{L}\p{N}_.-]+/gu) || []
  return Array.from(new Set(matches.map(item => item.trim()).filter(Boolean)))
    .slice(0, DOMAIN_AGENT_SEARCH_MAX_TERMS)
}

const domainAgentSearchScore = (terms: string[], values: unknown[]) => {
  const texts = values
    .map(value => String(value || '').trim().toLocaleLowerCase())
    .filter(Boolean)
  return terms.reduce((score, term) => {
    const termScore = texts.reduce((best, text) => {
      if (text === term) return Math.max(best, 1000 + term.length)
      if (text.startsWith(term)) return Math.max(best, 400 + term.length)
      if (text.includes(term)) return Math.max(best, 240 + term.length)
      if (text.length >= 2 && term.includes(text)) return Math.max(best, 80 + text.length)
      return best
    }, 0)
    return score + termScore
  }, 0)
}

/**
 * Performs bounded multi-term discovery against caller-provided text fields.
 *
 * The helper only tokenizes and ranks real business text. It deliberately owns no domain synonym table, so the same
 * query contract can be reused by device, alarm, video and other page tools without scenario-specific branches.
 */
export const searchDomainAgentItems = <T>(
  items: readonly T[],
  query: unknown,
  fields: (item: T) => unknown[],
  limit: number,
): DomainAgentSearchResult<T> => {
  const boundedLimit = Math.max(0, Math.floor(limit))
  const terms = domainAgentSearchTerms(query)
  if (!terms.length) {
    return {
      data: items.slice(0, boundedLimit),
      total: items.length,
      terms,
    }
  }
  const matched = items
    .map((item, index) => ({ item, index, score: domainAgentSearchScore(terms, fields(item)) }))
    .filter(item => item.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
  return {
    data: matched.slice(0, boundedLimit).map(item => item.item),
    total: matched.length,
    terms,
  }
}
