import { randomString } from '@jetlinks-web/utils'
import type { SearchItem, TermsItem } from '../Search/Filter/typing'
import { isArrayTermType } from '../Search/Filter/setting'

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

const toComparableTerms = (terms: TermsItem[] = []) => {
  return terms.map((item, index) => ({
    column: item.column,
    termType: item.termType,
    value: cloneValue(item.value),
    type: normalizeLogicType(item.type, index),
  }))
}

const getColumnsMeta = (columns: SearchItem[] = []) => {
  const columnsMap: Record<string, SearchItem> = {}
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

const ensureTermKey = (item: TermsItem) => {
  return item.key || randomString(10)
}

const isNullishValue = (value: any) => {
  return value === undefined || value === null || value === ''
}

const hasArrayValue = (value: any) => {
  return Array.isArray(value) && value.some(item => !isNullishValue(item))
}

const hasTermValue = (item: TermsItem) => {
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

const formatTermToWhere = (item: TermsItem) => {
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

const parseScalarValue = (token: Token | undefined, column: SearchItem | undefined) => {
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

const createInternalTerm = (item: TermsItem, index: number) => {
  const term: TermsItem = {
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

export const cloneTerms = (terms: TermsItem[] = [], options?: { stripKey?: boolean }) => {
  return terms.map((item, index) => {
    const cloned: TermsItem = {
      column: item.column,
      termType: item.termType,
      value: cloneValue(item.value),
    }

    if (item.terms) {
      cloned.terms = cloneTerms(item.terms, options)
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

export const isSameTerms = (source: TermsItem[] = [], target: TermsItem[] = []) => {
  return JSON.stringify(toComparableTerms(source)) === JSON.stringify(toComparableTerms(target))
}

export const normalizeInputTerms = (terms: TermsItem[] = [], columns: SearchItem[] = []) => {
  const { aliasMap } = getColumnsMeta(columns)

  return terms
    .map((item, index) => {
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
    .filter(Boolean) as TermsItem[]
}

const toCompactRouteTerms = (terms: TermsItem[] = [], columns: SearchItem[] = []) => {
  return normalizeInputTerms(terms, columns)
    .filter((item) => {
      return !!item?.column && !!item?.termType && hasTermValue(item)
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

export const encodeConditionFilterQuery = (terms: TermsItem[] = [], columns: SearchItem[] = []) => {
  const compactTerms = toCompactRouteTerms(terms, columns)

  if (!compactTerms.length) {
    return ''
  }

  return `v1.${toBase64Url(JSON.stringify({ t: compactTerms }))}`
}

export const decodeConditionFilterQuery = (value: unknown, columns: SearchItem[] = []) => {
  const rawValue = normalizeRouteQueryValue(value)

  if (!rawValue) {
    return []
  }

  try {
    const content = rawValue.startsWith('v1.') ? rawValue.slice(3) : rawValue
    const decoded = content.startsWith('{') ? content : fromBase64Url(content)
    const payload = JSON.parse(decoded)
    const terms = Array.isArray(payload?.t) ? payload.t : Array.isArray(payload) ? payload : []

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

const parseLegacyScalarValue = (column: string | undefined, value: string | undefined, columnsMap: Record<string, SearchItem>) => {
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
  columnsMap: Record<string, SearchItem>,
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

export const decodeLegacySearchQuery = (value: unknown, columns: SearchItem[] = []) => {
  const rawValue = normalizeRouteQueryValue(value)

  if (!rawValue) {
    return []
  }

  const { columnsMap } = getColumnsMeta(columns)
  const terms: TermsItem[] = []

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

export const buildOutputTerms = (terms: TermsItem[] = [], columns: SearchItem[] = []) => {
  const { columnsMap } = getColumnsMeta(columns)
  const normalizedTerms = normalizeInputTerms(terms, columns)

  return normalizedTerms.map((item, index) => {
    const column = item.column ? columnsMap[item.column] : undefined
    let nextItem: TermsItem = {
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

      return cloneTerms([handled], { stripKey: true })[0]
    }

    if (column.search.handleValue) {
      nextItem.value = column.search.handleValue(cloneValue(item.value))
    }

    if (column.search.rename) {
      nextItem.column = column.search.rename
    }

    return nextItem
  }).filter((item) => {
    return !!item?.column && !!item?.termType && hasTermValue(item)
  })
}

export const buildQueryFilter = (terms: TermsItem[] = [], columns: SearchItem[] = []) => {
  return {
    terms: buildOutputTerms(terms, columns),
  }
}

export const buildWhereExpression = (terms: TermsItem[] = [], columns: SearchItem[] = []) => {
  const outputTerms = buildOutputTerms(terms, columns)
  const segments: string[] = []

  outputTerms.forEach((item) => {
    const segment = formatTermToWhere(item)

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

export const parseWhereExpression = (where: string | undefined, columns: SearchItem[] = []) => {
  const content = String(where || '').trim()

  if (!content) {
    return []
  }

  const tokens = tokenizeWhere(content)
  const { aliasMap, columnsMap } = getColumnsMeta(columns)
  const terms: TermsItem[] = []
  let cursor = 0
  let nextType: string | undefined

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

  const parseArrayValue = (column: SearchItem | undefined) => {
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

  while (cursor < tokens.length) {
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
