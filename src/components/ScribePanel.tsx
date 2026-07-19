import { X, ClipboardList, Loader2, BarChart3 } from 'lucide-react';
import { useScribeStore, selectCurrentSummaries, selectIsSummarizing } from '../stores/scribe';
import MarkdownRenderer from './MarkdownRenderer';

function scrollToAgentFirstMessage(agentId: string) {
  const container = document.querySelector('[role="log"]');
  if (!container) return;
  const el = container.querySelector(`[data-agent-id="${agentId}"]`) as HTMLElement | null;
  if (!el) return;
  const containerRect = container.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const offset = elRect.top - containerRect.top;
  const targetScroll = container.scrollTop + offset - containerRect.height * 0.25;
  container.scrollTo({ top: targetScroll, behavior: 'smooth' });
}

export function ScribePanel() {
  const panelOpen = useScribeStore((s) => s.panelOpen);
  const isSummarizing = useScribeStore(selectIsSummarizing);
  const closePanel = useScribeStore((s) => s.closePanel);
  const summaries = useScribeStore(selectCurrentSummaries);

  return (
    <>
      {/* Mobile overlay backdrop */}
      <div
        className={`fixed inset-0 z-30 transition-opacity duration-[800ms] ease-in-out md:hidden ${
          panelOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        style={{ backgroundColor: 'rgba(0,0,0,0.32)' }}
        onClick={closePanel}
        aria-hidden="true"
      />

      <aside
        className={`${
          panelOpen ? 'translate-x-0' : 'translate-x-full'
        } fixed inset-y-0 right-0 z-40 flex w-80 flex-col transition-transform duration-[800ms] ease-in-out md:static md:z-auto md:translate-x-0 md:transition-[width] md:duration-[800ms] md:ease-in-out ${
          panelOpen ? 'md:w-80' : 'md:w-0 md:overflow-hidden'
        }`}
        style={{
          backgroundColor: 'var(--card)',
          borderLeft: '0.5px solid var(--border)',
        }}
        role="complementary"
        aria-label="书记官记录面板"
        aria-hidden={!panelOpen}
      >
      {/* Header */}
      <div
        className="flex h-12 shrink-0 items-center justify-between px-4"
        style={{ borderBottom: '0.5px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <ClipboardList size={16} style={{ color: 'var(--icon-muted)' }} />
          <h2
            className="font-semibold"
            style={{ fontSize: '13px', color: 'var(--foreground)' }}
          >
            书记官记录
          </h2>
        </div>
        <button
          onClick={closePanel}
          aria-label="关闭书记官面板"
          className="flex h-7 w-7 cursor-pointer items-center justify-center outline-none transition-all duration-150"
          style={{
            color: 'var(--icon-muted)',
            borderRadius: 'var(--radius-sm)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {summaries.length === 0 && !isSummarizing ? (
          <p
            className="py-8 text-center text-sm"
            style={{ color: 'var(--foreground-secondary)' }}
          >
            暂无总结记录
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {summaries.map((item) => {
              if (item.kind === 'stats') {
                // Token 统计面板：样式与顾问摘要卡片一致
                return (
                  <div
                    key={item.id}
                    className="overflow-hidden"
                    style={{
                      borderRadius: 'var(--radius-md)',
                      border: '0.5px solid var(--border)',
                      backgroundColor: 'var(--background-secondary)',
                    }}
                  >
                    <div
                      className="flex items-center gap-2 px-3 py-2"
                      style={{ borderBottom: '0.5px solid var(--border)' }}
                    >
                      <BarChart3
                        size={12}
                        style={{ color: 'var(--icon-muted)' }}
                        aria-hidden="true"
                      />
                      <span
                        className="font-semibold"
                        style={{ fontSize: '12px', color: 'var(--foreground)' }}
                      >
                        {item.agentName}
                      </span>
                    </div>
                    <div className="px-3 py-2.5">
                      <div
                        className="flex flex-col gap-1"
                        style={{ fontSize: '13px', color: 'var(--foreground)' }}
                      >
                        <div className="flex items-center justify-between">
                          <span style={{ color: 'var(--foreground-secondary)' }}>
                            输入 Token
                          </span>
                          <span className="font-semibold tabular-nums">
                            {(item.inputTokens ?? 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span style={{ color: 'var(--foreground-secondary)' }}>
                            输出 Token
                          </span>
                          <span className="font-semibold tabular-nums">
                            {(item.outputTokens ?? 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
              // 普通顾问摘要项
              return (
                <div
                  key={item.id}
                  className="overflow-hidden cursor-pointer"
                  style={{
                    borderRadius: 'var(--radius-md)',
                    border: '0.5px solid var(--border)',
                    backgroundColor: 'var(--background-secondary)',
                  }}
                  onClick={() => scrollToAgentFirstMessage(item.agentId)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      scrollToAgentFirstMessage(item.agentId);
                    }
                  }}
                >
                  <div
                    className="flex items-center gap-2 px-3 py-2"
                    style={{ borderBottom: '0.5px solid var(--border)' }}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.agentColor }}
                      aria-hidden="true"
                    />
                    <span
                      className="font-semibold"
                      style={{ fontSize: '12px', color: 'var(--foreground)' }}
                    >
                      {item.agentName}
                    </span>
                  </div>
                  <div className="px-3 py-2.5">
                    <div className="markdown-body" style={{ fontSize: '13px' }}>
                      <MarkdownRenderer content={item.summary} />
                    </div>
                  </div>
                </div>
              );
            })}
            {isSummarizing && (
              <div
                className="flex items-center gap-2 px-3 py-2.5"
                style={{
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--background-secondary)',
                  color: 'var(--foreground-secondary)',
                  fontSize: '12px',
                }}
              >
                <Loader2 size={13} className="animate-spin" />
                <span>正在总结...</span>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
    </>
  );
}
