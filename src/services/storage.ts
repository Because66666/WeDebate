import type { ApiConfig, Conversation, AgentConfig } from '../types';

const STORAGE_KEYS = {
  API_CONFIG: 'debate-room-api-config',
  CONVERSATIONS: 'debate-room-conversations',
  CURRENT_CONVERSATION: 'debate-room-current-conversation',
  AGENTS: 'debate-room-agents',
  THEME: 'debate-room-theme',
};

export const storageService = {
  // API Config
  getApiConfig: (): ApiConfig | null => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.API_CONFIG);
      return raw ? (JSON.parse(raw) as ApiConfig) : null;
    } catch {
      return null;
    }
  },

  setApiConfig: (config: ApiConfig): void => {
    try {
      localStorage.setItem(STORAGE_KEYS.API_CONFIG, JSON.stringify(config));
    } catch {
      // silently fail
    }
  },

  // Conversations
  getConversations: (): Conversation[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
      return raw ? (JSON.parse(raw) as Conversation[]) : [];
    } catch {
      return [];
    }
  },

  setConversations: (conversations: Conversation[]): void => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.CONVERSATIONS,
        JSON.stringify(conversations)
      );
    } catch {
      // silently fail
    }
  },

  getCurrentConversationId: (): string | null => {
    try {
      return localStorage.getItem(STORAGE_KEYS.CURRENT_CONVERSATION);
    } catch {
      return null;
    }
  },

  setCurrentConversationId: (id: string | null): void => {
    try {
      if (id === null) {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_CONVERSATION);
      } else {
        localStorage.setItem(STORAGE_KEYS.CURRENT_CONVERSATION, id);
      }
    } catch {
      // silently fail
    }
  },

  // Agents
  getAgents: (): AgentConfig[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.AGENTS);
      return raw ? (JSON.parse(raw) as AgentConfig[]) : [];
    } catch {
      return [];
    }
  },

  setAgents: (agents: AgentConfig[]): void => {
    try {
      localStorage.setItem(STORAGE_KEYS.AGENTS, JSON.stringify(agents));
    } catch {
      // silently fail
    }
  },

  // Theme
  getTheme: (): 'light' | 'dark' => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.THEME);
      if (raw === 'light' || raw === 'dark') return raw;
      return 'light';
    } catch {
      return 'light';
    }
  },

  setTheme: (theme: 'light' | 'dark'): void => {
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
    } catch {
      // silently fail
    }
  },
};
