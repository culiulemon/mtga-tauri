import { useState } from "react";
import { useMtgaStore } from "@/hooks/useMtgaStore";
import { useMtgaApi } from "@/hooks/useMtgaApi";
import MtgaInput from "@/components/ui/MtgaInput";
import ConfirmDialog from "@/components/dialogs/ConfirmDialog";

interface SettingsPanelProps {
  onOpenTheme: () => void;
}

export default function SettingsPanel({ onOpenTheme }: SettingsPanelProps) {
  const store = useMtgaStore();
  const api = useMtgaApi();
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const handleOpen = async () => {
    try {
      const resp = await api.userDataOpenDir();
      if (resp.logs) store.addLogs(resp.logs);
    } catch (e) {
      store.addLogs([`打开目录失败: ${e}`]);
    }
  };

  const handleBackup = async () => {
    try {
      const resp = await api.userDataBackup();
      if (resp.logs) store.addLogs(resp.logs);
    } catch (e) {
      store.addLogs([`备份数据失败: ${e}`]);
    }
  };

  const handleRestore = async () => {
    try {
      const resp = await api.userDataRestoreLatest();
      if (resp.logs) store.addLogs(resp.logs);
    } catch (e) {
      store.addLogs([`还原数据失败: ${e}`]);
    }
  };

  const handleClear = async () => {
    try {
      const resp = await api.userDataClear();
      if (resp.logs) store.addLogs(resp.logs);
    } catch (e) {
      store.addLogs([`清除数据失败: ${e}`]);
    }
    setClearConfirmOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="mtga-card-title">应用设置</h2>
          <p className="mtga-card-subtitle">管理数据与系统配置</p>
        </div>
        <span className="mtga-chip">系统</span>
      </div>
      <div className="mt-4 space-y-4">
        <div className="mtga-soft-panel space-y-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">外观主题</div>
            <div className="text-xs text-slate-500">自定义配色、字体与背景</div>
          </div>
          <button className="mtga-btn-primary" onClick={onOpenTheme}>
            主题设置
          </button>
        </div>
        <div className="mtga-soft-panel space-y-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">用户数据</div>
            <div className="text-xs text-slate-500">备份与恢复历史数据</div>
          </div>
          <div className="space-y-2">
            <button className="mtga-btn-outline" onClick={handleOpen}>
              打开目录
            </button>
            <button className="mtga-btn-primary" onClick={handleBackup}>
              备份数据
            </button>
            <button className="mtga-btn-outline" onClick={handleRestore}>
              还原数据
            </button>
            <button className="mtga-btn-error" onClick={() => setClearConfirmOpen(true)}>
              清除数据
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        title="确认清除数据"
        message="确定要清除用户数据吗？该操作将删除配置文件、SSL 证书和 hosts 备份（历史 backups 保留）。"
        confirmText="确认清除"
        type="error"
        onConfirm={handleClear}
      />
    </div>
  );
}
