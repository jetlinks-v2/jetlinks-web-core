import { randomString } from '@jetlinks-web/utils'
import { isArrayTermType } from '../Search/Filter/setting'
import type { ConditionFieldSchema, ConditionFilterRouteVersion, ConditionTerm } from './types'

type Token = {
  value: string
  quoted?: boolean
}

const logicTypes = new Set(['and', 'or'])

const nullaryTermTypes = new Set(['isnull', 'notnull'])

const termTypeOperatorMap: Record<string, string> = {
  eq: '=',
  not: '!=',
  like: 'like',
  nlike: 'not like',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  in: 'in',
  nin: 'not in',
  btw: 'between',
  nbtw: 'not between',
  isnull: 'is null',
  notnull: 'is not null',
}

const operatorTermTypeMap = Object.entries(termTypeOperatorMap).reduce<Record<string, string>>((acc, [key, value]) => {
  acc[value] = key
  return acc
}, {})

const cloneValue = (value: any): any => {
  if (Array.isArray(value)) {
    return value.map(item => cloneValue(item))
  }

  if (value && typeof value === 'object') {
    return { ...value }
  }

  return value
}

const normalizeLogicType = (type: string | undefined, index: number) => {
  if (!index) {
    return undefined
  }

  const normalized = String(type || '').toLowerCase()
  return logicTypes.has(normalized) ? normalized : 'and'
}

export const isConditionGroup = (item: ConditionTerm | undefined): item is ConditionTerm & { terms: ConditionTerm[] } => {
  return Array.isArray(item?.terms)
}

export const isConditionClause = (
  item: ConditionTerm | undefined,
): item is ConditionTerm & Required<Pick<ConditionTerm, 'column' | 'termType'>> => {
  return !isConditionGroup(item) && !!item?.column && !!item?.termType
}

const toComparableTerms = (terms: ConditionTerm[] = []) => {
  return terms.map((item, index) => ({
    ...(isConditionGroup(item)
      ? {
          terms: toComparableTerms(item.terms || []),
        }
      : {
          column: item.column,
          termType: item.termType,
          value: cloneValue(item.value),
        }),
    type: normalizeLogicType(item.type, index),
  }))
}

const getColumnsMeta = (columns: ConditionFieldSchema[] = []) => {
  const columnsMap: Record<string, ConditionFieldSchema> = {}
  const aliasMap = new Map<string, string>()

  columns
    .filter(item => item.search)
    .forEach((item) => {
      columnsMap[item.dataIndex] = item
      aliasMap.set(item.dataIndex, item.dataIndex)

      if (item.search?.rename) {
        aliasMap.set(item.search.rename, item.dataIndex)
      }
    })

  return {
    columnsMap,
    aliasMap,
  }
}

const resolveColumnKey = (column: string | undefined, aliasMap: Map<string, string>) => {
  if (!column) {
    return undefined
  }

  return aliasMap.get(column) || aliasMap.get(String(column).trim()) || undefined
}

const ensureTermKey = (item: ConditionTerm) => {
  return item.key || randomString(10)
}

const isNullishValue = (value: any) => {
  return value === undefined || value === null || value === ''
}

const hasArrayValue = (value: any) => {
  return Array.isArray(value) && value.some(item => !isNullishValue(item))
}

const hasTermValue = (item: ConditionTerm) => {
  if (isConditionGroup(item)) {
    return Array.isArray(item.terms) && item.terms.some(child => hasTermValue(child))
  }

  if (nullaryTermTypes.has(item.termType || '')) {
    return true
  }

  if (Array.isArray(item.value)) {
    if (['btw', 'nbtw'].includes(item.termType || '')) {
      return item.value.length > 1 && !isNullishValue(item.value[0]) && !isNullishValue(item.value[1])
    }

    return hasArrayValue(item.value)
  }

  return !isNullishValue(item.value)
}

