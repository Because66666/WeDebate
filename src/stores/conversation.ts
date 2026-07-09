import { create } from 'zustand';
import type { Conversation, Message, ApiConfig } from '../types';
import { storageService } from '../services/storage';
import { generateTitle } from '../services/scribe-service';
import { useScribeStore } from './scribe';

interface ConversationState {
  conversations: Conversation[];
  currentConversationId: string | null;

  // Getters
  getCurrentConversation: () => Conversation | undefined;

  // Actions
  loadConversations: () => void;
  createConversation: () => string;
  deleteConversation: (id: string) => void;
  switchConversation: (id: string) => void;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, content: string, isStreaming?: boolean, reasoningContent?: string, thinkingBlocks?: import('../types').ThinkingBlockItem[]) => void;
  patchMessage: (messageId: string, patch: Partial<Omit<Message, 'id'>>) => void;
  updateConversationTitle: (id: string, title: string) => void;
  generateAndSetTitle: (apiConfig: ApiConfig, userMessage: string, agentResponse: string) => Promise<void>;
  saveConversations: () => void;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  currentConversationId: null,

  getCurrentConversation: () => {
    const { conversations, currentConversationId } = get();
    return conversations.find((c) => c.id === currentConversationId);
  },

  loadConversations: () => {
    const conversations = storageService.getConversations();
    const currentId = storageService.getCurrentConversationId();
    set({ conversations, currentConversationId: currentId });
  },

  createConversation: () => {
    const id = crypto.randomUUID();
    const now = Date.now();
    const conversation: Conversation = {
      id,
      title: '新对话',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({
      conversations: [conversation, ...state.conversations],
      currentConversationId: id,
    }));
    get().saveConversations();
    storageService.setCurrentConversationId(id);
    return id;
  },

  deleteConversation: (id: string) => {
    storageService.deleteScribeSummaries(id);
    set((state) => {
      const conversations = state.conversations.filter((c) => c.id !== id);
      const currentConversationId =
        state.currentConversationId === id
          ? conversations[0]?.id ?? null
          : state.currentConversationId;
      return { conversations, currentConversationId };
    });
    get().saveConversations();
    storageService.setCurrentConversationId(get().currentConversationId);
    useScribeStore.getState().setCurrentConversation(get().currentConversationId);
  },

  switchConversation: (id: string) => {
    set({ currentConversationId: id });
    storageService.setCurrentConversationId(id);
    useScribeStore.getState().setCurrentConversation(id);
  },

  addMessage: (message: Message) => {
    set((state) => {
      const conversations = state.conversations.map((c) => {
        if (c.id === state.currentConversationId) {
          return {
            ...c,
            messages: [...c.messages, message],
            updatedAt: Date.now(),
          };
        }
        return c;
      });
      return { conversations };
    });
    get().saveConversations();
  },

  updateMessage: (messageId: string, content: string, isStreaming?: boolean, reasoningContent?: string, thinkingBlocks?: import('../types').ThinkingBlockItem[]) => {
    set((state) => {
      const conversations = state.conversations.map((c) => {
        if (c.id === state.currentConversationId) {
          return {
            ...c,
            messages: c.messages.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    content,
                    ...(isStreaming !== undefined ? { isStreaming } : {}),
                    ...(reasoningContent !== undefined ? { reasoningContent } : {}),
                    ...(thinkingBlocks !== undefined ? { thinkingBlocks } : {}),
                  }
                : m
            ),
            updatedAt: Date.now(),
          };
        }
        return c;
      });
      return { conversations };
    });
    // Skip saving to localStorage during streaming to avoid performance issues
    if (isStreaming) return;
    get().saveConversations();
  },

  patchMessage: (messageId: string, patch: Partial<Omit<Message, 'id'>>) => {
    let targetIsStreaming = false;
    set((state) => {
      const conversations = state.conversations.map((c) => {
        if (c.id === state.currentConversationId) {
          const target = c.messages.find((m) => m.id === messageId);
          if (target) targetIsStreaming = target.isStreaming ?? false;
          return {
            ...c,
            messages: c.messages.map((m) =>
              m.id === messageId ? { ...m, ...patch } : m
            ),
            updatedAt: Date.now(),
          };
        }
        return c;
      });
      return { conversations };
    });
    // 流式期间不保存到本地存储，避免性能问题
    if (patch.isStreaming ?? targetIsStreaming) return;
    get().saveConversations();
  },

  updateConversationTitle: (id: string, title: string) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, title, updatedAt: Date.now() } : c
      ),
    }));
    get().saveConversations();
  },

  generateAndSetTitle: async (apiConfig: ApiConfig, userMessage: string, agentResponse: string) => {
    const { currentConversationId } = get();
    if (!currentConversationId) {
      console.warn('[TitleGen] 无当前对话，跳过标题生成');
      return;
    }
    const conv = get().conversations.find((c) => c.id === currentConversationId);
    if (!conv) {
      console.warn('[TitleGen] 未找到对话');
      return;
    }
    if (conv.title !== '新对话') {
      console.log('[TitleGen] 标题已存在，跳过:', conv.title);
      return;
    }
    try {
      console.log('[TitleGen] 开始生成标题...');
      const title = await generateTitle(apiConfig, userMessage, agentResponse);
      if (title) {
        get().updateConversationTitle(currentConversationId, title);
        console.log('[TitleGen] 标题已更新:', title);
      } else {
        console.warn('[TitleGen] 生成的标题为空');
      }
    } catch (err) {
      console.error('[TitleGen] 标题生成失败:', err);
    }
  },

  saveConversations: () => {
    const { conversations } = get();
    storageService.setConversations(conversations);
  },
}));
