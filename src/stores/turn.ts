import { create } from 'zustand';
import type { TurnState, AgentConfig } from '../types';
import {
  createTurnManager,
  advanceTurn,
  handleUserInterrupt,
  getNextAgent,
} from '../services/turn-manager';

interface TurnStoreState {
  turnState: TurnState | null;
  isProcessing: boolean;

  // Actions
  initTurn: (agents: AgentConfig[]) => void;
  getNextSpeaker: () => string | null;
  advance: () => void;
  userInterrupt: (currentAgentId: string) => void;
  setProcessing: (processing: boolean) => void;
  resetTurn: () => void;
}

export const useTurnStore = create<TurnStoreState>((set, get) => ({
  turnState: null,
  isProcessing: false,

  initTurn: (agents: AgentConfig[]) => {
    const turnState = createTurnManager(agents);
    set({ turnState });
  },

  getNextSpeaker: () => {
    const { turnState } = get();
    if (!turnState) return null;
    return getNextAgent(turnState);
  },

  advance: () => {
    set((state) => {
      if (!state.turnState) return state;
      return { turnState: advanceTurn(state.turnState) };
    });
  },

  userInterrupt: (currentAgentId: string) => {
    set((state) => {
      if (!state.turnState) return state;
      return { turnState: handleUserInterrupt(state.turnState, currentAgentId) };
    });
  },

  setProcessing: (processing: boolean) => {
    set({ isProcessing: processing });
  },

  resetTurn: () => {
    set({ turnState: null, isProcessing: false });
  },
}));
