import type { AiClientToolInputRequest, AiClientToolInputResponse, AiClientToolUserInputResolution, AiClientToolExecutionContext } from './clientTools';
import type {
  GeneralAgentMarkdownPresentationCapability,
} from './generalAgentExtensions';
import type { Component } from 'vue';

export type AgentConversationComponentKind = 'access' | 'conversation';

/** Registered UI implementation; business modules and tool runtimes never know its owner module. */
export interface AgentConversationProvider {
  priority?: number;
  components: Partial<Record<AgentConversationComponentKind, Component>>;
}

export type AgentConversationProviderManifest = Record<string, AgentConversationProvider>;

export type AgentConversationMessageType =
  | 'user'
  | 'assistant'
  | 'tool_call'
  | 'tool_result'
  | 'confirm'
  | 'input_required'
  | 'thought'
  | 'plan'
  | 'usage'
  | 'error'
  | 'system';

export interface AgentConversationHeaders {
  messageId?: string;
  responseId?: string;
  interactionId?: string;
  turnId?: string;
  replyCommand?: string;
  provider?: string;
  origin?: string;
}

export interface AgentConversationCommand {
  id: string;
  name?: string;
  description?: string;
  [key: string]: any;
}

export interface AgentConversationConfiguredTool {
  id?: string;
  toolId: string;
  sourceType?: string;
  sourceId?: string;
  requirementCode?: string;
  sortIndex?: number;
  required?: boolean;
  toolName?: string;
  toolDescription?: string;
  commandCount?: number;
  [key: string]: any;
}

export interface AgentConversationClientToolDefinition {
  id: string;
  name?: string;
  displayName?: string;
  title?: string;
  label?: string;
  progressText?: string;
  progressDescription?: string;
  description?: string;
  inputs?: Array<Record<string, any>>;
  output?: Record<string, any>;
  [key: string]: any;
}

/** Opaque server-known Skill binding selected by the current client scope. */
export interface AgentConversationSkillBindingRef {
  bindingId: string;
}

export interface AgentConversationWorkflowGuideStep {
  title?: string;
  description?: string;
  /** Stable routing capability, never a concrete tool id. */
  capability?: string;
  /** Binding types expected from this evidence step. */
  evidence?: string | string[];
  /** @deprecated Workflow guidance must not prescribe concrete tool ids. */
  tools?: string[];
  inputs?: Record<string, any>;
  tips?: string[];
  required?: boolean;
  [key: string]: any;
}

/**
 * Domain workflow guidance for AgentConversation.
 *
 * Keep each guide focused on capability and process: when the workflow applies,
 * which evidence-gathering capabilities and bindings are useful, and
 * what kind of user-facing result is expected. Global model behavior rules
 * such as tone, safety, Markdown formatting, or provider-specific prompt fixes
 * belong in the backend system prompt, not in page-level workflow guides.
 */
export interface AgentConversationWorkflowGuide {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  when?: string | string[];
  scenarios?: string[];
  keywords?: string[];
  steps?: Array<string | AgentConversationWorkflowGuideStep>;
  output?: string | string[];
  notes?: string | string[];
  priority?: number;
  [key: string]: any;
}

export interface AgentConversationSessionFileInfo {
  path: string;
  uri?: string;
  directory: boolean;
  size: number;
  mimeType?: string;
  createTime?: string | number;
  lastModified?: string;
}

export interface AgentConversationSessionTextFile extends AgentConversationSessionFileInfo {
  content: string;
  charset?: string;
  maxBytes: number;
  truncated: boolean;
}

