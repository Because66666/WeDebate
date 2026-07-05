import { useEffect, useRef, useCallback } from 'react';
import { MessageSquare } from 'lucide-react';
import { useConversationStore } from '../stores/conversation';
import { useAgentStore } from '../stores/agent';
import MessageItem from './MessageItem';
import type { Message } from '../types';

export default function ChatArea() {
  const conversation = useConversationStore((s) => s.getCurrentConversation());
  const agents = useAgentStore((s) => s.agents);
  const messages = conversation?.messages ?? [];

  const scrollRef = useRef<HTMLDivElement>(null);
  const isAutoScrollRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAutoScrollRef.current = distanceFromBottom < 60;
  }, []);

  useEffect(() => {
    if (isAutoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div
        className="flex flex-1 items-center justify-center"
        style={{ backgroundColor: 'var(--background)' }}
        role="status"
      >
        <div
          className="flex flex-col items-center gap-4"
          style={{ color: 'var(--foreground-secondary)' }}
        >
          <MessageSquare
            size={56}
            strokeWidth={1}
            style={{ color: 'var(--muted-foreground)' }}
          />
          <p
            className="font-semibold"
            style={{ fontSize: '17px', letterSpacing: '-0.02em' }}
          >
            开始一段新的讨论
          </p>
        </div>
      </div>
    );
  }

  function getShowSeparator(index: number, msg: Message): boolean {
    if (index === 0) return false;
    const prev = messages[index - 1];
    if (prev.role === 'user') return true;
    if (msg.role === 'user') return true;
    if (prev.agentId !== msg.agentId) return true;
    return false;
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto"
      style={{ backgroundColor: 'var(--background)' }}
      role="log"
      aria-label="对话消息区域"
      aria-live="polite"
    >
      <div className="mx-auto max-w-3xl py-4 xl:max-w-5xl">
        {messages.map((msg, i) => {
          const agent = msg.agentId
            ? agents.find((a) => a.id === msg.agentId)
            : undefined;
          return (
            <MessageItem
              key={msg.id}
              message={msg}
              agent={agent}
              showSeparator={getShowSeparator(i, msg)}
            />
          );
        })}
      </div>
    </div>
  );
}
