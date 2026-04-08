export interface ConfigGroup {
  name: string;
  provider: string;
  api_url: string;
  model_id: string;
  api_key: string;
  middle_route: string;
  middle_route_enabled: boolean;
  target_model_id: string;
  model_discovery_strategy: string;
}

export interface GlobalConfig {
  mapped_model_id: string;
  mtga_auth_key: string;
}

export interface AppConfig {
  config_groups: ConfigGroup[];
  global_config: GlobalConfig;
  warnings?: string[];
}

export interface OperationResult {
  ok: boolean;
  message: string;
  code?: string;
  details?: Record<string, unknown> | unknown;
}

export interface InvokeResponse {
  ok: boolean;
  message: string;
  code?: string;
  details?: Record<string, unknown> | unknown;
  logs: string[];
}

export interface SystemPromptDelta {
  edited_text: string;
  edited_at: string;
}

export interface SystemPromptItem {
  hash: string;
  provider: string;
  model_id: string;
  original_text: string;
  edited_text: string;
  last_modified: string;
  created_at?: string;
  latest_delta?: SystemPromptDelta;
}

export interface ThemeConfig {
  primary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  secondary_color: string;
  success_color: string;
  warning_color: string;
  error_color: string;
  font_family: string;
  background_image?: string;
}

export interface ProxyStep {
  step: string;
  message: string;
  done: boolean;
}

export interface AppInfo {
  display_name: string;
  version: string;
  github_repo: string;
  ca_common_name: string;
  api_key_visible_chars: number;
  user_data_dir: string;
}

export type ProxyProvider = "openai_chat_completion" | "anthropic" | "gemini";
