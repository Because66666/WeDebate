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
      return {
        summariesByConversation: {
          ...state.summariesByConversation,
          [conversationId]: [...existing, summary],
        },
      };
    });
    get().persistSummaries(conversationId);
    if (!get().hasShownOnce) {
      get().openPanel();
    }
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
