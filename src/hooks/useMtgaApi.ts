import { invoke } from "@tauri-apps/api/core";

export interface InvokeOptions {
  [key: string]: unknown;
}

async function safeInvoke<T = unknown>(
  command: string,
  args?: InvokeOptions
): Promise<T> {
  try {
    const result = await invoke<T>(command, args);
    return result;
  } catch (error) {
    console.error(`[invoke] ${command} failed:`, error);
    throw error;
  }
}

export function useMtgaApi() {
  const greet = (name: string) =>
    safeInvoke<string>("greet", { name });

  const loadConfig = () =>
    safeInvoke<InvokeResponse>("load_config");

  const saveConfig = (config: Record<string, unknown>) =>
    safeInvoke<InvokeResponse>("save_config", { config });

  const getAppInfo = () =>
    safeInvoke<AppInfo>("get_app_info");

  const generateCertificates = () =>
    safeInvoke<InvokeResponse>("generate_certificates");

  const installCaCert = () =>
    safeInvoke<InvokeResponse>("install_ca_cert");

  const clearCaCert = (commonName?: string) =>
    safeInvoke<InvokeResponse>("clear_ca_cert", { commonName });

  const hostsModify = (mode: string, domain?: string, ip?: unknown) =>
    safeInvoke<InvokeResponse>("hosts_modify", { mode, domain, ip });

  const hostsOpen = () =>
    safeInvoke<InvokeResponse>("hosts_open");

  const proxyStart = (opts: {
    debugMode: boolean;
    disableSslStrictMode: boolean;
    forceStream: boolean;
    streamMode?: string;
  }) =>
    safeInvoke<InvokeResponse>("proxy_start", {
      debugMode: opts.debugMode,
      disableSslStrictMode: opts.disableSslStrictMode,
      forceStream: opts.forceStream,
      streamMode: opts.streamMode,
    });

  const proxyStop = () =>
    safeInvoke<InvokeResponse>("proxy_stop");

  const proxyCheckNetwork = () =>
    safeInvoke<InvokeResponse>("proxy_check_network");

  const proxyStartAll = (opts: {
    debugMode: boolean;
    disableSslStrictMode: boolean;
    forceStream: boolean;
    streamMode?: string;
  }) =>
    safeInvoke<InvokeResponse>("proxy_start_all", {
      debugMode: opts.debugMode,
      disableSslStrictMode: opts.disableSslStrictMode,
      forceStream: opts.forceStream,
      streamMode: opts.streamMode,
    });

  const pullLogs = (afterId?: number, maxItems?: number) =>
    safeInvoke<{ items: string[]; next_id: number; has_more: boolean }>(
      "pull_logs",
      { afterId, maxItems }
    );

  const frontendReport = (message: string) =>
    safeInvoke<void>("frontend_report", { message });

  const startupStatus = () =>
    safeInvoke<InvokeResponse>("startup_status");

  const configGroupTest = (index: number) =>
    safeInvoke<InvokeResponse>("config_group_test", { index });

  const configGroupModels = (opts: {
    provider?: string;
    apiUrl: string;
    apiKey?: string;
    middleRoute?: string;
  }) =>
    safeInvoke<InvokeResponse>("config_group_models", {
      provider: opts.provider,
      apiUrl: opts.apiUrl,
      apiKey: opts.apiKey,
      middleRoute: opts.middleRoute,
    });

  const systemPromptsList = () =>
    safeInvoke<InvokeResponse>("system_prompts_list");

  const systemPromptsUpdate = (hash: string, editedText: string) =>
    safeInvoke<InvokeResponse>("system_prompts_update", { hash, editedText });

  const systemPromptsDelete = (hashes: string[]) =>
    safeInvoke<InvokeResponse>("system_prompts_delete", { hashes });

  const checkUpdates = () =>
    safeInvoke<InvokeResponse>("check_updates");

  const userDataOpenDir = () =>
    safeInvoke<InvokeResponse>("user_data_open_dir");

  const userDataBackup = () =>
    safeInvoke<InvokeResponse>("user_data_backup");

  const userDataRestoreLatest = () =>
    safeInvoke<InvokeResponse>("user_data_restore_latest");

  const userDataClear = () =>
    safeInvoke<InvokeResponse>("user_data_clear");

  return {
    greet,
    loadConfig,
    saveConfig,
    getAppInfo,
    generateCertificates,
    installCaCert,
    clearCaCert,
    hostsModify,
    hostsOpen,
    proxyStart,
    proxyStop,
    proxyCheckNetwork,
    proxyStartAll,
    pullLogs,
    frontendReport,
    startupStatus,
    configGroupTest,
    configGroupModels,
    systemPromptsList,
    systemPromptsUpdate,
    systemPromptsDelete,
    checkUpdates,
    userDataOpenDir,
    userDataBackup,
    userDataRestoreLatest,
    userDataClear,
  };
}

interface InvokeResponse {
  ok: boolean;
  message: string;
  code?: string;
  details?: Record<string, unknown> | unknown;
  logs?: string[];
}

interface AppInfo {
  display_name: string;
  version: string;
  github_repo: string;
  ca_common_name: string;
  api_key_visible_chars: number;
  user_data_dir: string;
}
