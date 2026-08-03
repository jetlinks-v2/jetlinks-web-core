import {
  createHomeAgentRuntime,
  homeAgentCapabilityRegistry,
  type HomeAgentCapability,
  type HomeAgentCapabilityContext,
  type HomeAgentCapabilityProvider,
  type HomeAgentContextAdapter,
  type HomeAgentRuntime,
  type HomeAgentRuntimeOptions,
  type HomeAgentWorkflowGuide,
} from './homeAgentCapabilities';

export const PROJECT_GENERAL_AGENT_CLIENT_ID = 'projectAiSearchHub';
export const PROJECT_GENERAL_AGENT_SUBJECT_TYPE = 'project';

export type GeneralAgentCapability = HomeAgentCapability;
export type GeneralAgentContext = HomeAgentCapabilityContext;
export type GeneralAgentCapabilityProvider = HomeAgentCapabilityProvider;
export type GeneralAgentContextAdapter = HomeAgentContextAdapter;
export type GeneralAgentRuntime = HomeAgentRuntime;
export type GeneralAgentRuntimeOptions = HomeAgentRuntimeOptions;
export type GeneralAgentWorkflowGuide = HomeAgentWorkflowGuide;

export const createGeneralAgentRuntime = (options: GeneralAgentRuntimeOptions = {}) => (
  createHomeAgentRuntime({
    ...options,
    providerScopes: ['general'],
  })
);

export const registerGeneralAgentCapabilityProvider = (
  provider: GeneralAgentCapabilityProvider,
) => homeAgentCapabilityRegistry.register(provider, 'general');