const quoteStringValue = (value: string) => {
  if (!value) {
    return '""'
  }

  const lowerCaseValue = value.toLowerCase()
  const shouldQuote =
    /[\s()[\],"'\\]/.test(value) ||
    logicTypes.has(lowerCaseValue) ||
    ['null', 'in', 'like', 'between', 'not', 'is'].includes(lowerCaseValue)

  return shouldQuote ? JSON.stringify(value) : value
}

const serializeScalarValue = (value: any) => {
  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value)
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }

  if (value === undefined || value === null) {
    return 'null'
  }

  return quoteStringValue(String(value))
}

const toBase64Url = (value: string) => {
  const encoded = encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  )

  return window
    .btoa(encoded)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

const fromBase64Url = (value: string) => {
  let base64 = value.replace(/-/g, '+').replace(/_/g, '/')

  while (base64.length % 4) {
    base64 += '='
  }

  const decoded = window.atob(base64)
  const percentEncoded = Array.from(decoded)
    .map(char => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
    .join('')

  return decodeURIComponent(percentEncoded)
}

const normalizeRouteQueryValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value[0]
  }

  return typeof value === 'string' ? value.trim() : ''
}

const formatTermToWhere = (item: ConditionTerm) => {
  if (isConditionGroup(item)) {
    return ''
  }

  if (!item.column || !item.termType) {
    return ''
  }

  const operator = termTypeOperatorMap[item.termType]
  if (!operator) {
    return ''
  }

  if (nullaryTermTypes.has(item.termType)) {
    return `${item.column} ${operator}`
  }

  if (!hasTermValue(item)) {
    return ''
  }

  if (['in', 'nin'].includes(item.termType)) {
    const values = Array.isArray(item.value) ? item.value : [item.value]
    return `${item.column} ${operator} (${values.map(serializeScalarValue).join(', ')})`
  }

  if (['btw', 'nbtw'].includes(item.termType)) {
    const values = Array.isArray(item.value) ? item.value : [item.value]
    return `${item.column} ${operator} ${serializeScalarValue(values[0])} and ${serializeScalarValue(values[1])}`
  }

  return `${item.column} ${operator} ${serializeScalarValue(item.value)}`
}

const tokenizeWhere = (where: string): Token[] => {
  const tokens: Token[] = []
  let cursor = 0

  while (cursor < where.length) {
    const current = where[cursor]

    if (/\s/.test(current)) {
      cursor += 1
      continue
    }

    if (current === '"' || current === '\'') {
      const quote = current
      cursor += 1
      let value = ''

      while (cursor < where.length) {
        const char = where[cursor]

        if (char === '\\' && cursor + 1 < where.length) {
          value += where[cursor + 1]
          cursor += 2
          continue
        }

        if (char === quote) {
          cursor += 1
          break
        }

        value += char
        cursor += 1
      }

      tokens.push({ value, quoted: true })
      continue
    }

    if (['(', ')', '[', ']', ','].includes(current)) {
      tokens.push({ value: current })
      cursor += 1
      continue
    }

    const next = where[cursor + 1]

    if ((current === '!' || current === '>' || current === '<') && next === '=') {
      tokens.push({ value: `${current}=` })
      cursor += 2
      continue
    }

    if (current === '=' || current === '>' || current === '<') {
      tokens.push({ value: current })
      cursor += 1
      continue
    }

    let value = ''

    while (cursor < where.length) {
      const char = where[cursor]
      const ahead = where[cursor + 1]

      if (/\s/.test(char) || ['(', ')', '[', ']', ',', '"', '\''].includes(char)) {
        break
      }

      if ((char === '!' || char === '>' || char === '<') && ahead === '=') {
        break
      }

      if (char === '=' || char === '>' || char === '<') {
        break
      }

      value += char
      cursor += 1
    }

    if (value) {
      tokens.push({ value })
      continue
    }

    cursor += 1
  }

  return tokens
}

const getTokenValue = (token?: Token) => token?.value?.toLowerCase()

