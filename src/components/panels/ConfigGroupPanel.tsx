import { useState, useCallback } from "react";
import { useMtgaStore } from "@/hooks/useMtgaStore";
import { useMtgaApi } from "@/hooks/useMtgaApi";
import ConfigGroupEditorDialog from "@/components/dialogs/ConfigGroupEditorDialog";
import ConfirmDialog from "@/components/dialogs/ConfirmDialog";
import type { ConfigGroup } from "@/types/mtgaTypes";

export default function ConfigGroupPanel() {
  const store = useMtgaStore();
  const api = useMtgaApi();

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"add" | "edit">("add");
  const [editingGroup, setEditingGroup] = useState<ConfigGroup | undefined>();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [testingIndex, setTestingIndex] = useState<number | null>(null);

  const configGroups = store.config.config_groups;

  const existingNames = configGroups.map((g) => g.name ?? "").filter(Boolean);

  const handleAdd = useCallback(() => {
    setEditorMode("add");
    setEditingGroup(undefined);
    setSelectedIndex(null);
    setEditorOpen(true);
  }, []);

  const handleEdit = useCallback(() => {
    if (selectedIndex === null || selectedIndex >= configGroups.length) return;
    setEditorMode("edit");
    setEditingGroup(configGroups[selectedIndex]);
    setEditorOpen(true);
  }, [selectedIndex, configGroups]);

  const handleDelete = useCallback(() => {
    if (selectedIndex === null || selectedIndex >= configGroups.length) return;
    setDeleteConfirmOpen(true);
  }, [selectedIndex, configGroups]);

  const confirmDelete = useCallback(() => {
    if (selectedIndex !== null && selectedIndex < configGroups.length) {
      const newGroups = configGroups.filter((_, i) => i !== selectedIndex);
      store.updateConfig({ config_groups: newGroups });
      store.saveConfig();
      store.addLogs([`已删除配置组: ${configGroups[selectedIndex].name ?? selectedIndex + 1}`]);
    }
    setSelectedIndex(null);
    setDeleteConfirmOpen(false);
  }, [selectedIndex, configGroups, store]);

  const handleSave = useCallback(
    (group: ConfigGroup) => {
      let newGroups: ConfigGroup[];
      if (editorMode === "add") {
        newGroups = [...configGroups, group];
        store.addLogs([`已添加配置组: ${group.name}`]);
      } else if (selectedIndex !== null && selectedIndex < configGroups.length) {
        newGroups = configGroups.map((g, i) => (i === selectedIndex ? group : g));
        store.addLogs([`已修改配置组: ${group.name}`]);
      } else {
        newGroups = configGroups;
      }
      store.updateConfig({ config_groups: newGroups });
      store.saveConfig();
      setEditorOpen(false);
      setSelectedIndex(null);
    },
    [editorMode, selectedIndex, configGroups, store],
  );

  const handleMoveUp = useCallback(() => {
    if (selectedIndex === null || selectedIndex <= 0) return;
    const newGroups = [...configGroups];
    [newGroups[selectedIndex - 1], newGroups[selectedIndex]] = [
      newGroups[selectedIndex],
      newGroups[selectedIndex - 1],
    ];
    store.updateConfig({ config_groups: newGroups });
    store.saveConfig();
    setSelectedIndex(selectedIndex - 1);
  }, [selectedIndex, configGroups, store]);

  const handleMoveDown = useCallback(() => {
    if (selectedIndex === null || selectedIndex >= configGroups.length - 1) return;
    const newGroups = [...configGroups];
    [newGroups[selectedIndex], newGroups[selectedIndex + 1]] = [
      newGroups[selectedIndex + 1],
      newGroups[selectedIndex],
    ];
    store.updateConfig({ config_groups: newGroups });
    store.saveConfig();
    setSelectedIndex(selectedIndex + 1);
  }, [selectedIndex, configGroups, store]);

  const handleTest = useCallback(async () => {
    if (selectedIndex === null || selectedIndex >= configGroups.length) return;
    setTestingIndex(selectedIndex);
    try {
      const resp = await api.configGroupTest(selectedIndex);
      if (resp.logs) store.addLogs(resp.logs);
      store.addLogs([
        resp.ok
          ? `配置组 [${configGroups[selectedIndex].name ?? selectedIndex + 1}] 测活成功`
          : `配置组 [${configGroups[selectedIndex].name ?? selectedIndex + 1}] 测活失败: ${resp.message}`,
      ]);
    } catch (e) {
      store.addLogs([`测活失败: ${e}`]);
    } finally {
      setTestingIndex(null);
    }
  }, [selectedIndex, configGroups, store, api]);

  const handleRefresh = useCallback(async () => {
    try {
      await store.loadConfig();
      store.addLogs(["配置已刷新"]);
    } catch {
      store.addLogs(["刷新配置失败"]);
    }
  }, [store]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="mtga-card-title">代理服务器配置组</h2>
          <p className="mtga-card-subtitle">管理模型路由与鉴权组合</p>
        </div>
        <button className="mtga-btn-outline text-xs" onClick={handleRefresh}>
          刷新
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr,180px]">
        <div className="min-w-0 rounded-xl border border-slate-200/70 bg-white/50 backdrop-blur-md overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1 max-h-[260px]">
            <table className="table table-sm w-full text-sm border-separate border-spacing-0">
              <thead className="sticky top-0 z-10 bg-slate-50/70 backdrop-blur-md">
                <tr className="h-[38px]">
                  <th className="w-16 text-center border-b border-slate-200/60">序号</th>
                  <th className="min-w-[60px] border-b border-slate-200/60">名称</th>
                  <th className="min-w-[100px] border-b border-slate-200/60">提供商</th>
                  <th className="min-w-[140px] border-b border-slate-200/60">API URL</th>
                  <th className="min-w-[120px] border-b border-slate-200/60">实际模型ID</th>
                </tr>
              </thead>
              <tbody>
                {configGroups.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm text-slate-400">
                      暂无配置组，点击"新增"按钮添加
                    </td>
                  </tr>
                ) : (
                  configGroups.map((group, index) => (
                    <tr
                      key={index}
                      className={`cursor-pointer transition-colors h-9 ${
                        selectedIndex === index
                          ? "bg-amber-100/50 border-l-4 border-l-amber-400"
                          : "hover:bg-amber-100/30 border-l-4 border-l-transparent"
                      }`}
                      onClick={() => setSelectedIndex(index)}
                    >
                      <td className="w-16 text-center text-slate-600">{index + 1}</td>
                      <td className="truncate max-w-[128px] text-slate-700">
                        {group.name || `配置组 ${index + 1}`}
                      </td>
                      <td className="truncate max-w-[170px] text-slate-700">{group.provider}</td>
                      <td className="truncate max-w-[200px] text-slate-700">
                        {group.api_url || "(未填写)"}
                      </td>
                      <td className="truncate max-w-[150px] text-slate-700">
                        {group.model_id || "(未填写)"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2">
          <button className="mtga-btn-primary w-full" onClick={handleAdd}>
            新增
          </button>
          <button
            className="mtga-btn-outline w-full"
            disabled={selectedIndex === null}
            onClick={handleEdit}
          >
            修改
          </button>
          <button
            className="mtga-btn-error w-full"
            disabled={selectedIndex === null}
            onClick={handleDelete}
          >
            删除
          </button>
          <div className="divider my-1" />
          <button
            className="mtga-btn-outline w-full text-xs"
            disabled={selectedIndex === null || selectedIndex === 0}
            onClick={handleMoveUp}
          >
            ↑ 上移
          </button>
          <button
            className="mtga-btn-outline w-full text-xs"
            disabled={selectedIndex === null || selectedIndex >= configGroups.length - 1}
            onClick={handleMoveDown}
          >
            ↓ 下移
          </button>
          <div className="divider my-1" />
          <button
            className={`mtga-btn-outline w-full text-xs ${testingIndex === selectedIndex ? "loading" : ""}`}
            disabled={selectedIndex === null}
            onClick={handleTest}
          >
            测活
          </button>
        </div>
      </div>

      <ConfigGroupEditorDialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
        mode={editorMode}
        initialData={editingGroup}
        existingNames={
          editorMode === "add"
            ? existingNames
            : existingNames.filter((_, i) => i !== selectedIndex)
        }
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
        type="error"
        title="确认删除"
        message={`确定要删除配置组「${selectedIndex !== null ? configGroups[selectedIndex]?.name ?? `#${selectedIndex + 1}` : ""}」吗？此操作不可撤销。`}
      />
    </div>
  );
}
