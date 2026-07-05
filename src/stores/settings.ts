import { create } from 'zustand';
import type { ApiConfig } from '../types';
import { storageService } from '../services/storage';

interface SettingsState {
  apiConfig: ApiConfig | null;
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  settingsPanelOpen: boolean;
  agentPanelOpen: boolean;

  // Actions
  loadSettings: () => void;
  setApiConfig: (config: ApiConfig) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleSidebar: () => void;
  setSettingsPanelOpen: (open: boolean) => void;
  setAgentPanelOpen: (open: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  apiConfig: null,
  theme: 'light',
  sidebarOpen: false,
  settingsPanelOpen: false,
  agentPanelOpen: false,

  loadSettings: () => {
    const apiConfig = storageService.getApiConfig();
    const theme = storageService.getTheme();
    set({ apiConfig, theme });
  },

  setApiConfig: (config: ApiConfig) => {
    set({ apiConfig: config });
    storageService.setApiConfig(config);
  },

  setTheme: (theme: 'light' | 'dark') => {
    set({ theme });
    storageService.setTheme(theme);
    document.documentElement.className = theme;
  },

  toggleSidebar: () => {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }));
  },

  setSettingsPanelOpen: (open: boolean) => {
    set({ settingsPanelOpen: open });
  },

  setAgentPanelOpen: (open: boolean) => {
    set({ agentPanelOpen: open });
  },
}));