const parseScalarValue = (token: Token | undefined, column: ConditionFieldSchema | undefined) => {
  if (!token) {
    return undefined
  }

  const rawValue = token.value

  if (!token.quoted && /^-?\d+(\.\d+)?$/.test(rawValue)) {
    const searchType = column?.search?.type

    if (['number', 'date', 'time', 'timeRange', 'rangePicker'].includes(searchType || '')) {
      return Number(rawValue)
    }
  }

  return rawValue
}

const createInternalTerm = (item: ConditionTerm, index: number) => {
  const term: ConditionTerm = {
    column: item.column,
    termType: item.termType,
    value: cloneValue(item.value),
    key: ensureTermKey(item),
  }

  const logicType = normalizeLogicType(item.type, index)
  if (logicType) {
    term.type = logicType
  }

  return term
}

const createInternalGroup = (item: ConditionTerm, index: number) => {
  const nextGroup: ConditionTerm = {
    terms: cloneTerms(item.terms || []),
    key: ensureTermKey(item),
  }

  const logicType = normalizeLogicType(item.type, index)
  if (logicType) {
    nextGroup.type = logicType
  }

  return nextGroup
}

export const cloneTerms = (terms: ConditionTerm[] = [], options?: { stripKey?: boolean }) => {
  return terms.map((item, index) => {
    const cloned: ConditionTerm = isConditionGroup(item)
      ? {
          terms: cloneTerms(item.terms || [], options),
        }
      : {
          column: item.column,
          termType: item.termType,
          value: cloneValue(item.value),
        }

    const logicType = normalizeLogicType(item.type, index)
    if (logicType) {
      cloned.type = logicType
    }

    if (!options?.stripKey && item.key) {
      cloned.key = item.key
    }

    return cloned
  })
}

export const isSameTerms = (source: ConditionTerm[] = [], target: ConditionTerm[] = []) => {
  return JSON.stringify(toComparableTerms(source)) === JSON.stringify(toComparableTerms(target))
}

export const normalizeInputTerms = (terms: ConditionTerm[] = [], columns: ConditionFieldSchema[] = []) => {
  const { aliasMap } = getColumnsMeta(columns)

  return terms
    .map((item, index) => {
      if (isConditionGroup(item)) {
        const normalizedTerms = normalizeInputTerms(item.terms || [], columns)

        if (!normalizedTerms.length) {
          return undefined
        }

        return createInternalGroup(
          {
            ...item,
            terms: normalizedTerms,
          },
          index,
        )
      }

      const columnKey = resolveColumnKey(item.column, aliasMap)

      if (!columnKey) {
        return undefined
      }

      return createInternalTerm(
        {
          ...item,
          column: columnKey,
        },
        index,
      )
    })
    .filter(Boolean) as ConditionTerm[]
}

const hasConditionGroups = (terms: ConditionTerm[] = []) => {
  return terms.some(item => isConditionGroup(item) || hasConditionGroups(item.terms || []))
}

const normalizeOutputTermValue = (term: ConditionTerm) => {
  if (isConditionGroup(term)) {
    return term
  }

  if (nullaryTermTypes.has(term.termType || '')) {
    return {
      ...term,
      value: 1,
    }
  }

  return term
}

const toCompactRouteTerms = (terms: ConditionTerm[] = [], columns: ConditionFieldSchema[] = []) => {
  return normalizeInputTerms(terms, columns)
    .filter((item) => {
      return !isConditionGroup(item) && !!item?.column && !!item?.termType && hasTermValue(item)
    })
    .map((item, index) => {
      const next: [string, string, any, string?] = [
        String(item.column),
        String(item.termType),
        cloneValue(item.value),
      ]

      const logicType = normalizeLogicType(item.type, index)
      if (logicType) {
        next.push(logicType)
      }

      return next
    })
}

const toCompactRouteNodes = (terms: ConditionTerm[] = [], columns: ConditionFieldSchema[] = []) => {
  return normalizeInputTerms(terms, columns)
    .filter(item => hasTermValue(item))
    .map((item, index) => {
      if (isConditionGroup(item)) {
        const next: Record<string, any> = {
          g: toCompactRouteNodes(item.terms || [], columns),
        }

        const logicType = normalizeLogicType(item.type, index)
        if (logicType) {
          next.t = logicType
        }

        return next
      }

      const next: [string, string, any, string?] = [
        String(item.column),
        String(item.termType),
        cloneValue(item.value),
      ]

      const logicType = normalizeLogicType(item.type, index)
      if (logicType) {
        next.push(logicType)
      }

      return next
    })
}

