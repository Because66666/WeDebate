import { useEffect } from 'react';
import { AppLayout } from './components/AppLayout';
import { useConversationStore } from './stores/conversation';
import { useAgentStore } from './stores/agent';
import { useSettingsStore } from './stores/settings';
import { useScribeStore } from './stores/scribe';

function App() {
  const loadConversations = useConversationStore((s) => s.loadConversations);
  const loadAgents = useAgentStore((s) => s.loadAgents);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    loadConversations();
    loadAgents();
    loadSettings();
  }, []);

  // 初始化 scribe store 到当前会话
  useEffect(() => {
    const currentId = useConversationStore.getState().currentConversationId;
    if (currentId) {
      useScribeStore.getState().setCurrentConversation(currentId);
    }
  }, []);

  // Apply dark mode class to document root
  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  return <AppLayout />;
}

export default App;
