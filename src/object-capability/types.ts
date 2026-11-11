import type { Component } from 'vue'
import type { CapabilitySchema, PersistedDataBinding, PersistedOperationBinding } from '../data-capability/types'
import type { VariableObjectSpec } from '../types/relation'

export interface ObjectReference { type: string; id: string; name?: string }

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
  expands?: Record<string, unknown>
}
export interface ObjectFunctionMetadata {
  id: string
  name?: string
  description?: string
  inputs?: ObjectPropertyMetadata[]
  output?: ObjectValueType
  expands?: Record<string, unknown>
}
export interface ObjectModel {
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
  description?: string
  metadata: ObjectPropertyMetadata | ObjectFunctionMetadata
  schema?: CapabilitySchema
}
export interface ObjectMemberPresentation {
  ref: Omit<ObjectMemberRef, 'type'>
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
