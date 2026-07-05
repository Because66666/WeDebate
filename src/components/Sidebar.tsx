import { Plus, Trash2, X, MessageSquare } from 'lucide-react';
import { useConversationStore } from '../stores/conversation';
import { useSettingsStore } from '../stores/settings';

export function Sidebar() {
  const conversations = useConversationStore((s) => s.conversations);
  const currentConversationId = useConversationStore((s) => s.currentConversationId);
  const switchConversation = useConversationStore((s) => s.switchConversation);
  const createConversation = useConversationStore((s) => s.createConversation);
  const deleteConversation = useConversationStore((s) => s.deleteConversation);
  const sidebarOpen = useSettingsStore((s) => s.sidebarOpen);
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('确定要删除这个对话吗？')) {
      deleteConversation(id);
    }
  };

  const handleSwitch = (id: string) => {
    switchConversation(id);
    if (window.innerWidth < 768) {
      toggleSidebar();
    }
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          style={{ backgroundColor: 'rgba(0,0,0,0.32)' }}
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } fixed inset-y-0 left-0 z-40 flex w-64 flex-col transition-transform duration-200 ease-in-out md:static md:z-auto md:w-64 md:transition-none ${
          !sidebarOpen ? 'md:hidden' : ''
        }`}
        style={{
          backgroundColor: 'var(--sidebar-bg)',
          borderRight: '0.5px solid var(--border)',
          color: 'var(--sidebar-foreground)',
        }}
        aria-label="对话侧边栏"
      >
        {/* Header */}
        <div
          className="flex h-12 shrink-0 items-center gap-2 px-3"
          style={{ borderBottom: '0.5px solid var(--border)' }}
        >
          <h2
            className="flex-1 truncate font-semibold"
            style={{
              fontSize: '13px',
              color: 'var(--sidebar-foreground)',
              letterSpacing: '-0.01em',
            }}
          >
            对话历史
          </h2>
          <button
            onClick={createConversation}
            aria-label="新建对话"
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center outline-none transition-all duration-200"
            style={{
              color: 'var(--icon-muted)',
              borderRadius: 'var(--radius-sm)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            title="新建对话"
          >
            <Plus size={16} />
          </button>
          {/* Close button on mobile */}
          <button
            onClick={toggleSidebar}
            aria-label="关闭侧边栏"
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center outline-none transition-all duration-200 md:hidden"
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

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto py-1.5 px-2">
          {conversations.map((conv) => {
            const isActive = conv.id === currentConversationId;
            return (
              <div
                key={conv.id}
                onClick={() => handleSwitch(conv.id)}
                role="button"
                tabIndex={0}
                aria-current={isActive ? 'true' : undefined}
                className="group flex cursor-pointer items-center gap-2.5 px-2.5 py-2 outline-none transition-all duration-150"
                style={{
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isActive ? 'var(--sidebar-active)' : 'transparent',
                  color: 'var(--sidebar-foreground)',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
                title={conv.title}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSwitch(conv.id);
                  }
                }}
              >
                <MessageSquare
                  size={14}
                  style={{ color: 'var(--icon-muted)', flexShrink: 0 }}
                />
                <span
                  className="flex-1 truncate"
                  style={{ fontSize: '13px', lineHeight: '1.3' }}
                >
                  {conv.title}
                </span>
                <button
                  onClick={(e) => handleDelete(conv.id, e)}
                  aria-label={`删除对话 ${conv.title}`}
                  className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center opacity-0 outline-none transition-all duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                  style={{
                    color: 'var(--destructive)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--destructive) 10%, transparent)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  title="删除对话"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}