export const encodeConditionFilterQuery = (terms: ConditionTerm[] = [], columns: ConditionFieldSchema[] = []) => {
  const version = resolveConditionFilterRouteVersion(terms, columns)

  if (!version) {
    return ''
  }

  const normalizedTerms = normalizeInputTerms(terms, columns)

  if (version === 'v2') {
    const compactNodes = toCompactRouteNodes(normalizedTerms, columns)

    if (!compactNodes.length) {
      return ''
    }

    return `v2.${toBase64Url(JSON.stringify({ t: compactNodes }))}`
  }

  const compactTerms = toCompactRouteTerms(normalizedTerms, columns)

  if (!compactTerms.length) {
    return ''
  }

  return `v1.${toBase64Url(JSON.stringify({ t: compactTerms }))}`
}

export function resolveConditionFilterRouteVersion(
  terms: ConditionTerm[] = [],
  columns: ConditionFieldSchema[] = [],
): ConditionFilterRouteVersion | undefined {
  const normalizedTerms = normalizeInputTerms(terms, columns)

  if (!normalizedTerms.length) {
    return undefined
  }

  return hasConditionGroups(normalizedTerms) ? 'v2' : 'v1'
}

export const decodeConditionFilterQuery = (value: unknown, columns: ConditionFieldSchema[] = []) => {
  const rawValue = normalizeRouteQueryValue(value)

  if (!rawValue) {
    return []
  }

  try {
    const content = rawValue.startsWith('v1.') ? rawValue.slice(3) : rawValue
    const version = rawValue.startsWith('v2.') ? 'v2' : rawValue.startsWith('v1.') ? 'v1' : undefined
    const normalizedContent = version === 'v2' ? rawValue.slice(3) : content
    const decoded = normalizedContent.startsWith('{') ? normalizedContent : fromBase64Url(normalizedContent)
    const payload = JSON.parse(decoded)
    const terms = Array.isArray(payload?.t) ? payload.t : Array.isArray(payload) ? payload : []

    if (version === 'v2' || terms.some((item: any) => item && typeof item === 'object' && Array.isArray(item.g))) {
      const decodeNodes = (items: any[] = []): ConditionTerm[] => {
        return items
          .map((item, index) => {
            if (item && typeof item === 'object' && Array.isArray(item.g)) {
              const groupTerms = decodeNodes(item.g)

              if (!groupTerms.length) {
                return undefined
              }

              return {
                terms: groupTerms,
                type: normalizeLogicType(item.t, index),
                key: randomString(10),
              }
            }

            return {
              column: item?.[0],
              termType: item?.[1],
              value: cloneValue(item?.[2]),
              type: item?.[3],
              key: randomString(10),
            }
          })
          .filter(Boolean) as ConditionTerm[]
      }

      return normalizeInputTerms(decodeNodes(terms), columns)
    }

    return normalizeInputTerms(
      terms.map((item: any) => ({
        column: item?.[0],
        termType: item?.[1],
        value: cloneValue(item?.[2]),
        type: item?.[3],
        key: randomString(10),
      })),
      columns,
    )
  } catch {
    return []
  }
}

const parseLegacyScalarValue = (column: string | undefined, value: string | undefined, columnsMap: Record<string, ConditionFieldSchema>) => {
  if (value === undefined || value === '') {
    return value
  }

  const searchType = column ? columnsMap[column]?.search?.type : undefined
  if (!/^-?\d+(\.\d+)?$/.test(value)) {
    return value
  }

  return ['number', 'date', 'time', 'timeRange', 'rangePicker'].includes(searchType || '')
    ? Number(value)
    : value
}

