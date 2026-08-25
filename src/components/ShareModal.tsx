import { useMemo, useState } from 'react';
import { Share2, X, Copy, Check, Download } from 'lucide-react';
import type { Message } from '../types';
import { useConversationStore } from '../stores/conversation';
import { useAgentStore } from '../stores/agent';

/** 提取消息正文（不含思考块与工具调用）：
 *  - 新数据（segments）：按序拼接所有 text 片段；
 *  - 旧数据（无 segments）：直接取 content。 */
function extractBodyText(message: Message): string {
  if (message.segments) {
    return message.segments
      .filter((seg) => seg.type === 'text')
      .map((seg) => (seg as { type: 'text'; text: string }).text.trim())
      .filter(Boolean)
      .join('\n\n');
  }
  return (message.content ?? '').trim();
}

/** 文件名安全化：去除 Windows 非法字符、控制字符与末尾句点 */
function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/[\x00-\x1f]/g, '')
      .replace(/\.+$/, '')
      .trim() || '会话记录'
  );
}

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
}

export function ShareModal({ open, onClose }: ShareModalProps) {
  const getCurrentConversation = useConversationStore((s) => s.getCurrentConversation);
  const agents = useAgentStore((s) => s.agents);
  const [copied, setCopied] = useState(false);

  const conversation = getCurrentConversation();

  const markdown = useMemo(() => {
    if (!conversation) return '';
    const lines: string[] = [`# ${conversation.title}`, ''];
    const now = new Date().toLocaleString('zh-CN', { dateStyle: 'long', timeStyle: 'short' });
    lines.push(`> 导出于 ${now}`, '');

    for (const message of conversation.messages) {
      const body = extractBodyText(message);
      if (!body) continue; // 跳过无正文的消息（如纯思考/工具消息）
      const speaker =
        message.role === 'user'
          ? '你'
          : agents.find((a) => a.id === message.agentId)?.name ?? '智能体';
      lines.push(`## ${speaker}`, '', body, '');
    }
    return lines.join('\n').trimEnd() + '\n';
  }, [conversation, agents]);

  const messageCount = useMemo(
    () => (conversation?.messages ?? []).filter((m) => extractBodyText(m)).length,
    [conversation]
  );

  const handleCopy = async () => {
    if (!markdown) return;
    let success = false;
    try {
      await navigator.clipboard.writeText(markdown);
      success = true;
    } catch {
      // 剪贴板 API 不可用时的兜底：textarea + execCommand
      const textarea = document.createElement('textarea');
      textarea.value = markdown;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      success = document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    if (!success) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = () => {
    if (!markdown || !conversation) return;
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${sanitizeFilename(conversation.title)}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-200"
        style={{ backgroundColor: 'rgba(0,0,0,0.32)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        className="fixed left-1/2 top-1/2 z-50 flex h-[70vh] w-[min(680px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col"
        style={{
          backgroundColor: 'var(--card)',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
        }}
        role="dialog"
        aria-label="分享会话"
      >
        {/* Header */}
        <div
          className="flex h-12 shrink-0 items-center justify-between px-4"
          style={{ borderBottom: '0.5px solid var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <Share2 size={16} style={{ color: 'var(--icon-muted)' }} />
            <h2 className="font-semibold" style={{ fontSize: '13px', color: 'var(--foreground)' }}>
              分享会话
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="关闭分享"
            className="flex h-7 w-7 cursor-pointer items-center justify-center outline-none transition-all duration-150"
            style={{ color: 'var(--icon-muted)', borderRadius: 'var(--radius-sm)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body：Markdown 源码预览 */}
        <div className="flex-1 overflow-hidden p-4">
          {markdown ? (
            <textarea
              readOnly
              value={markdown}
              className="h-full w-full resize-none outline-none"
              style={{
                fontSize: '12px',
                lineHeight: '1.7',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                color: 'var(--foreground)',
                backgroundColor: 'var(--background)',
                border: '0.5px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
              }}
              aria-label="Markdown 内容"
            />
          ) : (
            <div
              className="flex h-full items-center justify-center text-sm"
              style={{ color: 'var(--foreground-secondary)' }}
            >
              当前会话暂无可导出的内容
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex shrink-0 items-center justify-between px-4 py-3"
          style={{ borderTop: '0.5px solid var(--border)' }}
        >
          <span className="text-xs" style={{ color: 'var(--foreground-secondary)' }}>
            仅导出用户与智能体正文，不含思考与工具调用
            {markdown ? ` · ${messageCount} 条消息` : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={!markdown}
              className="flex h-8 cursor-pointer items-center gap-1.5 px-3 text-sm transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                color: 'var(--foreground)',
                border: '0.5px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'transparent',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Download size={14} />
              下载 .md
            </button>
            <button
              onClick={handleCopy}
              disabled={!markdown}
              className="flex h-8 cursor-pointer items-center gap-1.5 px-3 text-sm font-medium text-white transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                backgroundColor: 'var(--primary)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? '已复制' : '复制'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