export interface AgentConversationSessionFileApi {
  capabilities: () => Record<string, any>;
  toUri: (path: string) => string;
  list: (
    path?: string,
    options?: { limit?: number },
  ) => Promise<{
    path: string;
    uri?: string;
    total: number;
    data: AgentConversationSessionFileInfo[];
  }>;
  stat: (path: string) => Promise<AgentConversationSessionFileInfo>;
  readText: (
    path: string,
    options?: { maxBytes?: number; charset?: string },
  ) => Promise<AgentConversationSessionTextFile>;
  writeText: (
    path: string,
    content: string,
    options?: { append?: boolean; charset?: string; maxBytes?: number },
  ) => Promise<AgentConversationSessionFileInfo & { ok: boolean; append: boolean }>;
  appendText: (
    path: string,
    content: string,
    options?: { charset?: string; maxBytes?: number },
  ) => Promise<AgentConversationSessionFileInfo & { ok: boolean; append: boolean }>;
  upload: (
    path: string,
    body: ArrayBuffer | Blob | string,
    options?: { append?: boolean; charset?: string; maxBytes?: number; signal?: AbortSignal },
  ) => Promise<AgentConversationSessionFileInfo & { ok: boolean; append: boolean }>;
  mkdir: (path: string) => Promise<AgentConversationSessionFileInfo & { ok: boolean }>;
  remove: (
    path: string,
    options?: { recursive?: boolean; ignoreMissing?: boolean },
  ) => Promise<{
    ok: boolean;
    path: string;
    uri: string;
    recursive: boolean;
    ignoreMissing: boolean;
  }>;
}

export interface AgentConversationClientToolConfirmationRequest {
  id: string;
  toolId: string;
  toolName: string;
  title: string;
  content: string;
  okText: string;
  cancelText: string;
  arguments: Record<string, any>;
  allowArgumentEdits?: boolean;
}

export interface AgentConversationClientToolConfirmationResponse {
  approved?: boolean;
  optionId?: string;
  arguments?: Record<string, any>;
}

export interface AgentConversationClientToolCall {
  id: string;
  toolName: string;
  arguments?: Record<string, any>;
  executionContext?: AgentConversationClientToolExecutionContext;
  environment?: AgentConversationClientToolEnvironment;
  sessionFiles?: AgentConversationSessionFileApi;
  presentationCapabilities?: readonly GeneralAgentMarkdownPresentationCapability[];
  signal?: AbortSignal;
  reportProgress?: (progress: {
    version: 'client-tool-progress/v1';
    stepId: string;
    status: 'pending' | 'running' | 'completed' | 'blocked' | 'failed';
    label: string;
    completed: number;
    total: number;
    targets?: string[];
    elapsedMs?: number;
  }) => void;
  requestInput?: (request: AiClientToolInputRequest) => Promise<AiClientToolInputResponse>;
  requestConfirmation?: (
    request: AgentConversationClientToolConfirmationRequest,
  ) => Promise<AgentConversationClientToolConfirmationResponse | void> | AgentConversationClientToolConfirmationResponse | void;
  raw?: Record<string, any>;
}

export interface AgentConversationUserInputResolution extends AiClientToolUserInputResolution {}

export interface AgentConversationClientToolExecutionContext extends AiClientToolExecutionContext {}

/** Session-scoped browser facts available to client tools, never model-supplied arguments. */
export interface AgentConversationClientToolEnvironment {
  timeZone?: string;
}

export interface AgentConversationReferenceSkill {
  id: string;
  name?: string;
  summary?: string;
  description?: string;
  [key: string]: any;
}

export interface AgentConversationReferenceCandidate {
  type: string;
  value: string;
  label: string;
  insertText?: string;
  description?: string;
  meta?: string;
  icon?: string;
  marker?: string;
  providerKey?: string;
  providerLabel?: string;
  category?: string;
  categoryLabel?: string;
  onHover?: (active: boolean, item: AgentConversationReferenceCandidate) => void | Promise<void>;
  [key: string]: any;
}

export interface AgentConversationReferenceProvider {
  key: string;
  trigger?: string;
  marker?: string;
  type?: string;
  label?: string;
  emptyText?: string;
  loading?: boolean;
  candidates?: AgentConversationReferenceCandidate[];
  onOpen?: () => void | Promise<void>;
  onCandidateHover?: (item: AgentConversationReferenceCandidate, active: boolean) => void | Promise<void>;
  [key: string]: any;
}

export interface AgentConversationComposerQuickAction {
  key: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  count?: string | number;
}

export interface AgentConversationComposerActionContext {
  inputValue: string;
  insertText: (text: string) => void;
  openReference: (trigger: string, providerKey?: string) => void;
  closePanel: () => void;
}

