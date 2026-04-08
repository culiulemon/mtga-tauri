import { useState } from "react";
import { useMtgaStore } from "@/hooks/useMtgaStore";
import { useMtgaApi } from "@/hooks/useMtgaApi";
import MtgaSelect from "@/components/ui/MtgaSelect";

export default function ProxyTab() {
  const store = useMtgaStore();
  const api = useMtgaApi();
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [disableSslStrict, setDisableSslStrict] = useState(false);
  const [forceStream, setForceStream] = useState(false);
  const [streamMode, setStreamMode] = useState("true");

  const handleStart = async () => {
    if (runningAction) return;
    setRunningAction("start");
    try {
      const resp = await api.proxyStart({
        debugMode,
        disableSslStrictMode: disableSslStrict,
        forceStream,
        streamMode,
      });
      if (resp.logs) store.addLogs(resp.logs);
      if (resp.ok) store.setProxyRunning(true);
    } catch (e) {
      store.addLogs([`启动代理失败: ${e}`]);
    } finally {
      setRunningAction(null);
    }
  };

  const handleStop = async () => {
    if (runningAction) return;
    setRunningAction("stop");
    try {
      const resp = await api.proxyStop();
      if (resp.logs) store.addLogs(resp.logs);
      if (resp.ok) store.setProxyRunning(false);
    } catch (e) {
      store.addLogs([`停止代理失败: ${e}`]);
    } finally {
      setRunningAction(null);
    }
  };

  const handleCheck = async () => {
    if (runningAction) return;
    setRunningAction("check");
    try {
      const resp = await api.proxyCheckNetwork();
      if (resp.logs) store.addLogs(resp.logs);
    } catch (e) {
      store.addLogs([`网络检查失败: ${e}`]);
    } finally {
      setRunningAction(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="mtga-soft-panel space-y-3 mb-4">
        <div>
          <div className="text-sm font-semibold text-slate-900">运行时选项</div>
          <div className="text-xs text-slate-500">控制代理运行行为与调试细节</div>
        </div>
        <div className="space-y-3">
          <label className="flex items-center gap-3 text-sm text-slate-700 cursor-pointer hover:bg-slate-100/50 rounded px-3 py-2 -my-1 transition-colors">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={debugMode}
              onChange={(e) => setDebugMode(e.target.checked)}
            />
            <span>开启调试模式</span>
          </label>
          <label className="flex items-center gap-3 text-sm text-slate-700 cursor-pointer hover:bg-slate-100/50 rounded px-3 py-2 -my-1 transition-colors">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={disableSslStrict}
              onChange={(e) => setDisableSslStrict(e.target.checked)}
            />
            <span>关闭SSL严格模式</span>
          </label>
          <div className="flex flex-wrap items-center gap-1 text-sm text-slate-700">
            <label className="flex items-center gap-3 cursor-pointer hover:bg-slate-100/50 rounded px-3 py-2 -my-1 transition-colors">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={forceStream}
                onChange={(e) => setForceStream(e.target.checked)}
              />
              <span>强制流模式</span>
            </label>
            <MtgaSelect
              value={streamMode}
              onChange={(val) => setStreamMode(String(val))}
              options={["true", "false"]}
              size="xs"
              disabled={!forceStream}
            />
          </div>
        </div>
      </div>

      <div className="mtga-soft-panel space-y-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">代理服务</div>
          <div className="text-xs text-slate-500">启动 / 停止 / 网络检查</div>
        </div>
        <div className="space-y-2">
          <button
            className={`mtga-btn-primary ${runningAction === "start" ? "loading" : ""}`}
            disabled={!!runningAction}
            onClick={handleStart}
          >
            启动代理服务器
          </button>
          <button
            className={`mtga-btn-error ${runningAction === "stop" ? "loading" : ""}`}
            disabled={!!runningAction}
            onClick={handleStop}
          >
            停止代理服务器
          </button>
          <button
            className={`mtga-btn-outline ${runningAction === "check" ? "loading" : ""}`}
            disabled={!!runningAction}
            onClick={handleCheck}
          >
            检查网络环境
          </button>
        </div>
      </div>
    </div>
  );
}
