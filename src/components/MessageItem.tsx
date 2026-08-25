import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Globe, Loader2, Search, Sparkles, Wrench } from 'lucide-react';
import type { Message, ToolCallInfo, ThinkingBlockItem, InteractionCard, AgentConfig } from '../types';
import { useAgentStore } from '../stores/agent';
import MarkdownRenderer from './MarkdownRenderer';
import { AskUserCard } from './AskUserCard';

interface MessageItemProps {
  message: Message;
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

/** 根据 agentId 查询智能体元数据（内部查 store，保持 MessageItem props 精简） */
function useAgentMeta(agentId?: string): AgentConfig | undefined {
  return useAgentStore((s) => (agentId ? s.agents.find((a) => a.id === agentId) : undefined));
}

/** 渲染单个工具调用的状态行 */
const ToolCallLine = memo(function ToolCallLine({ tc }: { tc: ToolCallInfo }) {
  const isSearchTool = /search/i.test(tc.name);
  const isWebFetch = tc.name === 'web_fetch';
  const Icon = isSearchTool ? Search : isWebFetch ? Globe : Wrench;
  const query = isSearchTool ? getSearchQuery(tc) : '';
  const isPending = tc.status === 'pending';

  let label: React.ReactNode;
  if (isSearchTool) {
    const action = isPending ? '正在检索' : '已经检索';
    label = query ? `${action} ${query}` : action;
  } else if (isWebFetch) {
    const url = String(tc.args?.url || '');
    const action = isPending ? '正在访问' : tc.status === 'error' ? '访问失败' : '已访问';
    const title = getWebFetchTitle(tc) || (url ? getDomain(url) : '未知链接');
    label = (
      <>
        {action}{' '}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-current"
          style={{ color: 'var(--primary)' }}
        >
          {title}
        </a>
      </>
    );
  } else {
    label = isPending ? `正在调用 ${tc.name}...` : `已调用 ${tc.name}`;
  }

  return (
    // 工具调用状态行：图标弱化、文字次级色，仅进行中与链接保留品牌色，层次更清晰
    <div
      className="flex items-center gap-2 text-xs py-1"
      style={{ color: 'var(--foreground-secondary)' }}
    >
      {isPending ? (
        <Loader2 size={14} className="animate-spin" style={{ color: 'var(--primary)' }} />
      ) : (
        <Icon size={14} style={{ color: 'var(--icon-muted)' }} />
      )}
      <span>{label}</span>
    </div>
  );
}, (prevProps, nextProps) => {
  // pending 期间 args 流式更新不触发重渲染，避免 spinner CSS 动画中断；
  // 仅 status/result 变化（pending → success/error）才重新渲染
  const p = prevProps.tc;
  const n = nextProps.tc;
  if (p.status !== n.status) return false;
  if (p.result !== n.result) return false;
  if (p.status === 'pending' && n.status === 'pending') return true;
  return false;
});

/** 词元计数格式化：1B = 1 token，1024 进位（B / Kb / Mb / Gb），Kb 及以上保留 1 位小数 */
function formatTokenCount(n: number): string {
  if (n < 1024) return `${n}B`;
  const units = ['Kb', 'Mb', 'Gb'] as const;
  let v = n;
  let unit = 'B';
  for (const u of units) {
    if (v < 1024) break;
    v /= 1024;
    unit = u;
  }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)}${unit}`;
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
  // 展开内容容器：流式期间统计其渲染 DOM 节点数，超过阈值自动折叠
  const contentRef = useRef<HTMLDivElement | null>(null);
  // 自动折叠只触发一次：用户手动再打开后不再自动折叠
  const autoCollapseDoneRef = useRef(false);
  // 上次统计节点数时的原始文本长度：DOM 统计开销随节点数线性增长，仅在内容明显增长后重新统计
  const lastMeasureLenRef = useRef(0);

  const prevStreamingRef = useRef(isStreaming);
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming) {
      setExpanded(false);
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // 原始思考文本总长度：既作为 DOM 节点统计的节流依据（内容增长 500 字符以上才重新统计），
  // 也作为词元计数展示（1 字符按 1 token 计，1B = 1 token）
  const rawThinkingLen = useMemo(() => {
    if (thinkingBlocks && thinkingBlocks.length > 0) {
      let len = 0;
      for (const b of thinkingBlocks) if (b.type === 'text') len += b.content.length;
      return len;
    }
    return content?.length ?? 0;
  }, [thinkingBlocks, content]);

  // 折叠态下 bar 上滚动展示的最新一行原始思考文本（取末尾 text 块的最后一个非空行，纯文本、不走渲染管线）
  const latestThinkingLine = useMemo(() => {
    if (!isStreaming || expanded) return '';
    let raw = '';
    if (thinkingBlocks && thinkingBlocks.length > 0) {
      for (let i = thinkingBlocks.length - 1; i >= 0; i--) {
        const b = thinkingBlocks[i];
        if (b.type === 'text' && b.content) {
          raw = b.content;
          break;
        }
      }
    } else {
      raw = content ?? '';
    }
    if (!raw) return '';
    const lines = raw.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const t = lines[i].trim();
      if (t) return t;
    }
    return '';
  }, [isStreaming, expanded, thinkingBlocks, content]);

  // 流式期间统计展开内容渲染出的 DOM 节点数，超过 5000 自动折叠；只折叠一次，用户再打开后不再触发
  useEffect(() => {
    if (!isStreaming || !expanded || autoCollapseDoneRef.current) return;
    if (rawThinkingLen - lastMeasureLenRef.current < 500) return;
    const el = contentRef.current;
    if (!el) return;
    lastMeasureLenRef.current = rawThinkingLen;
    if (el.querySelectorAll('*').length > 5000) {
      autoCollapseDoneRef.current = true;
      setExpanded(false);
    }
  }, [isStreaming, expanded, rawThinkingLen]);

  const hasContent = content || (thinkingBlocks && thinkingBlocks.length > 0) || (toolCalls && toolCalls.length > 0);
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
        // 卡片式分隔：禁用 border 描边，改用 boxShadow 构建层次感
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--card)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Header / toggle bar（hover 反馈由 index.css 的 aml-thinking-toggle:hover 负责） */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="aml-thinking-toggle flex w-full cursor-pointer items-center gap-2 px-3 py-2 outline-none transition-all duration-150"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--primary) 6%, transparent)',
          color: 'var(--primary)',
          fontSize: 'var(--font-size-xs)',
          fontWeight: 600,
        }}
      >
        <Sparkles size={14} className="shrink-0" />
        {/* 流式中「正在思考」展示微光闪烁效果（aml-thinking-shimmer），完成态为纯文字 */}
        <span className={`shrink-0${isStreaming ? ' aml-thinking-shimmer' : ''}`}>
          {isStreaming ? '正在思考' : '已思考'}
        </span>
        {/* 流式期间折叠时，在 bar 上展示词元计数（1B = 1 token，1024 进位）与最新一行原始思考文本 */}
        {isStreaming && !expanded && (
          <span className="shrink-0" style={{ color: 'var(--icon-muted)', fontWeight: 400 }}>
            {formatTokenCount(rawThinkingLen)}
          </span>
        )}
        {isStreaming && !expanded && latestThinkingLine && (
          <span
            className="min-w-0 flex-1 truncate"
            style={{ color: 'var(--icon-muted)', fontWeight: 400 }}
          >
            {latestThinkingLine}
          </span>
        )}
        <span className="ml-auto shrink-0">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>

      {/* Thinking content（折叠时不渲染 DOM） */}
      {expanded && (
        <div
          ref={contentRef}
          className="px-3 py-3"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--primary) 2%, transparent)',
            fontSize: 'var(--font-size-sm)',
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

/**
 * 渲染单张内嵌交互卡片（当前支持询问用户）。
 * - pending 状态下展示作答交互，提交后由 askUserService 驱动 resolved；
 * - resolved 状态下隐藏操作区，展示结果文案（支持历史回放）。
 *
 * 必须定义在模块级别（而非 MessageItem 函数体内），否则每次 MessageItem
 * 渲染都会产生新的组件引用，导致 React 卸载重挂子树、重新触发 aml-fade-in-up 动画。
 */
function InteractionCardRenderer({
  interaction,
}: {
  interaction: InteractionCard;
}) {
  // 询问用户卡片
  if (interaction.kind === 'ask_user') {
    return <AskUserCard interaction={interaction} />;
  }

  // 未知卡片类型：不渲染
  return null;
}

const MessageItem = memo(function MessageItem({ message, showSeparator }: MessageItemProps) {
  const meta = useAgentMeta(message.agentId);

  if (message.role === 'user') {
    return (
      <div className="aml-fade-in-up flex justify-end px-4 py-2" role="article" aria-label="用户消息">
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
                fontSize: 'var(--font-size-sm)',
              }}
            >
              你
            </span>
          </div>
          <div
            className="ml-auto w-fit rounded-2xl px-4 py-3"
            style={{
              backgroundColor: 'var(--user-bubble-bg)',
              color: 'var(--user-bubble-fg)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <p className="leading-relaxed" style={{ fontSize: 'var(--font-size-sm)' }}>
              {message.content}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const agentColor = meta?.color ?? 'var(--primary)';
  const agentName = meta?.name ?? '智能体';

  return (
    <div className="aml-fade-in-up px-4 py-2" role="article" aria-label={`${agentName}的消息`} data-agent-id={message.agentId} data-message-id={message.id}>
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
            fontSize: 'var(--font-size-sm)',
          }}
        >
          {agentName}
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
          // Agent 身份色边线：弱化透明度，避免大面积高饱和色块，更贴近现代 SaaS 风格
          borderLeft: '2px solid',
          borderLeftColor: `color-mix(in srgb, ${agentColor} 45%, transparent)`,
          paddingLeft: '14px',
        }}
      >
        {message.segments ? (
          // 有序片段渲染：多段思考块与正文按流式事件到达顺序交错展示
          // （如「思考-正文-思考-正文」渲染为两个独立思考块 + 两段正文）；
          // 仅末尾片段跟随消息的流式状态（新思考块出现时，前一个自动折叠为"已思考"）
          message.segments.map((seg, idx) => {
            const isLast = idx === message.segments!.length - 1;
            const segStreaming = Boolean(message.isStreaming) && isLast;
            if (seg.type === 'thinking') {
              return (
                <ThinkingBlock
                  key={`seg-${idx}`}
                  content=""
                  toolCalls={message.toolCalls}
                  thinkingBlocks={seg.items}
                  isStreaming={segStreaming}
                />
              );
            }
            return (
              <div
                key={`seg-${idx}`}
                style={{ fontSize: 'var(--font-size-sm)', lineHeight: '1.6', color: 'var(--foreground)' }}
              >
                <MarkdownRenderer content={seg.text} isStreaming={segStreaming} />
              </div>
            );
          })
        ) : (
          // Fallback：旧数据（无 segments）保持单思考块渲染
          <>
            <ThinkingBlock
              content={message.reasoningContent || ''}
              toolCalls={message.toolCalls}
              thinkingBlocks={message.thinkingBlocks}
              isStreaming={message.isStreaming && message.reasoningComplete === false}
            />
            {message.reasoningComplete !== false && (
              <div style={{ fontSize: 'var(--font-size-sm)', lineHeight: '1.6', color: 'var(--foreground)' }}>
                <MarkdownRenderer content={message.content} isStreaming={message.isStreaming} />
              </div>
            )}
          </>
        )}
        {/* 渲染内嵌交互卡片（如 ask_user 询问用户），支持 pending 与 resolved 两种状态。
            注意：不能在流式期间隐藏——ask_user 卡片是在工具阻塞等待用户作答时嵌入的，
            此时消息仍处于流式状态，若等流式结束再渲染卡片将永远无法显示 */}
        {(message.interactions ?? []).length > 0 && (
          <div className="mt-3 space-y-2">
            {(message.interactions ?? []).map((interaction) => (
              <InteractionCardRenderer
                key={interaction.id}
                interaction={interaction}
              />
            ))}
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
});

export default MessageItem;