export interface AgentConversationComposerAction {
  key: string;
  label: string;
  description?: string;
  icon?: string;
  category?: string;
  categoryLabel?: string;
  disabled?: boolean;
  visible?: boolean;
  insertText?: string;
  referenceTrigger?: string;
  referenceProviderKey?: string;
  handler?: (
    context: AgentConversationComposerActionContext,
  ) => void | Promise<void>;
  [key: string]: any;
}

export interface AgentConversationChatFile {
  fileUrl: string;
  fileName?: string;
  mediaType?: string;
  others?: Record<string, any>;
}

export interface AgentConversationFileContent {
  url?: string;
  fileUrl?: string;
  contentType?: string;
  mediaType?: string;
  mimeType?: string;
  content?: unknown;
  name?: string;
  title?: string;
  fileName?: string;
  description?: string;
  size?: number | string;
  metadata?: Record<string, any>;
  [key: string]: any;
}

export interface AgentConversationChatPayload {
  /** 本轮附加指引，与会话原系统提示合并，不覆盖宿主能力和边界。 */
  systemPromptAppend?: string;
  content?: string;
  files?: AgentConversationChatFile[];
  params?: Record<string, any>;
  configOptions?: Record<string, any>;
  commandArguments?: Record<string, any>;
  toolAction?: { sourceResponseId: string; toolCallId: string; values: Record<string, unknown> };
}

export interface AssistantTextContentBlock {
  type: 'text';
  blockId: string;
  index: number;
  text: string;
}

export interface AssistantPresentationContentBlock {
  type: 'presentation';
  blockId: string;
  index: number;
  renderer: string;
  source: string;
  sourceKind: 'inline' | 'session-file';
  mediaType?: string;
  label?: string;
  status: 'complete' | 'partial' | 'blocked';
  totalCount?: number;
  displayedCount?: number;
  truncated?: boolean;
}

export interface AssistantArtifactContentBlock {
  type: 'artifact';
  blockId: string;
  index: number;
  source: string;
  sourceKind: 'session-file';
  mediaType?: string;
  label?: string;
  status: 'complete' | 'partial' | 'blocked';
  totalCount?: number;
  displayedCount?: number;
  truncated?: boolean;
}

export type AssistantContentBlock =
  | AssistantTextContentBlock
  | AssistantPresentationContentBlock
  | AssistantArtifactContentBlock;

export interface AgentConversationMessage {
  /** Local requestInput only; transport/history parsers never populate this editor capability. */
  localInputEditor?: 'scope-tree';
  id: string;
  type: AgentConversationMessageType;
  content?: string;
  contentBlocks?: AssistantContentBlock[];
  payload?: any;
  headers: AgentConversationHeaders;
  streamKey?: string;
  status?: string;
  createdAt: number;
  isStreaming?: boolean;
  confirmState?: 'pending' | 'approved' | 'rejected' | 'completed' | 'failed';
  confirmSubmitting?: boolean;
  confirmOptionId?: string;
  confirmOptionKind?: string;
  confirmOptionTitle?: string;
  inputState?: 'pending' | 'resolved' | 'cancelled' | 'expired';
  inputSubmitting?: boolean;
  inputOptionId?: string;
}

export interface AgentConversationMarkdownLinkPayload {
  href: string;
  text: string;
  title?: string;
  anchor: HTMLAnchorElement;
  event: MouseEvent;
  content?: string;
  source?: 'message' | 'thought' | string;
  message?: AgentConversationMessage;
  defaultOpen: () => void;
}

export type AgentConversationMarkdownLinkHandler = (
  payload: AgentConversationMarkdownLinkPayload,
) => boolean | void;

export type AgentConversationRuntimeState =
  | 'idle'
  | 'running'
  | 'awaiting_user_input'
  | 'awaiting_confirm'
  | 'awaiting_permission'
  | 'cancelling'
  | 'interrupted'
  | 'destroyed'
  | string;

export interface AgentConversationRuntimeProgress {
  type?: AgentConversationMessageType | 'tool_progress' | string;
  responseId?: string;
  interactionId?: string;
  status?: string;
  phase?: string;
  name?: string;
  content?: string;
  updatedAt?: number | string;
  [key: string]: any;
}

export type AgentConversationRuntimePlan = Record<string, any>;

