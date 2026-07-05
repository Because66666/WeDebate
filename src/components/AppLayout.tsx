import { Menu, Users, Settings, Sun, Moon } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { SettingsPanel } from './SettingsPanel';
import { AgentPanel } from './AgentPanel';
import ChatArea from './ChatArea';
import InputBox from './InputBox';
import { useSettingsStore } from '../stores/settings';
import { useConversationStore } from '../stores/conversation';

export function AppLayout() {
  const sidebarOpen = useSettingsStore((s) => s.sidebarOpen);
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);
  const setSettingsPanelOpen = useSettingsStore((s) => s.setSettingsPanelOpen);
  const setAgentPanelOpen = useSettingsStore((s) => s.setAgentPanelOpen);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const getCurrentConversation = useConversationStore((s) => s.getCurrentConversation);

  const currentConversation = getCurrentConversation();
  const title = currentConversation?.title ?? '新对话';

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div
      className="flex h-screen flex-col"
      style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
    >
      {/* TopBar - Apple-style */}
      <header
        className="flex h-12 shrink-0 items-center gap-3 px-4"
        style={{
          backgroundColor: 'var(--background)',
          borderBottom: '0.5px solid var(--border)',
        }}
      >
        {/* Left: sidebar toggle */}
        <button
          onClick={toggleSidebar}
          aria-label="切换侧边栏"
          className="flex h-7 w-7 cursor-pointer items-center justify-center outline-none transition-all duration-200"
          style={{
            color: 'var(--icon-muted)',
            borderRadius: 'var(--radius-sm)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          title={sidebarOpen ? '收起侧边栏' : '展开侧边栏'}
        >
          <Menu size={17} />
        </button>

        {/* Center: conversation title */}
        <h1
          className="flex-1 truncate text-center font-semibold"
          style={{
            fontSize: '13px',
            letterSpacing: '-0.01em',
            color: 'var(--foreground)',
          }}
        >
          {title}
        </h1>

        {/* Right: theme toggle + agent panel + settings */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
            className="flex h-7 w-7 cursor-pointer items-center justify-center outline-none transition-all duration-200"
            style={{
              color: 'var(--icon-muted)',
              borderRadius: 'var(--radius-sm)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            title={theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={() => setAgentPanelOpen(true)}
            aria-label="智能体面板"
            className="flex h-7 w-7 cursor-pointer items-center justify-center outline-none transition-all duration-200"
            style={{
              color: 'var(--icon-muted)',
              borderRadius: 'var(--radius-sm)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            title="智能体面板"
          >
            <Users size={16} />
          </button>
          <button
            onClick={() => setSettingsPanelOpen(true)}
            aria-label="设置"
            className="flex h-7 w-7 cursor-pointer items-center justify-center outline-none transition-all duration-200"
            style={{
              color: 'var(--icon-muted)',
              borderRadius: 'var(--radius-sm)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            title="设置"
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      {/* Body: Sidebar + Main Content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex flex-1 flex-col overflow-hidden">
          <ChatArea />
          <InputBox />
        </main>
      </div>

      {/* Overlay panels */}
      <SettingsPanel />
      <AgentPanel />
    </div>
  );
}
