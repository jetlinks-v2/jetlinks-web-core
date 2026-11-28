import type { Component } from 'vue'
import type { CapabilitySchema, PersistedDataBinding, PersistedOperationBinding } from '../data-capability/types'
import type { VariableObjectSpec } from '../types/relation'

export interface ObjectReference { type: string; id: string; name?: string }

/** The original ID value refers to another object; it is not a second relation definition. */
export interface PropertyReferenceMapping {
  targetType: string
  relationId?: string
  reverse?: boolean
  labelProperty?: string
}
export interface ObjectReferenceValue {
  items: Array<ObjectReference & { unavailable?: boolean }>
  limited: boolean
}

/** An explicit original action and segmented input path; a declaration never grants write permission. */
export interface PropertyEditMapping { providerId: string; command: string; inputPath: string[] }

/** Original metadata projection. Execution Schema is derived once, never used to replace it. */
export interface ObjectValueType {
  type: string
  unit?: string
  elements?: Array<{ value: unknown; text: string }>
  trueText?: string
  falseText?: string
  properties?: ObjectPropertyMetadata[]
  elementType?: ObjectValueType
  [key: string]: unknown
}
export interface ObjectPropertyMetadata {
  id: string
  name?: string
  description?: string
  valueType: ObjectValueType
  expands?: Record<string, unknown> & { semanticRole?: string; semanticTypes?: string[]; reference?: PropertyReferenceMapping; edit?: PropertyEditMapping }
}
/** References to read-only commands in the same logical source; relation owns the wire contract. */
export interface ObjectDataAccess {
  history?: string
  aggregate?: string
  operations: Array<{ id: string; name: string; valueType?: ObjectValueType }>
  pageSize: number
}
export interface ObjectDataQuery {
  dataMode: 'history' | 'aggregate'
  from: number
  to: number
  interval?: number
  aggregation?: string
  pageIndex: number
  pageSize: number
}
export interface ObjectDataSample { timestamp: number; value: unknown }
export interface ObjectFunctionMetadata {
  id: string
  name?: string
  description?: string
  inputs?: ObjectPropertyMetadata[]
  output?: ObjectValueType
  expands?: Record<string, unknown>
}
export interface ObjectModel {
  expands?: Record<string, unknown> & { semanticTypes?: string[] }
  properties?: ObjectPropertyMetadata[]
  functions?: ObjectFunctionMetadata[]
  events?: unknown[]
  modules?: ObjectModel[]
  [key: string]: unknown
}
export interface ObjectProviderModel { providerId: string; name: string; identity: boolean; metadata: ObjectModel }
export interface ObjectMemberRef { type: string; providerId: string; kind: 'property' | 'query' | 'action'; id: string }
export interface ObjectMember {
  ref: ObjectMemberRef
  name: string
  sourceName: string
  identitySource?: boolean
  /** Classification of this provider's model fragment, not of the whole business object. */
  sourceSemanticTypes?: string[]
  description?: string
  metadata: ObjectPropertyMetadata | ObjectFunctionMetadata
  schema?: CapabilitySchema
}
export interface ObjectMemberPresentation {
  ref: Omit<ObjectMemberRef, 'type'>
  label?: () => string
  /** Receives { member, value }: one target's raw output, including arrays; the host owns read state. */
  component?: Component
  editor?: Component
}
export interface ObjectMemberSelection {
  object?: VariableObjectSpec
  member: ObjectMemberRef
  binding: PersistedDataBinding | PersistedOperationBinding
}
export interface ObjectCapabilityValue {
  values: Array<{ object: ObjectReference; value: unknown; metadata?: ObjectPropertyMetadata | ObjectFunctionMetadata }>
  limited: boolean
}
