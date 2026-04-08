import { useMtgaStore } from "@/hooks/useMtgaStore";
import { useMtgaApi } from "@/hooks/useMtgaApi";

export default function HostsTab() {
  const store = useMtgaStore();
  const api = useMtgaApi();

  const handleModify = async () => {
    try {
      const resp = await api.hostsModify("add");
      if (resp.logs) store.addLogs(resp.logs);
    } catch (e) {
      store.addLogs([`hosts 修改失败: ${e}`]);
    }
  };

  const handleBackup = async () => {
    try {
      const resp = await api.hostsModify("backup");
      if (resp.logs) store.addLogs(resp.logs);
    } catch (e) {
      store.addLogs([`hosts 备份失败: ${e}`]);
    }
  };

  const handleRestore = async () => {
    try {
      const resp = await api.hostsModify("restore");
      if (resp.logs) store.addLogs(resp.logs);
    } catch (e) {
      store.addLogs([`hosts 还原失败: ${e}`]);
    }
  };

  const handleOpen = async () => {
    try {
      const resp = await api.hostsOpen();
      if (resp.logs) store.addLogs(resp.logs);
    } catch (e) {
      store.addLogs([`打开 hosts 失败: ${e}`]);
    }
  };

  return (
    <div className="mtga-soft-panel space-y-3">
      <div>
        <div className="text-sm font-semibold text-slate-900">hosts 文件</div>
        <div className="text-xs text-slate-500">快速修改与备份恢复</div>
      </div>
      <div className="space-y-2">
        <button className="mtga-btn-primary" onClick={handleModify}>
          修改hosts文件
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button className="mtga-btn-outline" onClick={handleBackup}>
            备份hosts
          </button>
          <button className="mtga-btn-outline" onClick={handleRestore}>
            还原hosts
          </button>
        </div>
        <button className="mtga-btn-outline" onClick={handleOpen}>
          打开hosts文件
        </button>
      </div>
    </div>
  );
}
