import { useEffect, useRef, useState } from 'react';
import { Brain, ChevronDown, ChevronRight, Globe, Search, Wrench } from 'lucide-react';
import type { Message, AgentConfig, ToolCallInfo, ThinkingBlockItem } from '../types';
import MarkdownRenderer from './MarkdownRenderer';

interface MessageItemProps {
  message: Message;
  agent?: AgentConfig;
  showSeparator?: boolean;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 从搜索工具的 args 中提取查询关键词 */
function getSearchQuery(tc: ToolCallInfo): string {
  return String(tc.args?.query || tc.args?.keywords || tc.args?.q || '');
}

/** 从 URL 提取域名 */
function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** 从 web_fetch 结果中提取网页标题（由后端从 <title> 元素提取） */
function getWebFetchTitle(tc: ToolCallInfo): string | null {
  if (!tc.result || tc.status !== 'success') return null;
  const match = tc.result.match(/\*\*网页标题\*\*:\s*(.+)/);
  return match?.[1]?.trim() || null;
}

/** 渲染单个工具调用的状态行 */
function ToolCallLine({ tc }: { tc: ToolCallInfo }) {
  const isSearchTool = /search/i.test(tc.name);
  const isWebFetch = tc.name === 'web_fetch';
  const Icon = isSearchTool ? Search : isWebFetch ? Globe : Wrench;
  const query = isSearchTool ? getSearchQuery(tc) : '';

  let label: React.ReactNode;
  if (isSearchTool) {
    const action = tc.status === 'pending' ? '正在检索' : '已经检索';
    label = query ? `${action} ${query}` : action;
  } else if (isWebFetch) {
    const url = String(tc.args?.url || '');
    const action = tc.status === 'pending' ? '正在访问' : tc.status === 'error' ? '访问失败' : '已访问';
    const title = getWebFetchTitle(tc) || (url ? getDomain(url) : '未知链接');
    label = (
      <>
        {action}{' '}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-current"
        >
          {title}
        </a>
      </>
    );
  } else {
    label = tc.status === 'pending' ? `正在调用 ${tc.name}...` : `已调用 ${tc.name}`;
  }

  return (
    <div
      className="flex items-center gap-2 text-xs py-1"
      style={{ color: 'var(--primary)' }}
    >
      <Icon size={14} />
      <span>{label}</span>
    </div>
  );
}

function ThinkingBlock({
  content,
  toolCalls,
  thinkingBlocks,
  isStreaming,
}: {
  content: string;
  toolCalls?: ToolCallInfo[];
  thinkingBlocks?: ThinkingBlockItem[];
  isStreaming?: boolean;
}) {
  const [expanded, setExpanded] = useState(isStreaming ?? false);

  const prevStreamingRef = useRef(isStreaming);
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming) {
      setExpanded(false);
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming]);

  const hasContent = content || (toolCalls && toolCalls.length > 0);
  if (!hasContent) return null;

  // 构建 toolCall 的查找映射
  const toolCallMap = new Map<string, ToolCallInfo>();
  if (toolCalls) {
    for (const tc of toolCalls) {
      toolCallMap.set(tc.id, tc);
    }
  }

  // 如果有 thinkingBlocks，按顺序渲染；否则 fallback 到旧逻辑
  const hasOrderedBlocks = thinkingBlocks && thinkingBlocks.length > 0;

  return (
    <div
      className="mb-3 overflow-hidden"
      style={{
        borderRadius: 'var(--radius-md)',
        border: '0.5px solid var(--border)',
      }}
    >
      {/* Header / toggle bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 outline-none transition-all duration-150"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--primary) 6%, transparent)',
          color: 'var(--primary)',
          fontSize: '12px',
          fontWeight: 600,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--primary) 10%, transparent)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--primary) 6%, transparent)';
        }}
      >
        <Brain size={14} />
        <span>{isStreaming ? '正在思考' : '已思考'}</span>
        <span className="ml-auto">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>

      {/* Thinking content */}
      {expanded && (
        <div
          className="px-3 py-3"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--primary) 2%, transparent)',
            fontSize: '13px',
            color: 'var(--foreground-secondary)',
          }}
        >
          {hasOrderedBlocks ? (
            // 有序渲染：按照 thinkingBlocks 的顺序交错展示文本和工具调用
            thinkingBlocks!.map((block, idx) => {
              if (block.type === 'text') {
                if (!block.content) return null;
                return <MarkdownRenderer key={`text-${idx}`} content={block.content} isStreaming={isStreaming} />;
              }
              if (block.type === 'tool_call') {
                const tc = toolCallMap.get(block.id);
                if (!tc) return null;
                return <ToolCallLine key={`tc-${block.id}`} tc={tc} />;
              }
              return null;
            })
          ) : (
            // Fallback: 旧逻辑（先工具调用，再思考文本）
            <>
              {toolCalls && toolCalls.length > 0 && (
                <div className="mb-2 space-y-1">
                  {toolCalls.map((tc) => (
                    <ToolCallLine key={tc.id} tc={tc} />
                  ))}
                </div>
              )}
              {content && <MarkdownRenderer content={content} isStreaming={isStreaming} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function MessageItem({ message, agent, showSeparator }: MessageItemProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end px-4 py-2" role="article" aria-label="用户消息">
        <div className="max-w-[75%]">
          <div className="flex items-center justify-end gap-2 mb-1.5">
            <span
              className="text-xs"
              style={{ color: 'var(--foreground-secondary)' }}
            >
              {formatTime(message.timestamp)}
            </span>
            <span
              className="text-sm font-semibold"
              style={{
                color: 'var(--foreground)',
                fontSize: '13px',
              }}
            >
              你
            </span>
          </div>
          <div
            className="rounded-2xl px-4 py-3"
            style={{
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <p className="leading-relaxed" style={{ fontSize: '14px' }}>
              {message.content}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const agentColor = agent?.color ?? 'var(--primary)';

  return (
    <div className="px-4 py-2" role="article" aria-label={`${agent?.name ?? '智能体'}的消息`} data-agent-id={agent?.id}>
      {showSeparator && (
        <div
          className="mb-3"
          style={{ borderTop: '0.5px solid var(--border)' }}
        />
      )}
      <div className="flex items-center gap-2 mb-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: agentColor }}
          aria-hidden="true"
        />
        <span
          className="font-semibold"
          style={{
            color: 'var(--foreground)',
            fontSize: '13px',
          }}
        >
          {agent?.name ?? '智能体'}
        </span>
        <span
          className="text-xs"
          style={{ color: 'var(--foreground-secondary)' }}
        >
          {formatTime(message.timestamp)}
        </span>
      </div>
      <div
        className="pl-[18px]"
        style={{
          borderLeft: '2px solid',
          borderLeftColor: agentColor,
          paddingLeft: '14px',
        }}
      >
        <ThinkingBlock
          content={message.reasoningContent || ''}
          toolCalls={message.toolCalls}
          thinkingBlocks={message.thinkingBlocks}
          isStreaming={message.isStreaming && message.reasoningComplete === false}
        />
        {message.reasoningComplete !== false && (
          <div style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--foreground)' }}>
            <MarkdownRenderer content={message.content} isStreaming={message.isStreaming} />
          </div>
        )}
        {message.isStreaming && (
          <span
            className="inline-block h-4 w-0.5 animate-pulse ml-0.5 align-text-bottom"
            style={{ backgroundColor: 'var(--foreground)' }}
          />
        )}
      </div>
    </div>
  );
}
