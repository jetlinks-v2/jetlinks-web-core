import type { AgentConversationProviderManifest, AgentConversationWorkflowGuide } from '../src/layout/components/AiChat/agentConversationContracts';
import type { HomeAgentWorkflowGuide } from '../src/layout/components/AiChat/homeAgentContracts';
import type { AgentConversationWorkflowGuide as LegacyWorkflowGuide } from '../../modules/jetlinks-ai-agent-ui/components/AgentConversation/types';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
export type CanonicalWorkflowContract = Assert<Equal<HomeAgentWorkflowGuide, AgentConversationWorkflowGuide>>;
export type CompatibleWorkflowContract = Assert<Equal<LegacyWorkflowGuide, AgentConversationWorkflowGuide>>;

export const provider: AgentConversationProviderManifest = {
  alternative: { priority: 10, components: { access: { name: 'AlternativeConversation' } } },
};
