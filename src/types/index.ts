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

// 书记官总结记录（绑定会话 ID）
export interface ScribeSummary {
  id: string;
  conversationId: string;
  agentId: string;
  agentName: string;
  agentColor: string;
  summary: string;
  timestamp: number;
}
