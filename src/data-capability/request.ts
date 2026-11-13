import { inject, getCurrentInstance } from 'vue'
import type { DataCapabilityRequest, CapabilityContext } from './types'

export const dataCapabilityRequestKey = Symbol('data-capability-request')

// Resolve the application client only for actual IO. Importing a capability registry stays side-effect free.
const defaultRequest: DataCapabilityRequest = {
  async get(url, params, options) { return (await import('@jetlinks-web/core')).request.get(url, params, options) },
  async post(url, data, options) { return (await import('@jetlinks-web/core')).request.post(url, data, options) },
}

/** Keep each runtime's identity separate; never replace the application's global request client. */
export const getDataCapabilityRequest = (context?: CapabilityContext): DataCapabilityRequest =>
  context?.request ?? defaultRequest

/** Capture the parent canvas request while setup is active, including for deferred resource queries. */
export const useDataCapabilityRequest = (): DataCapabilityRequest | undefined =>
  getCurrentInstance() ? inject<DataCapabilityRequest | undefined>(dataCapabilityRequestKey, undefined) : undefined
