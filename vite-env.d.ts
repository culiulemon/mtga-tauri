/// <reference types="vite/client" />

interface Window {
  __MTGA_RUNTIME__?: string;
  __TAURI__?: {
    core?: {
      invoke?: (...args: unknown[]) => Promise<unknown>;
    };
    event?: {
      emit?: (event: string, payload?: unknown) => Promise<void>;
      listen?: <T>(event: string, handler: (event: { payload: T }) => void) => Promise<() => void>;
    };
  };
}