const parseLegacyArrayValue = (
  column: string | undefined,
  termType: string | undefined,
  rawValue: string | undefined,
  columnsMap: Record<string, ConditionFieldSchema>,
) => {
  if (!termType || !rawValue) {
    return []
  }

  const values = rawValue.includes('|')
    ? rawValue.split('|')
    : rawValue.includes(',')
      ? rawValue.split(',')
      : [rawValue]

  return values.map(item => (item === '' ? undefined : parseLegacyScalarValue(column, item, columnsMap)))
}

export const decodeLegacySearchQuery = (value: unknown, columns: ConditionFieldSchema[] = []) => {
  const rawValue = normalizeRouteQueryValue(value)

  if (!rawValue) {
    return []
  }

  const { columnsMap } = getColumnsMeta(columns)
  const terms: ConditionTerm[] = []

  decodeURI(rawValue).split(' ').forEach((item) => {
    const parts = item.split(':')
    if (parts.length < 3) {
      return
    }

    const [column, termType, ...rest] = parts
    let type: string | undefined
    let valueParts = rest
    const maybeType = rest[rest.length - 1]

    if (maybeType && logicTypes.has(maybeType.toLowerCase())) {
      type = maybeType
      valueParts = rest.slice(0, -1)
    }

    const rawTermValue = valueParts.join(':')
    const parsedValue = isArrayTermType(termType)
      ? parseLegacyArrayValue(column, termType, rawTermValue, columnsMap)
      : parseLegacyScalarValue(column, rawTermValue, columnsMap)

    terms.push({
      column,
      termType,
      value: parsedValue,
      type,
      key: randomString(10),
    })
  })

  return normalizeInputTerms(terms, columns)
}

export const buildOutputTerms = (terms: ConditionTerm[] = [], columns: ConditionFieldSchema[] = []) => {
  const { columnsMap } = getColumnsMeta(columns)
  const normalizedTerms = normalizeInputTerms(terms, columns)

  return normalizedTerms.map((item, index) => {
    if (isConditionGroup(item)) {
      const children = buildOutputTerms(item.terms || [], columns)

      if (!children.length) {
        return undefined
      }

      const nextGroup: ConditionTerm = {
        terms: children,
      }

      const logicType = normalizeLogicType(item.type, index)
      if (logicType) {
        nextGroup.type = logicType
      }

      return nextGroup
    }

    const column = item.column ? columnsMap[item.column] : undefined
    let nextItem: ConditionTerm = {
      column: item.column,
      termType: item.termType,
      value: cloneValue(item.value),
    }

    const logicType = normalizeLogicType(item.type, index)
    if (logicType) {
      nextItem.type = logicType
    }

    if (!column?.search) {
      return nextItem
    }

    if (column.search.handleParamsItem) {
      const handled = column.search.handleParamsItem(
        {
          ...item,
          value: cloneValue(item.value),
        },
        cloneTerms(normalizedTerms),
      )

      const normalizedHandled = normalizeInputTerms([handled], columns)[0]
      return normalizedHandled
        ? normalizeOutputTermValue(cloneTerms([normalizedHandled], { stripKey: true })[0] as ConditionTerm)
        : undefined
    }

    if (column.search.handleValue) {
      nextItem.value = column.search.handleValue(cloneValue(item.value))
    }

    if (column.search.rename) {
      nextItem.column = column.search.rename
    }

    return normalizeOutputTermValue(nextItem)
  }).filter((item) => {
    if (!item) {
      return false
    }

    if (isConditionGroup(item)) {
      return hasTermValue(item)
    }

    return !!item?.column && !!item?.termType && hasTermValue(item)
  })
}

export const buildQueryFilter = (terms: ConditionTerm[] = [], columns: ConditionFieldSchema[] = []) => {
  return {
    terms: buildOutputTerms(terms, columns),
  }
}

