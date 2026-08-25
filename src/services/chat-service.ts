import type { AgentConfig, ApiConfig, Message, ToolCallInfo, ChatUsage } from '../types';
import { streamChatCompletion } from './openai';
import { buildAgentContext } from './context-builder';
import { createToolRegistry } from './tools';
import { createAskUserTool } from './tools/ask-user';
import { askUserService } from './ask-user';
import { logService } from './log-service';

export interface TurnManagerLike {
  getNextSpeaker: () => string | null;
  advance: () => void;
  userInterrupt: (currentAgentId: string) => void;
  setProcessing: (processing: boolean) => void;
  initTurn: (agents: AgentConfig[]) => void;
  resetTurn: () => void;
  turnState: { currentAgentIndex: number; agentOrder: string[] } | null;
  isProcessing: boolean;
}

export class ChatService {
  private abortController: AbortController | null = null;
  private toolRegistry = createToolRegistry();

  async sendMessage(
    _userMessage: Message,
    agents: AgentConfig[],
    apiConfig: ApiConfig,
    existingMessages: Message[],
    onAgentMessageStart: (agentId: string, messageId: string) => void,
    onAgentMessageToken: (messageId: string, token: string) => void,
    onAgentMessageComplete: (messageId: string, fullContent: string) => void,
    onError: (agentId: string, error: Error) => void,
    turnManager: TurnManagerLike,
    isUserInterrupt: boolean,
    currentSpeakingAgentId: string | null,
    onAgentReasoningToken?: (messageId: string, token: string) => void,
    onAgentReasoningComplete?: (messageId: string) => void,
    onAgentToolCallStart?: (messageId: string, toolCall: ToolCallInfo) => void,
    onAgentToolCallResult?: (messageId: string, toolCallId: string, result: string) => void,
    onAgentSpeechComplete?: (
      agentId: string,
      agentName: string,
      content: string,
      usage?: ChatUsage,
    ) => void,
  ): Promise<string | null> {
    // 1. 轮次初始化：
    //    - 新对话（尚无 agent 消息）：从头开始流程；
    //    - 上一轮流程已走完（getNextSpeaker 为 null，如整轮结束）：用户再次
    //      发消息时重新从头走一遍流程；
    //    - 用户终止后再发消息：turnState 仍指向被终止的 agent（getNextSpeaker
    //      非 null），不重置——由被终止的 agent 继续回答
    const hasAgentMessages = existingMessages.some((m) => m.role === 'agent');
    if (!hasAgentMessages || turnManager.getNextSpeaker() === null) {
      turnManager.initTurn(agents);
    }

    // 2. If user interrupted, call turnManager.userInterrupt
    //    用户插队后，当前智能体完成即暂停，等用户消息处理后再继续
    if (isUserInterrupt && currentSpeakingAgentId) {
      turnManager.userInterrupt(currentSpeakingAgentId);
    }

    // Create a new AbortController for this flow
    // 持有本次流程的 controller 引用：结束时若已被新一轮 sendMessage 接管
    // （ask_user 挂起被用户新消息取代并 abort 后立即开启新流程的场景），
    // 旧循环不得复位 processing 状态、也不得清空新流程的 abortController
    const controller = new AbortController();
    this.abortController = controller;
    const signal = controller.signal;

    // 3. Loop: getNextSpeaker -> if null, break (3 rounds done)
    let firstAgentContent: string | null = null;

    while (true) {
      if (signal.aborted) break;

      const nextAgentId = turnManager.getNextSpeaker();
      if (nextAgentId === null) break;

      const agent = agents.find((a) => a.id === nextAgentId);
      if (!agent) {
        turnManager.advance();
        continue;
      }

      // Build context using buildAgentContext
      const contextMessages = buildAgentContext(
        agent,
        existingMessages,
        agents,
      );

      // 日志：记录该智能体的请求消息
      logService.startAgent(agent.id, agent.name, contextMessages);

      // Create a placeholder agent message ID
      const messageId = crypto.randomUUID();

      // Call onAgentMessageStart
      onAgentMessageStart(agent.id, messageId);

      // 注册绑定当前消息的 ask_user 工具（所有智能体可用）：
      // 工具执行时卡片会嵌入到上面这个 messageId 对应的消息中
      this.toolRegistry.register(createAskUserTool(messageId));

      // Build tools configuration from registry
      const allTools = this.toolRegistry.getAll();
      const toolsParam = allTools.map((tool) => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: {
            type: 'object',
            properties: tool.parameters as Record<string, unknown>,
            required: Object.keys(tool.parameters),
          },
        },
      }));

      // Build tool executor
      const executeTool = async (
        name: string,
        args: Record<string, unknown>,
      ): Promise<string> => {
        const tool = this.toolRegistry.get(name);
        if (!tool) {
          return `错误: 未找到工具 "${name}"`;
        }
        return tool.execute(args);
      };

      // Stream the response
      let fullContent = '';
      let encounteredError: Error | null = null;
      // 累积本次顾问发言（含工具调用多轮）的 token 用量
      const agentUsage: ChatUsage = {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      };
      try {
        await streamChatCompletion(
          apiConfig,
          contextMessages,
          {
            onToken: (token: string) => {
              fullContent += token;
              onAgentMessageToken(messageId, token);
            },
            onReasoningToken: (token: string) => {
              onAgentReasoningToken?.(messageId, token);
              // 日志：记录思考内容
              logService.appendReasoning(token);
            },
            onReasoningComplete: () => {
              onAgentReasoningComplete?.(messageId);
            },
            onComplete: (content: string) => {
              fullContent = content;
              onAgentMessageComplete(messageId, content);
              // 日志：记录正文输出
              logService.setOutput(content);
            },
            onError: (error: Error) => {
              encounteredError = error;
              onError(agent.id, error);
              // 日志：记录错误
              logService.setError(error.message);
            },
            // 日志：工具调用
            onToolCallStart: (id, name, args) => {
              logService.addToolCall(name, args);
              onAgentToolCallStart?.(messageId, { id, name, args, status: 'pending' });
            },
            onToolCallResult: (id, name, result) => {
              logService.addToolResult(name, result);
              onAgentToolCallResult?.(messageId, id, result);
            },
            onUsage: (u) => {
              agentUsage.prompt_tokens += u.prompt_tokens ?? 0;
              agentUsage.completion_tokens += u.completion_tokens ?? 0;
              agentUsage.total_tokens += u.total_tokens ?? 0;
            },
          },
          signal,
          toolsParam,
          executeTool,
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Aborted by user, stop the loop
          break;
        }
        encounteredError = err instanceof Error ? err : new Error(String(err));
        onError(agent.id, encounteredError);
        // 日志：记录错误
        logService.setError(encounteredError.message);
      }

      // 发生错误时：更新占位消息为错误信息，然后终止整个讨论
      if (encounteredError) {
        // 判断是否为用户主动终止
        const isAbort =
          encounteredError.name === 'AbortError' ||
          /aborted|body|stream|buffer/i.test(encounteredError.message);

        if (isAbort) {
          // 保留被终止前已生成的部分内容并附加终止标记：
          // 下一轮该 agent 继续回答时，上下文为
          // [之前的对话记录, 被终止的部分回答, 用户消息]
          // 仅去除尾部空白（保留首部），保证与流式正文的前缀对齐
          const partial = fullContent.replace(/\s+$/, '');
          const finalDisplay = partial
            ? `${partial}\n\n**（输出被用户终止）**`
            : '**用户已终止输出**';
          onAgentMessageComplete(messageId, finalDisplay);
          logService.setOutput(finalDisplay);
        } else {
          onAgentMessageComplete(messageId, `**${agent.name} 响应失败**\n\n${encounteredError.message}`);
        }
        break;
      }

      // 用户中断时：当前智能体发言完毕后暂停后续调度，等待用户消息处理
      if (isUserInterrupt) {
        break;
      }

      // Track first agent's content for title generation
      if (firstAgentContent === null && fullContent) {
        firstAgentContent = fullContent;
      }

      // Add the completed agent message to existingMessages for context of next agent
      const agentMessage: Message = {
        id: messageId,
        role: 'agent',
        agentId: agent.id,
        content: fullContent,
        timestamp: Date.now(),
      };
      existingMessages = [...existingMessages, agentMessage];

      // 触发书记官总结（非阻塞，由调用方决定如何处理）
      // 若本次发言有 token 用量，一并传出供统计面板累计
      const finalUsage: ChatUsage | undefined =
        agentUsage.total_tokens > 0 ? agentUsage : undefined;
      onAgentSpeechComplete?.(agent.id, agent.name, fullContent, finalUsage);

      // Advance turn
      turnManager.advance();
    }

    // 4. setProcessing(false) when done（仅当未被新一轮流程接管时收尾）
    if (this.abortController === controller) {
      turnManager.setProcessing(false);
      this.abortController = null;
    }

    // 日志：将当前轮次的数据写入磁盘
    logService.flush();

    // 返回第一个发言顾问的正文内容，供标题生成使用
    return firstAgentContent;
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    // 中断会话时同步取消挂起中的 ask_user 询问，
    // 避免工具调用永久挂起、卡片停留在 pending 状态
    askUserService.cancelAll();
  }
}

export const chatService = new ChatService();
