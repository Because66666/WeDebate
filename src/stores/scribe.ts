import { create } from 'zustand';
import type { ScribeSummary } from '../types';
import { storageService } from '../services/storage';
import { useSettingsStore } from './settings';

interface ScribeState {
  currentConversationId: string | null;
  summariesByConversation: Record<string, ScribeSummary[]>;
  panelOpen: boolean;
  isSummarizing: boolean;
  hasShownOnce: boolean;

  setCurrentConversation: (id: string | null) => void;
  addSummary: (summary: ScribeSummary) => void;
  addTokens: (conversationId: string, inputTokens: number, outputTokens: number) => void;
  setSummarizing: (v: boolean) => void;
  openPanel: () => void;
  closePanel: () => void;
  loadSummaries: (conversationId: string) => void;
  persistSummaries: (conversationId: string) => void;
  clearSummaries: (conversationId: string) => void;
}

export const useScribeStore = create<ScribeState>((set, get) => ({
  currentConversationId: null,
  summariesByConversation: {},
  panelOpen: false,
  isSummarizing: false,
  hasShownOnce: false,

  setCurrentConversation: (id) => {
    set({ currentConversationId: id, hasShownOnce: false, panelOpen: false });
    if (id) {
      get().loadSummaries(id);
      const summaries = get().summariesByConversation[id];
      if (summaries && summaries.length > 0) {
        get().openPanel();
      }
    }
  },

  addSummary: (summary) => {
    const { conversationId } = summary;
    set((state) => {
      const existing = state.summariesByConversation[conversationId] ?? [];
      // 分离统计项与普通摘要项，保证新摘要插入到统计项之前
      const statsEntries = existing.filter((s) => s.kind === 'stats');
      const normalEntries = existing.filter((s) => s.kind !== 'stats');
      const statsEntry = statsEntries[0]; // 至多一个
      const newEntries = statsEntry
        ? [...normalEntries, summary, statsEntry]
        : [...normalEntries, summary];
      return {
        summariesByConversation: {
          ...state.summariesByConversation,
          [conversationId]: newEntries,
        },
      };
    });
    get().persistSummaries(conversationId);
    if (!get().hasShownOnce) {
      get().openPanel();
    }
  },

  addTokens: (conversationId, inputTokens, outputTokens) => {
    set((state) => {
      const existing = state.summariesByConversation[conversationId] ?? [];
      const statsEntries = existing.filter((s) => s.kind === 'stats');
      const normalEntries = existing.filter((s) => s.kind !== 'stats');
      let statsEntry = statsEntries[0];
      if (!statsEntry) {
        // 首次累计时创建统计项
        statsEntry = {
          id: crypto.randomUUID(),
          conversationId,
          agentId: 'scribe-stats',
          agentName: 'Token 统计',
          agentColor: '#888',
          summary: '',
          timestamp: Date.now(),
          kind: 'stats',
          inputTokens: 0,
          outputTokens: 0,
        };
      }
      const updatedStats: ScribeSummary = {
        ...statsEntry,
        inputTokens: (statsEntry.inputTokens ?? 0) + inputTokens,
        outputTokens: (statsEntry.outputTokens ?? 0) + outputTokens,
        timestamp: Date.now(),
      };
      return {
        summariesByConversation: {
          ...state.summariesByConversation,
          [conversationId]: [...normalEntries, updatedStats],
        },
      };
    });
    get().persistSummaries(conversationId);
  },

  setSummarizing: (v) => set({ isSummarizing: v }),

  openPanel: () => {
    useSettingsStore.setState({ sidebarOpen: false });
    set({ panelOpen: true, hasShownOnce: true });
  },

  closePanel: () => set({ panelOpen: false }),

  loadSummaries: (conversationId) => {
    const summaries = storageService.getScribeSummaries(conversationId);
    set((state) => ({
      summariesByConversation: {
        ...state.summariesByConversation,
        [conversationId]: summaries,
      },
    }));
  },

  persistSummaries: (conversationId) => {
    const { summariesByConversation } = get();
    const summaries = summariesByConversation[conversationId] ?? [];
    storageService.setScribeSummaries(conversationId, summaries);
  },

  clearSummaries: (conversationId) => {
    storageService.deleteScribeSummaries(conversationId);
    set((state) => {
      const next = { ...state.summariesByConversation };
      delete next[conversationId];
      return { summariesByConversation: next };
    });
  },
}));

const EMPTY_SUMMARIES: ScribeSummary[] = [];

export function selectCurrentSummaries(state: ScribeState): ScribeSummary[] {
  if (!state.currentConversationId) return EMPTY_SUMMARIES;
  return state.summariesByConversation[state.currentConversationId] ?? EMPTY_SUMMARIES;
}
