import { useState } from "react";
import { useMtgaStore } from "@/hooks/useMtgaStore";
import { useMtgaApi } from "@/hooks/useMtgaApi";
import ConfirmDialog from "@/components/dialogs/ConfirmDialog";
import MtgaInput from "@/components/ui/MtgaInput";

export default function CertTab() {
  const store = useMtgaStore();
  const api = useMtgaApi();
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [inputCommonName, setInputCommonName] = useState("MTGA_CA");
  const [showInputError, setShowInputError] = useState(false);

  const handleGenerate = async () => {
    try {
      const resp = await api.generateCertificates();
      if (resp.logs) store.addLogs(resp.logs);
    } catch (e) {
      store.addLogs([`证书生成失败: ${e}`]);
    }
  };

  const handleInstall = async () => {
    try {
      const resp = await api.installCaCert();
      if (resp.logs) store.addLogs(resp.logs);
    } catch (e) {
      store.addLogs([`CA 证书安装失败: ${e}`]);
    }
  };

  const handleClear = () => {
    setInputCommonName(store.appInfo?.ca_common_name || "MTGA_CA");
    setShowInputError(false);
    setClearConfirmOpen(true);
  };

  const confirmClear = async () => {
    if (!inputCommonName.trim()) {
      setShowInputError(true);
      return;
    }
    setClearConfirmOpen(false);
    try {
      const resp = await api.clearCaCert(inputCommonName);
      if (resp.logs) store.addLogs(resp.logs);
    } catch (e) {
      store.addLogs([`清除 CA 证书失败: ${e}`]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="mtga-soft-panel space-y-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">证书管理</div>
          <div className="text-xs text-slate-500">生成、安装与清理本地证书</div>
        </div>
        <div className="space-y-2">
          <button className="mtga-btn-primary" onClick={handleGenerate}>
            生成CA和服务器证书
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button className="mtga-btn-primary" onClick={handleInstall}>
              安装CA证书
            </button>
            <button className="mtga-btn-error" onClick={handleClear}>
              清除系统CA证书
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        title="确认清除 CA 证书"
        type="error"
        confirmText="确认清除"
        onConfirm={confirmClear}
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            将从系统信任存储中删除匹配的 CA 证书，是否继续？
          </p>
          <MtgaInput
            value={inputCommonName}
            onChange={setInputCommonName}
            label="Common Name:"
            placeholder="请输入证书 Common Name"
            error={showInputError ? "请输入有效的 Common Name" : ""}
            inputClass="font-mono"
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
