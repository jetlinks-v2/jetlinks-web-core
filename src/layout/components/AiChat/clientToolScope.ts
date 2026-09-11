import type { AiClientToolCall, AiClientToolInput } from './clientTools'
import { DomainAgentInputError } from './domainAgentTools'
import {
  defineClientToolScope,
  type ClientToolCanonicalConsumedResource,
  type ClientToolInputAlternative,
  type ClientToolInput,
  type ClientToolScopeAuthoring,
} from './clientToolDefinition'

/** One typed producer argument and its preparation-output provenance. */
export interface DomainAgentScopeCoordinateConfig<TArgs extends Record<string, unknown>> {
  argument: Extract<keyof TArgs, string>
  description: string
  sourcePort: ClientToolCanonicalConsumedResource
}

/** Shared authoring inputs for the closed project/area/point scope contract. */
export interface DomainAgentScopeContractOptions<TArgs extends Record<string, unknown>> {
  area: DomainAgentScopeCoordinateConfig<TArgs>
  point: DomainAgentScopeCoordinateConfig<TArgs>
  /** Existing non-scope alternatives are crossed with the closed project/area/point branches. */
  inputAlternatives?: readonly ClientToolInputAlternative[]
}

/** Ordinary tool declarations plus the opaque analytical scope authoring handle. */
export interface DomainAgentScopeContract<TArgs extends Record<string, unknown>> {
  inputs: AiClientToolInput[]
  consumes: ClientToolCanonicalConsumedResource[]
  inputAlternatives: ClientToolInputAlternative[]
  scope: ClientToolScopeAuthoring<TArgs>
}

const uniqueScopeArguments = (values: readonly string[]) => [...new Set(values.filter(Boolean))]

/**
 * Defines one closed project/area/point scope contract. The returned opaque handle is the only source of analytical
 * scope wire; consumer ports and input alternatives remain ordinary reusable client-tool declarations.
 */
export const createDomainAgentScopeContract = <TArgs extends Record<string, unknown>>(
  options: DomainAgentScopeContractOptions<TArgs>,
): DomainAgentScopeContract<TArgs> => {
  const modeArgument = 'scopeMode' as Extract<keyof TArgs, string>
  const areaArgument = String(options.area.argument || '').trim() as Extract<keyof TArgs, string>
  const pointArgument = String(options.point.argument || '').trim() as Extract<keyof TArgs, string>
  const baseAlternatives = options.inputAlternatives?.length
    ? options.inputAlternatives
    : [{ required: [] }]
  const inputAlternatives = baseAlternatives.flatMap((base) => {
    const required = uniqueScopeArguments(base.required)
    const forbidden = uniqueScopeArguments(base.forbidden || [])
    const branch = (
      title: string,
      scopeMode: 'project' | 'explicit',
      scopeRequired: string[],
      scopeForbidden: string[],
    ): ClientToolInputAlternative => ({
      title: [base.title, title].filter(Boolean).join(' / '),
      required: uniqueScopeArguments([...required, modeArgument, ...scopeRequired]),
      ...(base.when ? { when: base.when } : {}),
      alsoWhen: [{ input: modeArgument, equals: scopeMode }],
      forbidden: uniqueScopeArguments([...forbidden, ...scopeForbidden]),
    })
    return [
      branch('project scope', 'project', [], [areaArgument, pointArgument]),
      branch('area scope', 'explicit', [areaArgument], [pointArgument]),
      branch('point scope', 'explicit', [pointArgument], [areaArgument]),
    ]
  })
  return {
    inputs: [
      {
        id: modeArgument,
        name: modeArgument,
        description: 'Scope selection mode',
        valueType: {
          type: 'enum',
          valueType: { type: 'string' },
          elements: [{ value: 'project' }, { value: 'explicit' }],
        },
        required: true,
      },
      ...[options.area, options.point].map(coordinate => ({
        id: coordinate.argument,
        name: coordinate.argument,
        description: coordinate.description,
        valueType: { type: 'string' },
        required: false,
      })),
    ],
    consumes: [
      { ...options.area.sourcePort },
      { ...options.point.sourcePort },
    ],
    inputAlternatives,
    scope: defineClientToolScope<TArgs>({
      modeArgument,
      valueCardinality: 'exactly-one',
      encoding: 'single-string',
      coordinates: [
        { type: 'project', arguments: [] },
        {
          type: 'area',
          sourcePort: options.area.sourcePort.name,
          arguments: [areaArgument],
        },
        {
          type: 'point',
          sourcePort: options.point.sourcePort.name,
          arguments: [pointArgument],
        },
      ],
    }),
  }
}


