import { useState } from "react";
import { useMtgaStore } from "@/hooks/useMtgaStore";
import { useMtgaApi } from "@/hooks/useMtgaApi";

export default function FooterActions() {
  const store = useMtgaStore();
  const api = useMtgaApi();
  const [startAllPending, setStartAllPending] = useState(false);

  const handleStartAll = async () => {
    if (startAllPending) return;
    setStartAllPending(true);
    try {
      const resp = await api.proxyStartAll({
        debugMode: false,
        disableSslStrictMode: false,
        forceStream: false,
      });
      if (resp.logs) store.addLogs(resp.logs);
      if (resp.ok) store.setProxyRunning(true);
    } catch (e) {
      store.addLogs([`一键启动失败: ${e}`]);
    } finally {
      setStartAllPending(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <div className="text-sm font-semibold text-slate-900">快速操作</div>
        <div className="text-xs text-slate-500">一键启动会依次检查网络、证书与 hosts 配置</div>
      </div>
      <button
        className="btn btn-primary px-8 rounded-xl shadow-[0_12px_25px_-10px_rgba(240,187,50,0.6)]"
        disabled={startAllPending}
        onClick={handleStartAll}
      >
        {startAllPending && <span className="loading loading-spinner loading-sm" />}
        一键启动全部服务
      </button>
    </div>
  );
}
