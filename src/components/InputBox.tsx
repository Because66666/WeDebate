import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from 'react';
import { SendHorizontal, Square, Paperclip } from 'lucide-react';
import { useConversationStore } from '../stores/conversation';
import { useAgentStore } from '../stores/agent';
import { useSettingsStore } from '../stores/settings';
import { useTurnStore } from '../stores/turn';
import { useScribeStore } from '../stores/scribe';
import { chatService } from '../services/chat-service';
import { logService } from '../services/log-service';
import { summarizeAgentSpeech } from '../services/scribe-service';
import type { Message, ApiConfig, ToolCallInfo, ThinkingBlockItem } from '../types';

export default function InputBox() {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = 22;
    const maxHeight = lineHeight * 5;
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
  }, []);

  // 流式 token 缓冲：使用 requestAnimationFrame 批量合并更新，降低渲染频率
  const tokenBufferRef = useRef<{ messageId: string; content: string; reasoning: string } | null>(null);
  const rafRef = useRef<number | null>(null);
  // 记录哪些消息已收到过 reasoning token，用于无 reasoning 模型兜底判断
  const hasReasoningRef = useRef<Set<string>>(new Set());
  // 记录哪些消息已通过正文 token 兜底标记 reasoningComplete，避免重复 patch
  const reasoningCompleteFallbackRef = useRef<Set<string>>(new Set());

  /** 将 reasoning text 追加到 thinkingBlocks 末尾的 text block */
  function appendReasoningToBlocks(blocks: ThinkingBlockItem[], text: string): ThinkingBlockItem[] {
    if (!text) return blocks;
    if (blocks.length > 0) {
      const last = blocks[blocks.length - 1];
      if (last.type === 'text') {
        return [...blocks.slice(0, -1), { type: 'text', content: last.content + text }];
      }
    }
    return [...blocks, { type: 'text', content: text }];
  }

  const flushTokens = useCallback(() => {
    rafRef.current = null;
    const buffer = tokenBufferRef.current;
    if (!buffer) return;
    tokenBufferRef.current = null;

    const conv = useConversationStore.getState().getCurrentConversation();
    if (!conv) return;
    const msg = conv.messages.find((m) => m.id === buffer.messageId);
    if (!msg) return;

    const newContent = msg.content + buffer.content;
    const newReasoning = (msg.reasoningContent || '') + buffer.reasoning;
    // 增量更新 thinkingBlocks：将新的 reasoning text 追加到末尾 text block
    const newBlocks = appendReasoningToBlocks(msg.thinkingBlocks || [], buffer.reasoning);
    useConversationStore.getState().updateMessage(buffer.messageId, newContent, true, newReasoning, newBlocks);
  }, []);

  const enqueueToken = useCallback(
    (messageId: string, contentToken: string, reasoningToken: string) => {
      if (!tokenBufferRef.current || tokenBufferRef.current.messageId !== messageId) {
        // 切换消息时立即 flush 旧缓冲
        if (tokenBufferRef.current) {
          flushTokens();
        }
        tokenBufferRef.current = { messageId, content: '', reasoning: '' };
      }

      tokenBufferRef.current.content += contentToken;
      tokenBufferRef.current.reasoning += reasoningToken;

      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(flushTokens);
      }
    },
    [flushTokens],
  );

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      flushTokens();
    };
  }, [flushTokens]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text) return;

    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Check API config
    const apiConfig = useSettingsStore.getState().apiConfig;
    if (!apiConfig) {
      useSettingsStore.getState().setSettingsPanelOpen(true);
      return;
    }

    const convStore = useConversationStore.getState();
    const agentStore = useAgentStore.getState();
    const turnStore = useTurnStore.getState();

    // Ensure there's a current conversation
    if (!convStore.currentConversationId) {
      convStore.createConversation();
    }

    // Create user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    // Add user message
    convStore.addMessage(userMessage);

    // 日志：开始新一轮对话记录
    logService.startRound(text);

    const enabledAgents = agentStore.getEnabledAgents();
    if (enabledAgents.length === 0) return;

    const isProcessing = turnStore.isProcessing;
    let currentSpeakingAgentId: string | null = null;

    if (isProcessing && turnStore.turnState) {
      const { currentAgentIndex, agentOrder } = turnStore.turnState;
      currentSpeakingAgentId = agentOrder[currentAgentIndex] ?? null;
    }

    // Start agent responses
    turnStore.setProcessing(true);

    const currentMessages = convStore.getCurrentConversation()?.messages ?? [];

    const firstAgentContent = await chatService.sendMessage(
      userMessage,
      enabledAgents,
      apiConfig,
      currentMessages,
      // onAgentMessageStart
      (agentId, messageId) => {
        const agentMessage: Message = {
          id: messageId,
          role: 'agent',
          agentId,
          content: '',
          timestamp: Date.now(),
          isStreaming: true,
          reasoningComplete: false,
        };
        convStore.addMessage(agentMessage);
      },
      // onAgentMessageToken
      (messageId, token) => {
        // 无 reasoning 模型兜底：首条正文 token 且该消息从未收到 reasoning 时，标记思考已完成
        if (
          token &&
          !hasReasoningRef.current.has(messageId) &&
          !reasoningCompleteFallbackRef.current.has(messageId)
        ) {
          reasoningCompleteFallbackRef.current.add(messageId);
          useConversationStore.getState().patchMessage(messageId, { reasoningComplete: true });
        }
        enqueueToken(messageId, token, '');
      },
      // onAgentMessageComplete
      (messageId, fullContent) => {
        // 先 flush 可能残留的 token 缓冲
        flushTokens();
        // 消息完成时强制标记 reasoningComplete，确保错误/无 reasoning/工具调用后正文可见
        useConversationStore.getState().patchMessage(messageId, { reasoningComplete: true });
        convStore.updateMessage(messageId, fullContent, false);

        // 清理该消息的 reasoning 跟踪状态
        hasReasoningRef.current.delete(messageId);
        reasoningCompleteFallbackRef.current.delete(messageId);
      },
      // onError
      (agentId, error) => {
        console.error(`Agent ${agentId} error:`, error);
      },
      turnStore,
      isProcessing,
      currentSpeakingAgentId,
      // onAgentReasoningToken
      (messageId, token) => {
        if (token) hasReasoningRef.current.add(messageId);
        enqueueToken(messageId, '', token);
      },
      // onAgentReasoningComplete
      (messageId) => {
        useConversationStore.getState().patchMessage(messageId, { reasoningComplete: true });
      },
      // onAgentToolCallStart
      (messageId, toolCall: ToolCallInfo) => {
        // 先 flush 缓冲区中的 reasoning token，避免工具调用和 reasoning 文本时序倒转
        flushTokens();
        const conv = useConversationStore.getState().getCurrentConversation();
        const msg = conv?.messages.find((m) => m.id === messageId);
        if (!msg) return;
        // 在 thinkingBlocks 末尾追加 tool_call 块
        const currentBlocks = msg.thinkingBlocks || [];
        const newBlocks: ThinkingBlockItem[] = [...currentBlocks, { type: 'tool_call', id: toolCall.id }];
        useConversationStore.getState().patchMessage(messageId, {
          toolCalls: [...(msg.toolCalls || []), toolCall],
          thinkingBlocks: newBlocks,
        });
      },
      // onAgentToolCallResult
      (messageId, toolCallId, result) => {
        const conv = useConversationStore.getState().getCurrentConversation();
        const msg = conv?.messages.find((m) => m.id === messageId);
        if (!msg) return;
        useConversationStore.getState().patchMessage(messageId, {
          toolCalls: (msg.toolCalls || []).map((tc) =>
            tc.id === toolCallId ? { ...tc, result, status: 'success' as const } : tc
          ),
        });
      },
      // onAgentSpeechComplete（新增：触发书记官总结）
      (agentId, agentName, content, usage) => {
        if (!content) return;
        const conversationId = useConversationStore.getState().currentConversationId;
        if (!conversationId) return;

        // 触发点 1：顾问发言完毕，立即累计该次发言的 token（创建/更新统计项）
        if (usage && (usage.prompt_tokens > 0 || usage.completion_tokens > 0)) {
          useScribeStore.getState().addTokens(
            conversationId,
            usage.prompt_tokens,
            usage.completion_tokens,
          );
        }

        useScribeStore.getState().incrementSummarizing();

        // 非阻塞启动书记官总结，与下一位顾问并行
        summarizeAgentSpeech(apiConfig as ApiConfig, agentName, content)
          .then(({ summary, usage: scribeUsage }) => {
            const agent = agentStore.agents.find((a) => a.id === agentId);
            const scribeStore = useScribeStore.getState();
            scribeStore.addSummary({
              id: crypto.randomUUID(),
              conversationId,
              agentId,
              agentName,
              agentColor: agent?.color ?? '#888',
              summary,
              timestamp: Date.now(),
            });
            // 触发点 2：书记官总结完成，累计该次总结调用的 token
            if (
              scribeUsage &&
              (scribeUsage.prompt_tokens > 0 || scribeUsage.completion_tokens > 0)
            ) {
              scribeStore.addTokens(
                conversationId,
                scribeUsage.prompt_tokens,
                scribeUsage.completion_tokens,
              );
            }
            scribeStore.decrementSummarizing();
          })
          .catch((err) => {
            console.error('[Scribe] 总结失败:', err);
            useScribeStore.getState().decrementSummarizing();
          });
      },
    );

    // 使用第一个发言顾问的正文内容生成标题
    if (firstAgentContent) {
      await convStore.generateAndSetTitle(apiConfig as ApiConfig, text, firstAgentContent);
    }
  }, [input, enqueueToken, flushTokens]);

  const handleAbort = useCallback(() => {
    chatService.abort();
    const turnStore = useTurnStore.getState();
    turnStore.setProcessing(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const isEmpty = input.trim().length === 0;
  const isProcessing = useTurnStore((s) => s.isProcessing);

  return (
    <div
      className="px-4 py-3"
      style={{
        borderTop: '0.5px solid var(--border)',
        backgroundColor: 'var(--background)',
      }}
    >
      <div className="mx-auto max-w-3xl xl:max-w-5xl">
        <div
          className="flex items-end overflow-hidden transition-all duration-200"
          style={{
            borderRadius: 'var(--radius-lg)',
            border: '0.5px solid var(--border)',
            backgroundColor: 'var(--background-secondary)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              resizeTextarea();
            }}
            onKeyDown={handleKeyDown}
            placeholder="输入消息参与讨论..."
            aria-label="消息输入框"
            rows={1}
            className="flex-1 resize-none border-none bg-transparent py-3 px-4 outline-none"
            style={{
              fontSize: '14px',
              lineHeight: '1.5',
              color: 'var(--foreground)',
            }}
          />
          <div className="flex items-center gap-0.5 pr-2 pb-2">
            <button
              type="button"
              aria-label="上传文件"
              className="flex h-8 w-8 cursor-pointer items-center justify-center outline-none transition-all duration-150"
              style={{
                color: 'var(--icon-muted)',
                borderRadius: 'var(--radius-sm)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Paperclip size={16} />
            </button>
            {isProcessing ? (
              <button
                onClick={handleAbort}
                aria-label="停止生成"
                className="flex h-8 w-8 cursor-pointer items-center justify-center outline-none transition-all duration-150"
                style={{
                  color: 'var(--destructive)',
                  backgroundColor: 'color-mix(in srgb, var(--destructive) 10%, transparent)',
                  borderRadius: 'var(--radius-sm)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--destructive) 20%, transparent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--destructive) 10%, transparent)';
                }}
                title="停止生成"
              >
                <Square size={16} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={isEmpty}
                aria-label="发送消息"
                className="flex h-8 w-8 cursor-pointer items-center justify-center outline-none transition-all duration-150"
                style={{
                  color: '#ffffff',
                  backgroundColor: isEmpty ? 'var(--muted-foreground)' : 'var(--primary)',
                  borderRadius: 'var(--radius-sm)',
                  opacity: isEmpty ? 0.4 : 1,
                  cursor: isEmpty ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (!isEmpty) e.currentTarget.style.filter = 'brightness(0.92)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = 'none';
                }}
              >
                <SendHorizontal size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
