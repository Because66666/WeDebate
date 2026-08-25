export const SCRIBE_AGENT_ID = '__scribe__';

// 智能体配置
export interface AgentConfig {
  id: string;
  name: string;
  color: string; // 头像颜色标识
  basePrompt: string; // 基础系统提示词引用
  personaPrompt: string; // 人物扮演提示词
  enabled: boolean;
}

// 工具调用记录（用于前端展示）
export interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  status: 'pending' | 'success' | 'error';
}

// 思考片段：有序记录思考文本和工具调用的交错顺序
export type ThinkingBlockItem =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; id: string };

// 有序消息片段：思考块与正文按流式事件到达顺序交错。
// 一个消息中可能出现「思考-正文-思考-正文」等多段交错，
// 每段思考渲染为独立的思考块，保持输出时序
export type MessageSegment =
  | { type: 'thinking'; items: ThinkingBlockItem[] }
  | { type: 'text'; text: string };

// 聊天消息
export interface Message {
  id: string;
  role: 'user' | 'agent';
  agentId?: string; // 智能体消息时存在
  content: string;
  timestamp: number;
  isStreaming?: boolean; // 是否正在流式输出
  reasoningContent?: string; // 思考过程内容（如 DeepSeek 的 reasoning_content）
  reasoningComplete?: boolean; // 思考阶段是否已结束（用于控制正文显示顺序）
  toolCalls?: ToolCallInfo[]; // 该消息关联的工具调用
  thinkingBlocks?: ThinkingBlockItem[]; // 有序的思考片段（文本+工具调用交错）
  segments?: MessageSegment[]; // 有序消息片段（多段思考与正文交错；undefined 为旧数据）
  interactions?: InteractionCard[]; // 内嵌交互卡片（如 ask_user 询问用户）
}

// 询问用户：单个问题
export interface AskUserQuestion {
  id: string;
  question: string;
  type: 'single' | 'multiple' | 'free'; // 单选 / 多选 / 自由回答
  options?: string[]; // 选择题候选选项（free 时无）
}

// 询问用户：用户对单个问题的作答
export interface AskUserAnswer {
  choice?: string | string[]; // 选择题选中项（多选为数组）；选中「其他」时配合 other_text
  other_text?: string; // 选中「其他」时的自定义文本
  text?: string; // 自由回答题文本
}

// 内嵌交互卡片（当前仅 ask_user；保留 kind 便于后续扩展审批/审查等卡片）
export interface InteractionCard {
  id: string;
  kind: 'ask_user';
  status: 'pending' | 'resolved';
  questions?: AskUserQuestion[]; // ask_user 的问题列表
  askAnswers?: Record<string, AskUserAnswer>; // 用户提交的答案（resolved 后回填）
  disabled?: boolean; // 会话中断等导致卡片不可交互
  supersededByMessage?: string; // 挂起期间被用户新指令取代时记录的消息 id
}

// 对话
export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

// API配置
export interface ApiConfig {
  apiKey: string;
  endpoint: string;
  model: string;
}

// 浏览器工具接口（仅定义，不实现）
export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<string>;
}

// 工具注册表
export interface ToolRegistry {
  tools: Map<string, Tool>;
  register: (tool: Tool) => void;
  unregister: (name: string) => void;
  get: (name: string) => Tool | undefined;
  getAll: () => Tool[];
}

// 发言调度状态
export interface TurnState {
  currentAgentIndex: number;
  currentRound: number;
  maxRounds: number; // 默认3
  isUserInterrupted: boolean;
  interruptedAgentId: string | null;
  agentOrder: string[]; // 智能体发言顺序
}

// OpenAI 兼容 API 的 token 用量
export interface ChatUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// 书记官总结记录（绑定会话 ID）
export interface ScribeSummary {
  id: string;
  conversationId: string;
  agentId: string;
  agentName: string;
  agentColor: string;
  summary: string;
  timestamp: number;
  // 统计项扩展字段（可选，向后兼容旧 localStorage 数据）
  // 缺省（undefined）视为普通顾问摘要项
  kind?: 'stats';
  inputTokens?: number;
  outputTokens?: number;
}