/** Model-facing location selector; exact mutual exclusion is checked at the handler boundary. */
export const createDomainAgentSemanticScopeInput = (descriptions: {
  scope: string
  name: string
  all: string
}, required = true): ClientToolInput => ({
  id: 'scope',
  name: 'scope',
  description: descriptions.scope,
  required,
  valueType: {
    type: 'object',
    properties: [
      { id: 'name', name: descriptions.name, valueType: { type: 'string' } },
      { id: 'all', name: descriptions.all, valueType: { type: 'boolean' } },
    ],
  },
})

/** Keeps the original selector value for same-call comparison; lookup may trim the name separately. */
export const parseDomainAgentSemanticScope = (value: unknown): { name: string } | { all: true } | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const selector = value as Record<string, unknown>
  if (Object.keys(selector).length !== 1) return undefined
  if (typeof selector.name === 'string' && selector.name.trim()) return { name: selector.name }
  return selector.all === true ? { all: true } : undefined
}


/** A complete authorized lookup; lookup failures must reject rather than look like empty matches. */
export interface DomainAgentScopeCandidates<T> {
  candidates: readonly { id: string; title: string; description?: string; parentId?: string; value: T }[]
  complete: boolean
  total: number
}

export interface DomainAgentScopeSearch<T> {
  placeholder: string
  submitText: string
  resolve: (text: string, signal?: AbortSignal) => Promise<DomainAgentScopeCandidates<T>>
  /** Complete authorized directory for an explicit choice using the same page scope tree. */
  browse?: (signal?: AbortSignal) => Promise<DomainAgentScopeCandidates<T>>
  editor?: 'scope-tree'
}

/** Selects only from complete authorized candidates. Search text is resolved by the owning domain, never used as an id. */
export const selectDomainAgentScopeCandidate = async <T>(
  call: Pick<AiClientToolCall, 'requestInput' | 'signal'> | undefined,
  candidates: DomainAgentScopeCandidates<T>['candidates'],
  complete: boolean,
  total: number,
  text: { question: string; cancel: string; required: string; cancelled: string; incomplete: string; invalid: string },
  search?: DomainAgentScopeSearch<T>,
): Promise<T> => {
  const fail = (code: string, message: string) => Object.assign(new DomainAgentInputError(code, message), {
    recoveryAction: 'terminal', retryable: false, repair: { maxAttempts: 0 },
  })
  let current = { candidates, complete, total }
  if (search?.browse) {
    if (call?.signal?.aborted) throw fail('scope.selection.cancelled', text.cancelled)
    current = await search.browse(call?.signal)
  }
  while (true) {
    if (call?.signal?.aborted) throw fail('scope.selection.cancelled', text.cancelled)
    if (!current.complete || current.total !== current.candidates.length || (!current.candidates.length && !search)) {
      throw fail('scope.selection.incomplete', text.incomplete)
    }
    const byId = new Map(current.candidates.map(candidate => [candidate.id, candidate]))
    if (byId.size !== current.candidates.length || current.candidates.some(candidate => !candidate.id || !candidate.title)) {
      throw fail('scope.selection.invalid', text.invalid)
    }
    for (const candidate of current.candidates) {
      const ancestors = new Set([candidate.id])
      let parentId = candidate.parentId
      while (parentId) {
        if (ancestors.has(parentId) || !byId.has(parentId)) throw fail('scope.selection.invalid', text.invalid)
        ancestors.add(parentId)
        parentId = byId.get(parentId)?.parentId
      }
    }
    if (current.candidates.length === 1 && !search?.browse) return current.candidates[0].value
    const options = current.candidates.map(({ id, title, description, parentId }) => ({ id, title, description, parentId }))
    if (!call?.requestInput) {
      const preview = options.slice(0, 20)
      throw Object.assign(fail('scope.selection.required', `${text.required} ${preview.map(option => (
        [option.title, option.description].filter(Boolean).join(' / ')
      )).join('; ')}`), {
        inputRequest: { status: 'selection_required', question: text.question,
          options: preview, total: current.total, complete: preview.length === current.total },
      })
    }
    const response = await call.requestInput({ question: text.question, options, cancelText: text.cancel, editor: search?.editor,
      ...(search ? { search: { placeholder: search.placeholder, submitText: search.submitText } } : {}) })
    if (call.signal?.aborted) throw fail('scope.selection.cancelled', text.cancelled)
    if (response?.searchText !== undefined) {
      if (!search || response.optionId || typeof response.searchText !== 'string' || !response.searchText.trim()) {
        throw fail('scope.selection.invalid', text.invalid)
      }
      current = await search.resolve(response.searchText.trim(), call.signal)
      continue
    }
    if (!response?.optionId) throw fail('scope.selection.cancelled', text.cancelled)
    const selected = byId.get(response.optionId)
    if (!selected) throw fail('scope.selection.invalid', text.invalid)
    return selected.value
  }
}
