import { create } from 'zustand';
import type { AgentConfig } from '../types';
import { SCRIBE_AGENT_ID } from '../types';
import { storageService } from '../services/storage';
import { createDefaultAgents, AGENT_PRESETS } from '../prompts/agents';

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
    if (stored.length === 0) {
      set({ agents: createDefaultAgents() });
      return;
    }
    // 对齐：缺失的默认 agent 补充进来，保留用户自定义与修改
    const storedIds = new Set(stored.map((a) => a.id));
    const missingDefaults = AGENT_PRESETS.filter((p) => !storedIds.has(p.id));
    if (missingDefaults.length === 0) {
      set({ agents: stored });
      return;
    }
    // 按 AGENT_PRESETS 顺序重建：先保留 stored 中已有的默认 agent（按 preset 顺序），
    // 再追加用户自定义 agent
    const presetIds = new Set(AGENT_PRESETS.map((p) => p.id));
    const ordered: AgentConfig[] = [];
    for (const preset of AGENT_PRESETS) {
      const found = stored.find((a) => a.id === preset.id);
      if (found) {
        ordered.push(found); // 保留用户对该默认 agent 的修改
      } else {
        // 缺失则用默认配置补充
        ordered.push({
          id: preset.id,
          name: preset.name,
          color: preset.color,
          basePrompt: 'base',
          personaPrompt: preset.personaPrompt,
          enabled: true,
        });
      }
    }
    // 追加用户自定义 agent（id 不在 AGENT_PRESETS 中的）
    const customAgents = stored.filter((a) => !presetIds.has(a.id));
    const merged = [...ordered, ...customAgents];
    set({ agents: merged });
    storageService.setAgents(merged);
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
