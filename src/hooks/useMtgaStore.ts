import { create } from "zustand";
import type { AppConfig, ConfigGroup, GlobalConfig, SystemPromptItem, ThemeConfig, AppInfo, ProxyStep } from "../types/mtgaTypes";
import { useMtgaApi } from "./useMtgaApi";

interface LogEntry {
  id: number;
  text: string;
}

interface MtgaStore {
  config: AppConfig;
  appInfo: AppInfo | null;
  logs: LogEntry[];
  nextLogId: number;
  proxyRunning: boolean;
  systemPrompts: SystemPromptItem[];
  themeConfig: ThemeConfig;
  proxySteps: ProxyStep[];
  activeTab: string;

  setConfig: (config: AppConfig) => void;
  updateConfig: (partial: Partial<AppConfig>) => void;
  updateConfigGroup: (index: number, group: ConfigGroup) => void;
  addConfigGroup: (group: ConfigGroup) => void;
  removeConfigGroup: (index: number) => void;
  updateGlobalConfig: (global: GlobalConfig) => void;
  setAppInfo: (info: AppInfo) => void;
  addLogs: (logs: string[]) => void;
  clearLogs: () => void;
  setProxyRunning: (running: boolean) => void;
  setSystemPrompts: (prompts: SystemPromptItem[]) => void;
  updateSystemPrompt: (params: { hash: string; edited_text: string }) => Promise<boolean>;
  setThemeConfig: (config: ThemeConfig) => void;
  addProxyStep: (step: ProxyStep) => void;
  clearProxySteps: () => void;
  setActiveTab: (tab: string) => void;
  loadConfig: () => Promise<void>;
  saveConfig: () => Promise<void>;
  fetchSystemPrompts: () => Promise<void>;
}

const defaultConfig: AppConfig = {
  config_groups: [],
  global_config: { mapped_model_id: "", mtga_auth_key: "" },
};

const defaultThemeConfig: ThemeConfig = {
  primary_color: "#f0bb32",
  accent_color: "#f59e0b",
  background_color: "#f7f8fb",
  text_color: "#0f172a",
  secondary_color: "#64748b",
  success_color: "#22c55e",
  warning_color: "#f59e0b",
  error_color: "#ef4444",
  font_family: "system-ui",
};

export const useMtgaStore = create<MtgaStore>((set, get) => {
  const api = useMtgaApi();

  return {
    config: defaultConfig,
    appInfo: null,
    logs: [],
    nextLogId: 0,
    proxyRunning: false,
    systemPrompts: [],
    themeConfig: defaultThemeConfig,
    proxySteps: [],
    activeTab: "proxy",

    setConfig: (config) => set({ config }),

    updateConfig: (partial) =>
      set((state) => ({ config: { ...state.config, ...partial } })),

    updateConfigGroup: (index, group) =>
      set((state) => {
        const groups = [...state.config.config_groups];
        groups[index] = group;
        return { config: { ...state.config, config_groups: groups } };
      }),

    addConfigGroup: (group) =>
      set((state) => ({
        config: {
          ...state.config,
          config_groups: [...state.config.config_groups, group],
        },
      })),

    removeConfigGroup: (index) =>
      set((state) => {
        const groups = state.config.config_groups.filter((_, i) => i !== index);
        return { config: { ...state.config, config_groups: groups } };
      }),

    updateGlobalConfig: (global) =>
      set((state) => ({
        config: { ...state.config, global_config: global },
      })),

    setAppInfo: (info) => set({ appInfo: info }),

    addLogs: (newLogs) =>
      set((state) => {
        const entries = newLogs.map((text, i) => ({
          id: state.nextLogId + i,
          text,
        }));
        return {
          logs: [...state.logs, ...entries],
          nextLogId: state.nextLogId + newLogs.length,
        };
      }),

    clearLogs: () => set({ logs: [], nextLogId: 0 }),

    setProxyRunning: (running) => set({ proxyRunning: running }),

    setSystemPrompts: (prompts) => set({ systemPrompts: prompts }),

    updateSystemPrompt: async ({ hash, edited_text }: { hash: string; edited_text: string }) => {
      const resp = await api.systemPromptsUpdate(hash, edited_text);
      if (resp.logs) {
        const state = get();
        const newEntries: LogEntry[] = resp.logs.map((text, i) => ({
          id: state.nextLogId + i,
          text,
        }));
        set({ logs: [...state.logs, ...newEntries], nextLogId: state.nextLogId + resp.logs.length });
      }
      return resp.ok;
    },

    setThemeConfig: (config) => set({ themeConfig: config }),

    addProxyStep: (step) =>
      set((state) => ({
        proxySteps: [...state.proxySteps, step],
      })),

    clearProxySteps: () => set({ proxySteps: [] }),

    setActiveTab: (tab) => set({ activeTab: tab }),

    loadConfig: async () => {
      try {
        const resp = await api.loadConfig();
        if (resp.ok && resp.details) {
          set({ config: resp.details as AppConfig });
        }
      } catch {
        console.error("加载配置失败");
      }
    },

    saveConfig: async () => {
      try {
        const state = get();
        await api.saveConfig(state.config as unknown as Record<string, unknown>);
      } catch {
        console.error("保存配置失败");
      }
    },

    fetchSystemPrompts: async () => {
      try {
        const resp = await api.systemPromptsList();
        if (resp.ok && resp.details) {
          const details = resp.details as { items: SystemPromptItem[] };
          set({ systemPrompts: details.items || [] });
        }
      } catch {
        console.error("加载系统提示词失败");
      }
    },
  };
});