export interface AgentConversationSessionState {
  sessionId?: string;
  protocol?: Record<string, any>;
  commands: AgentConversationCommand[];
  configuredTools: AgentConversationConfiguredTool[];
  chatCommandId?: string;
  runtimeState?: AgentConversationRuntimeState;
  lastActiveTime?: number;
  lastResponseId?: string;
  runtimeReason?: string;
  runtimeProgress?: AgentConversationRuntimeProgress;
  runtimePlan?: AgentConversationRuntimePlan;
  taskState?: AgentConversationRuntimePlan;
  ready: boolean;
  connected: boolean;
  connecting: boolean;
  reconnecting: boolean;
  error?: string;
}

export interface AgentConversationInitResult {
  sessionId?: string;
  protocol?: Record<string, any>;
  commands?: AgentConversationCommand[];
  configuredTools?: AgentConversationConfiguredTool[];
  runtimeState?: AgentConversationRuntimeState;
  lastActiveTime?: number;
  lastResponseId?: string;
  runtimeReason?: string;
  runtimeProgress?: AgentConversationRuntimeProgress;
  runtimePlan?: AgentConversationRuntimePlan;
  taskState?: AgentConversationRuntimePlan;
}

export interface AgentConversationSessionMeta {
  sessionId?: string;
  ready: boolean;
  connecting: boolean;
  reconnecting: boolean;
  hasActiveTurn: boolean;
  canAcceptExternalSend: boolean;
  canSend: boolean;
  toolCount: number;
  capabilityCount: number;
  logCount: number;
  messageCount: number;
}

export interface AgentConversationToolConfirmOption {
  optionId: string;
  title?: string;
  kind?: string;
  description?: string;
  [key: string]: any;
}

export interface AgentConversationParsedMessageEvent {
  kind: 'message';
  message: AgentConversationMessage;
  upsert?: boolean;
  appendContent?: boolean;
  // 工具实时进度：把增量 chunk 累加进目标 tool_call 消息的 payload.progressLog（运行日志），
  // 而非覆盖调用载荷；用于 session.tool_progress。
  appendProgress?: boolean;
}

export interface AgentConversationParsedAssistantStartEvent {
  kind: 'assistant-start';
  id: string;
  headers: AgentConversationHeaders;
  streamKey?: string;
  payload?: any;
  responseSeq?: number;
  deliveryMode?: 'delta' | 'snapshot';
  createdAt: number;
}

export interface AgentConversationParsedAssistantChunkEvent {
  kind: 'assistant-chunk';
  id: string;
  headers: AgentConversationHeaders;
  streamKey?: string;
  chunk: string;
  contentBlocks?: AssistantContentBlock[];
  payload?: any;
  responseSeq?: number;
  deliveryMode?: 'delta' | 'snapshot';
  createdAt: number;
}

export interface AgentConversationParsedAssistantEndEvent {
  kind: 'assistant-end';
  id: string;
  headers: AgentConversationHeaders;
  streamKey?: string;
  status?: string;
  chunk?: string;
  contentBlocks?: AssistantContentBlock[];
  payload?: any;
  responseSeq?: number;
  deliveryMode?: 'delta' | 'snapshot';
  createdAt: number;
}

export type AgentConversationParsedEvent =
  | AgentConversationParsedMessageEvent
  | AgentConversationParsedAssistantStartEvent
  | AgentConversationParsedAssistantChunkEvent
  | AgentConversationParsedAssistantEndEvent;

export interface AgentConversationToolConfirmResponse {
  id: string;
  messageId?: string;
  interactionId?: string;
  responseId?: string;
  approved?: boolean;
  optionId?: string;
  kind?: string;
  optionKind?: string;
  arguments?: Record<string, any>;
}

export interface AgentConversationUserInputResponse {
  interactionId: string;
  optionId?: string;
  /** Bounded free-text answer for a server-issued text request. */
  text?: string;
  /** Values belong to a server-issued tool-input request; they are not arbitrary tool arguments. */
  values?: Record<string, unknown>;
  /** Local client directory search only; never sent as a server option response. */
  searchText?: string;
  /** Cancels the identified input without executing a tool. */
  cancelled?: boolean;
}

export type AgentConversationConnectionMode = 'debug' | 'agent';

export type AgentConversationConnectionScope = 'platform' | 'project';

export type AgentConversationPresentationMode = 'debug' | 'chat';
