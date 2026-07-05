import { create } from 'zustand';
import type { AgentConfig } from '../types';
import { SCRIBE_AGENT_ID } from '../types';
import { storageService } from '../services/storage';
import { createDefaultAgents } from '../prompts/agents';

interface AgentState {
  agents: AgentConfig[];

  // Actions
  loadAgents: () => void;
  addAgent: (agent: AgentConfig) => void;
  removeAgent: (id: string) => void;
  updateAgent: (id: string, updates: Partial<AgentConfig>) => void;
  toggleAgent: (id: string) => void;
  getEnabledAgents: () => AgentConfig[];
  saveAgents: () => void;
  resetToDefaults: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],

  loadAgents: () => {
    const stored = storageService.getAgents();
    const agents = stored.length > 0 ? stored : createDefaultAgents();
    set({ agents });
  },

  addAgent: (agent: AgentConfig) => {
    set((state) => ({ agents: [...state.agents, agent] }));
    get().saveAgents();
  },

  removeAgent: (id: string) => {
    set((state) => ({ agents: state.agents.filter((a) => a.id !== id) }));
    get().saveAgents();
  },

  updateAgent: (id: string, updates: Partial<AgentConfig>) => {
    set((state) => ({
      agents: state.agents.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    }));
    get().saveAgents();
  },

  toggleAgent: (id: string) => {
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === id ? { ...a, enabled: !a.enabled } : a
      ),
    }));
    get().saveAgents();
  },

  getEnabledAgents: () => {
    return get().agents.filter((a) => a.enabled && a.id !== SCRIBE_AGENT_ID);
  },

  saveAgents: () => {
    storageService.setAgents(get().agents);
  },

  resetToDefaults: () => {
    const agents = createDefaultAgents();
    set({ agents });
    get().saveAgents();
  },
}));
