import { create } from "zustand";
import { SettingsManager } from "@/services/storage";
import { api, ServerConfig } from "@/services/api";
import { storageConfig } from "@/services/storageConfig";
import Logger from "@/utils/Logger";

const logger = Logger.withTag("SettingsStore");

// ✅ 统一默认值定义
const DEFAULT_API_BASE_URL = "http://28918185.xyz:1029/";
const DEFAULT_M3U_URL = "https://28918185.xyz:25722/live_resources/oriontv.m3u";

interface SettingsState {
  apiBaseUrl: string;
  m3uUrl: string;
  remoteInputEnabled: boolean;
  videoSource: {
    enabledAll: boolean;
    sources: {
      [key: string]: boolean;
    };
  };
  isModalVisible: boolean;
  serverConfig: ServerConfig | null;
  isLoadingServerConfig: boolean;
  loadSettings: () => Promise<void>;
  fetchServerConfig: () => Promise<void>;
  setApiBaseUrl: (url: string) => void;
  setM3uUrl: (url: string) => void;
  setRemoteInputEnabled: (enabled: boolean) => void;
  saveSettings: () => Promise<void>;
  setVideoSource: (config: { enabledAll: boolean; sources: { [key: string]: boolean } }) => void;
  showModal: () => void;
  hideModal: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  // ✅ 使用统一默认值
  apiBaseUrl: DEFAULT_API_BASE_URL,
  m3uUrl: DEFAULT_M3U_URL,
  remoteInputEnabled: false,
  isModalVisible: false,
  serverConfig: null,
  isLoadingServerConfig: false,
  videoSource: {
    enabledAll: true,
    sources: {},
  },

  loadSettings: async () => {
    const settings = await SettingsManager.get();

    const baseUrl = settings.apiBaseUrl || DEFAULT_API_BASE_URL;
    const m3uUrl = settings.m3uUrl || DEFAULT_M3U_URL;

    set({
      apiBaseUrl: baseUrl,
      m3uUrl,
      remoteInputEnabled: settings.remoteInputEnabled || false,
      videoSource: settings.videoSource || {
        enabledAll: true,
        sources: {},
      },
    });

    api.setBaseUrl(baseUrl);
    await get().fetchServerConfig();
  },

  fetchServerConfig: async () => {
    set({ isLoadingServerConfig: true });
    try {
      const config = await api.getServerConfig();
      if (config) {
        storageConfig.setStorageType(config.StorageType);
        set({ serverConfig: config });
      }
    } catch (error) {
      set({ serverConfig: null });
      logger.error("Failed to fetch server config:", error);
    } finally {
      set({ isLoadingServerConfig: false });
    }
  },

  setApiBaseUrl: (url) => set({ apiBaseUrl: url }),
  setM3uUrl: (url) => set({ m3uUrl: url }),
  setRemoteInputEnabled: (enabled) => set({ remoteInputEnabled: enabled }),
  setVideoSource: (config) => set({ videoSource: config }),

  saveSettings: async () => {
    const { apiBaseUrl, m3uUrl, remoteInputEnabled, videoSource } = get();

    let processedApiBaseUrl = apiBaseUrl.trim();
    if (processedApiBaseUrl.endsWith("/")) {
      processedApiBaseUrl = processedApiBaseUrl.slice(0, -1);
    }

    if (!/^https?:\/\//i.test(processedApiBaseUrl)) {
      const hostPart = processedApiBaseUrl.split("/")[0];
      const isIpAddress = /^((\d{1,3}\.){3}\d{1,3})(:\d+)?$/.test(hostPart);
      const hasPort = /:\d+/.test(hostPart);
      processedApiBaseUrl = (isIpAddress || hasPort)
        ? "http://" + processedApiBaseUrl
        : "https://" + processedApiBaseUrl;
    }

    await SettingsManager.save({
      apiBaseUrl: processedApiBaseUrl,
      m3uUrl,
      remoteInputEnabled,
      videoSource,
    });

    api.setBaseUrl(processedApiBaseUrl);
    set({ isModalVisible: false, apiBaseUrl: processedApiBaseUrl });
    await get().fetchServerConfig();
  },

  showModal: () => set({ isModalVisible: true }),
  hideModal: () => set({ isModalVisible: false }),
}));
