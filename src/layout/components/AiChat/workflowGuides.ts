import type {
  AgentConversationClientToolDefinition,
  AgentConversationWorkflowGuide,
  AgentConversationWorkflowGuideStep,
} from './agentConversationContracts';
import {
  defineAiClientToolResultBindings,
  defineAiClientToolRouting,
} from './clientTools';

export const AGENT_WORKFLOW_GUIDE_TOOL_ID = 'agent_workflow_guide';

const WORKFLOW_GUIDE_ROUTING = defineAiClientToolRouting('discovery', {
  capabilities: ['workflow.guidance.discover'],
  produces: ['workflow-guidance'],
  intents: ['为复杂任务读取页面提供的分析参考', 'discover page guidance for a complex task'],
  notFor: [
    '直接使用已声明业务工具完成明确的数据查询或操作',
    'directly complete a specific data query or action with an already declared business tool',
  ],
  outputShapes: ['workflow.guidance'],
  evidencePolicy: 'none',
  exposure: 'deferred',
});

const normalizeText = (value: unknown) => String(value || '').trim();

const normalizeList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean);
  }
  const text = normalizeText(value);
  return text ? [text] : [];
};

const normalizeGuideTitle = (guide: AgentConversationWorkflowGuide) => (
  normalizeText(guide.name || guide.title || guide.id)
);

const normalizeStepForResult = (
  step: string | AgentConversationWorkflowGuideStep,
  index: number,
) => {
  const normalized = typeof step === 'string'
    ? { title: step, evidence: [], tips: [], required: true, capability: step }
    : {
        title: normalizeText(step.title || step.description || step.capability || `Step ${index + 1}`),
        evidence: normalizeList(step.evidence),
        tips: normalizeList(step.tips),
        required: step.required !== false,
        capability: normalizeText(step.capability),
      };
  return {
    index: index + 1,
    action: normalized.title,
    capability: normalized.capability || normalized.title,
    evidence: normalized.evidence.length ? normalized.evidence : undefined,
    tips: normalized.tips.length ? normalized.tips : undefined,
    required: normalized.required,
  };
};

const normalizeGuideForResult = (guide: AgentConversationWorkflowGuide) => ({
  guideId: guide.id,
  summary: normalizeText(guide.description) || '业务分析参考',
  appliesWhen: normalizeList(guide.when),
  scenarios: normalizeList(guide.scenarios),
  evidencePlan: (guide.steps || []).map(normalizeStepForResult),
  expectedResult: normalizeList(guide.output),
  notes: normalizeList(guide.notes),
});

export const hasWorkflowGuides = (guides?: AgentConversationWorkflowGuide[]) => (
  Array.isArray(guides) && guides.some((item) => !!item?.id)
);

export const buildWorkflowGuideToolsDescription = (guides?: AgentConversationWorkflowGuide[]) => {
  if (!hasWorkflowGuides(guides)) return '';
  return '内部分析参考能力可返回页面声明的有界目录，或按稳定标识读取一项；结果仅用于决定下一步业务动作，不应直接复述给用户。';
};

export const createWorkflowGuideToolDefinition = (
  guides?: AgentConversationWorkflowGuide[],
): AgentConversationClientToolDefinition | undefined => {
  if (!hasWorkflowGuides(guides)) return undefined;
  return {
    id: AGENT_WORKFLOW_GUIDE_TOOL_ID,
    name: AGENT_WORKFLOW_GUIDE_TOOL_ID,
    description: '列出当前会话声明的内部分析参考，或按稳定标识读取一项；不根据用户原句在前端推断流程。',
    routing: WORKFLOW_GUIDE_ROUTING,
    inputs: [
      {
        id: 'guideId',
        name: 'guideId',
        description: '可选的稳定参考标识；省略时返回有界参考目录。',
        required: false,
        valueType: 'string',
      },
      {
        id: 'limit',
        name: 'limit',
        description: '最多返回多少条匹配建议，默认 3。',
        required: false,
        valueType: 'int',
      },
    ],
    output: { type: 'object' },
    _meta: {
      resultBindings: defineAiClientToolResultBindings(WORKFLOW_GUIDE_ROUTING, {
        'workflow-guidance': '$.guidance',
      }),
    },
  };
};

export const resolveWorkflowGuideToolResult = (
  args: Record<string, any> = {},
  guides?: AgentConversationWorkflowGuide[],
) => {
  const source = (guides || []).filter((item) => !!item?.id);
  const guideId = normalizeText(args.guideId || args.id);
  const limit = Math.min(Math.max(Number(args.limit || 3) || 3, 1), 8);

  const matched = source
    .filter(guide => !guideId || guide.id === guideId)
    .sort((left, right) => (
      Number(right.priority || 0) - Number(left.priority || 0)
      || String(left.id).localeCompare(String(right.id))
    ))
    .slice(0, limit)
    .map(normalizeGuideForResult);

  return {
    ok: true,
    ...(guideId ? { guideId } : {}),
    matched: matched.length,
    guidance: matched,
    visibleReplyPolicy: [
      '任何用户可见文本都不要说明已选择、读取或匹配某个内部流程、分析参考、指导或工具。',
      '不要说正在查看取证方向、取证路线、内部分析参考或内部步骤。',
      '不要输出内部工具名、接口、路由、参数、原始 JSON 或调用链路。',
      '最终回复只呈现业务结论、依据、影响、建议、限制和必要的下一步。',
    ],
    instruction: matched.length
      ? '仅把 guidance 当作内部分析参考，继续调用必要业务工具；任何用户可见文本都不要提到内部流程、参考名称、工具名、读取动作、取证方向或内部步骤。'
      : '未匹配到专用分析参考，请使用通用规则：先查可用事实，再明确限制，不要编造数据，也不要暴露内部能力细节。',
  };
};
