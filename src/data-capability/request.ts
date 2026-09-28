import { inject, getCurrentInstance } from 'vue'
import { request as defaultRequest } from '@jetlinks-web/core'
import type { DataCapabilityRequest, RuntimeContext } from './types'

export const dataCapabilityRequestKey = Symbol('data-capability-request')

/** Keep each runtime's identity separate; never replace the application's global request client. */
export const getDataCapabilityRequest = (context?: RuntimeContext): DataCapabilityRequest =>
  context?.request ?? defaultRequest

/** Capture the parent canvas request while setup is active, including for deferred resource queries. */
export const useDataCapabilityRequest = (): DataCapabilityRequest | undefined =>
  getCurrentInstance() ? inject<DataCapabilityRequest | undefined>(dataCapabilityRequestKey, undefined) : undefined