export const buildWhereExpression = (terms: ConditionTerm[] = [], columns: ConditionFieldSchema[] = []) => {
  const outputTerms = buildOutputTerms(terms, columns)

  const buildSegments = (items: ConditionTerm[] = []) => {
    const segments: string[] = []

    items.forEach((item) => {
      const segment = isConditionGroup(item)
        ? (() => {
            const content = buildSegments(item.terms || [])
            return content ? `(${content})` : ''
          })()
        : formatTermToWhere(item)

      if (!segment) {
        return
      }

      if (segments.length > 0) {
        segments.push(normalizeLogicType(item.type, 1) || 'and')
      }

      segments.push(segment)
    })

    return segments.join(' ')
  }

  return buildSegments(outputTerms)
}

export const parseWhereExpression = (where: string | undefined, columns: ConditionFieldSchema[] = []) => {
  const content = String(where || '').trim()

  if (!content) {
    return []
  }

  const tokens = tokenizeWhere(content)
  const { aliasMap, columnsMap } = getColumnsMeta(columns)
  let cursor = 0

  const consume = () => {
    const token = tokens[cursor]
    cursor += 1
    return token
  }

  const peek = () => tokens[cursor]

  const parseOperator = () => {
    const current = getTokenValue(peek())

    if (!current) {
      return undefined
    }

    if (current === 'not') {
      const next = getTokenValue(tokens[cursor + 1])

      if (next && ['in', 'like', 'between'].includes(next)) {
        cursor += 2
        return `not ${next}`
      }
    }

    if (current === 'is') {
      const next = getTokenValue(tokens[cursor + 1])
      const third = getTokenValue(tokens[cursor + 2])

      if (next === 'not' && third === 'null') {
        cursor += 3
        return 'is not null'
      }

      if (next === 'null') {
        cursor += 2
        return 'is null'
      }
    }

    return consume()?.value?.toLowerCase()
  }

  const parseArrayValue = (column: ConditionFieldSchema | undefined) => {
    const start = peek()?.value

    if (start !== '(' && start !== '[') {
      return [parseScalarValue(consume(), column)]
    }

    cursor += 1
    const values: any[] = []

    while (cursor < tokens.length) {
      const current = peek()

      if (!current) {
        break
      }

      if (current.value === ')' || current.value === ']') {
        cursor += 1
        break
      }

      if (current.value === ',') {
        cursor += 1
        continue
      }

      values.push(parseScalarValue(consume(), column))
    }

    return values
  }

  const parseTerms = (stopToken?: string) => {
    const terms: ConditionTerm[] = []
    let nextType: string | undefined

    while (cursor < tokens.length) {
      const current = peek()

      if (!current) {
        break
      }

      if (stopToken && current.value === stopToken) {
        break
      }

      if (current.value === '(') {
        cursor += 1
        const groupTerms = parseTerms(')')

        if (peek()?.value === ')') {
          cursor += 1
        }

        if (groupTerms.length) {
          terms.push(createInternalGroup({ terms: groupTerms, type: nextType }, terms.length))
        }
      } else {
        const columnToken = consume()
        const columnKey = resolveColumnKey(columnToken?.value, aliasMap)

        if (!columnKey) {
          break
        }

        const column = columnsMap[columnKey]
        const operator = parseOperator()
        const termType = operator ? operatorTermTypeMap[operator] : undefined

        if (!termType) {
          break
        }

        let value: any

        if (nullaryTermTypes.has(termType)) {
          value = undefined
        } else if (['in', 'nin'].includes(termType)) {
          value = parseArrayValue(column)
        } else if (['btw', 'nbtw'].includes(termType)) {
          const startValue = parseScalarValue(consume(), column)

          if (getTokenValue(peek()) === 'and') {
            cursor += 1
          }

          const endValue = parseScalarValue(consume(), column)
          value = [startValue, endValue]
        } else {
          value = parseScalarValue(consume(), column)
        }

        terms.push(createInternalTerm({ column: columnKey, termType, value, type: nextType }, terms.length))
      }

      const logicType = getTokenValue(peek())
      if (logicType && logicTypes.has(logicType)) {
        nextType = logicType
        cursor += 1
      } else {
        nextType = undefined
      }
    }

    return terms
  }

  return parseTerms()
}
