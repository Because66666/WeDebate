/**
 * 对话日志服务
 *
 * 在测试阶段将大模型的详细对话日志记录到本地磁盘（通过后端 API）。
 * 用户每轮对话（一条用户消息 + 所有智能体响应）生成一个 .md 文件。
 */

interface ToolCallLog {
  name: string;
  arguments: string;
  result: string;
}

interface AgentLogEntry {
  agentId: string;
  agentName: string;
  /** 发送给该智能体的完整请求消息（system prompt + 对话历史） */
  requestMessages: string;
  /** 思考内容（如 DeepSeek 的 reasoning_content） */
  reasoningContent: string;
  /** 工具调用记录 */
  toolCalls: ToolCallLog[];
  /** 最终正文输出 */
  output: string;
  /** 错误信息（如果有） */
  error?: string;
}

interface RoundLog {
  /** 轮次起始时间戳 */
  timestamp: string;
  /** 用户消息 */
  userMessage: string;
  /** 各智能体的日志条目 */
  agents: AgentLogEntry[];
}

class LogService {
  private currentRound: RoundLog | null = null;
  private currentAgent: AgentLogEntry | null = null;

  /** 开始新一轮对话日志 */
  startRound(userMessage: string): void {
    this.currentRound = {
      timestamp: new Date().toISOString().replace(/[:.]/g, '-'),
      userMessage,
      agents: [],
    };
    this.currentAgent = null;
  }

  /** 开始记录一个新智能体的响应 */
  startAgent(agentId: string, agentName: string, requestMessages: Array<{ role: string; content: string }>): void {
    const entry: AgentLogEntry = {
      agentId,
      agentName,
      requestMessages: requestMessages
        .map((m) => {
          const header = `### ${m.role === 'system' ? '系统提示词' : m.role === 'user' ? '用户/智能体消息' : m.role}`;
          return `${header}\n\n${m.content}`;
        })
        .join('\n\n---\n\n'),
      reasoningContent: '',
      toolCalls: [],
      output: '',
    };
    this.currentAgent = entry;
    this.currentRound?.agents.push(entry);
  }

  /** 追加思考内容 token */
  appendReasoning(token: string): void {
    if (this.currentAgent) {
      this.currentAgent.reasoningContent += token;
    }
  }

  /** 记录工具调用开始 */
  addToolCall(name: string, args: Record<string, unknown>): void {
    if (this.currentAgent) {
      this.currentAgent.toolCalls.push({
        name,
        arguments: JSON.stringify(args, null, 2),
        result: '',
      });
    }
  }

  /** 记录工具调用结果 */
  addToolResult(name: string, result: string): void {
    if (this.currentAgent) {
      const tool = this.currentAgent.toolCalls.find((t) => t.name === name && !t.result);
      if (tool) {
        tool.result = result;
      }
    }
  }

  /** 设置最终的正文输出 */
  setOutput(content: string): void {
    if (this.currentAgent) {
      this.currentAgent.output = content;
    }
  }

  /** 记录错误 */
  setError(errorMessage: string): void {
    if (this.currentAgent) {
      this.currentAgent.error = errorMessage;
    }
  }

  /** 将当前轮次的日志格式化为 Markdown 并发送到后端 */
  async flush(): Promise<void> {
    const round = this.currentRound;
    if (!round) return;

    // 如果没有任何智能体数据，跳过写入
    if (round.agents.length === 0) return;

    const md = this.formatAsMarkdown(round);
    const filename = `round-${round.timestamp}.md`;

    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, content: md }),
      });
    } catch (err) {
      console.warn('[LogService] 日志写入失败（后端服务未启动?）:', err);
    }

    this.currentRound = null;
    this.currentAgent = null;
  }

  /** 将 RoundLog 格式化为 Markdown 字符串 */
  private formatAsMarkdown(round: RoundLog): string {
    const lines: string[] = [];

    lines.push('# 对话日志');
    lines.push('');
    lines.push(`**时间戳**: ${round.timestamp}`);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## 用户消息');
    lines.push('');
    lines.push(round.userMessage);
    lines.push('');

    for (const agent of round.agents) {
      lines.push('---');
      lines.push('');
      lines.push(`## 智能体: ${agent.agentName}`);
      lines.push('');

      // 请求消息
      if (agent.requestMessages) {
        lines.push('### 请求消息 (Context)');
        lines.push('');
        lines.push(agent.requestMessages);
        lines.push('');
      }

      // 思考过程
      if (agent.reasoningContent) {
        lines.push('### 思考过程');
        lines.push('');
        lines.push(agent.reasoningContent);
        lines.push('');
      }

      // 工具调用
      if (agent.toolCalls.length > 0) {
        lines.push('### 工具调用');
        lines.push('');
        for (const tool of agent.toolCalls) {
          lines.push(`#### 工具: ${tool.name}`);
          lines.push('');
          lines.push('**参数:**');
          lines.push('');
          lines.push('```json');
          lines.push(tool.arguments);
          lines.push('```');
          lines.push('');
          lines.push('**输出:**');
          lines.push('');
          lines.push('```');
          lines.push(tool.result);
          lines.push('```');
          lines.push('');
        }
      }

      // 正文输出
      if (agent.output) {
        lines.push('### 正文输出');
        lines.push('');
        lines.push(agent.output);
        lines.push('');
      }

      // 错误信息
      if (agent.error) {
        lines.push('### 错误');
        lines.push('');
        lines.push(`> ${agent.error}`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }
}

export const logService = new LogService();
