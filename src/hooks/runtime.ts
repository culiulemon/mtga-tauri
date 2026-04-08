import { listen } from "@tauri-apps/api/event";
import { useMtgaStore } from "./useMtgaStore";
import { useMtgaApi } from "./useMtgaApi";
import type { ProxyStep } from "../types/mtgaTypes";

let logPollingTimer: ReturnType<typeof setInterval> | null = null;
let lastLogId = 0;

export function useRuntime() {
  const api = useMtgaApi();
  const { addLogs, setProxyRunning, addProxyStep, setAppInfo, clearProxySteps } = useMtgaStore();

  const initRuntime = async () => {
    const runtimeVal = window.__MTGA_RUNTIME__;
    if (runtimeVal) {
      console.log("[Runtime] Backend runtime:", runtimeVal);
    }

    try {
      const info = await api.getAppInfo();
      if (info) {
        setAppInfo(info as unknown as import("../types/mtgaTypes").AppInfo);
      }
    } catch {
      console.error("获取应用信息失败");
    }

    try {
      const status = await api.startupStatus();
      if (status.ok && status.logs) {
        addLogs(status.logs);
      }
    } catch {
      console.error("获取启动状态失败");
    }

    startLogPolling();
    listenProxySteps();
  };

  const startLogPolling = () => {
    if (logPollingTimer) clearInterval(logPollingTimer);
    logPollingTimer = setInterval(async () => {
      try {
        const result = await api.pullLogs(lastLogId, 100);
        if (result.items && result.items.length > 0) {
          addLogs(result.items);
          lastLogId = result.next_id;
        }
      } catch {
        // ignore polling errors
      }
    }, 1000);
  };

  const listenProxySteps = async () => {
    try {
      await listen<ProxyStep>("mtga:proxy-step", (event) => {
        addProxyStep(event.payload);
      });
    } catch {
      console.error("监听代理步骤事件失败");
    }
  };

  const cleanup = () => {
    if (logPollingTimer) {
      clearInterval(logPollingTimer);
      logPollingTimer = null;
    }
  };

  return { initRuntime, cleanup };
}
