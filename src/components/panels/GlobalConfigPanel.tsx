import { useState } from "react";
import { useMtgaStore } from "@/hooks/useMtgaStore";
import MtgaInput from "@/components/ui/MtgaInput";

export default function GlobalConfigPanel() {
  const store = useMtgaStore();
  const [saving, setSaving] = useState(false);

  const globalConfig = store.config.global_config;

  const handleSave = async () => {
    if (!globalConfig.mapped_model_id || !globalConfig.mtga_auth_key) {
      store.addLogs(["错误: 映射模型ID和MTGA鉴权Key都是必填项"]);
      return;
    }
    setSaving(true);
    try {
      await store.saveConfig();
      store.addLogs(["全局配置已保存"]);
    } catch {
      store.addLogs(["保存全局配置失败"]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="mtga-card-title">全局配置</h2>
          <p className="mtga-card-subtitle">管理映射模型与鉴权信息</p>
        </div>
        <span className="mtga-chip">全局参数</span>
      </div>
      <div className="mt-4 space-y-4">
        <div className="mtga-soft-panel space-y-4">
          <MtgaInput
            value={globalConfig.mapped_model_id}
            onChange={(val) =>
              store.updateGlobalConfig({ ...globalConfig, mapped_model_id: val })
            }
            label="映射模型ID"
            placeholder="例如：gpt-5"
            required
          />
          <MtgaInput
            value={globalConfig.mtga_auth_key}
            onChange={(val) =>
              store.updateGlobalConfig({ ...globalConfig, mtga_auth_key: val })
            }
            label="MTGA鉴权Key"
            placeholder="例如：111"
            type="password"
            required
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">保存后会同步所有配置组</span>
          <button
            className="btn btn-primary btn-sm px-4 rounded-xl"
            disabled={saving}
            onClick={handleSave}
          >
            保存全局配置
          </button>
        </div>
      </div>
    </div>
  );
}
