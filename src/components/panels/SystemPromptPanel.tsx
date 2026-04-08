import { useState, useEffect } from "react";
import { useMtgaStore } from "@/hooks/useMtgaStore";
import { useMtgaApi } from "@/hooks/useMtgaApi";
import { useSystemPromptUi } from "@/hooks/systemPromptUi";
import ConfirmDialog from "@/components/dialogs/ConfirmDialog";
import SystemPromptEditorDialog from "@/components/dialogs/SystemPromptEditorDialog";
import type { SystemPromptItem } from "@/types/mtgaTypes";

export default function SystemPromptPanel() {
  const store = useMtgaStore();
  const api = useMtgaApi();
  const { getTimeDisplay } = useSystemPromptUi();
  const [loading, setLoading] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedHashes, setSelectedHashes] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteHashes, setPendingDeleteHashes] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<SystemPromptItem | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const sortedItems = [...store.systemPrompts];

  const refreshList = async () => {
    setLoading(true);
    try {
      await store.fetchSystemPrompts();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshList();
  }, []);

  const toggleSelect = (hash: string) => {
    setSelectedHashes((prev) => {
      const next = new Set(prev);
      if (next.has(hash)) next.delete(hash);
      else next.add(hash);
      return next;
    });
  };

  const selectAll = () => {
    if (sortedItems.every((item) => selectedHashes.has(item.hash))) {
      setSelectedHashes(new Set());
    } else {
      setSelectedHashes(new Set(sortedItems.map((item) => item.hash)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedHashes.size === 0) return;
    setPendingDeleteHashes(Array.from(selectedHashes));
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    setDeleteConfirmOpen(false);
    try {
      const resp = await api.systemPromptsDelete(pendingDeleteHashes);
      if (resp.logs) store.addLogs(resp.logs);
      setSelectedHashes(new Set());
      await refreshList();
    } catch (e) {
      store.addLogs([`删除失败: ${e}`]);
    }
  };

  const handleItemClick = (item: SystemPromptItem) => {
    if (deleteMode) {
      toggleSelect(item.hash);
      return;
    }
    setEditingItem(item);
    setEditorOpen(true);
  };

  const handleEditorSaved = async () => {
    setEditorOpen(false);
    setEditingItem(null);
    await refreshList();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="mtga-card-title">系统提示词</h2>
          <p className="mtga-card-subtitle">收录系统提示词哈希记录并支持增量编辑</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-sm btn-outline rounded-xl border-rose-200 text-rose-600 hover:border-rose-300 hover:bg-rose-50"
            disabled={loading || (!deleteMode && sortedItems.length === 0)}
            onClick={() => setDeleteMode(!deleteMode)}
          >
            {deleteMode ? "退出删除" : "删除"}
          </button>
          <button
            className={`btn btn-sm btn-outline rounded-xl border-slate-200 hover:border-amber-500 hover:bg-amber-50/50 hover:text-amber-600 ${loading ? "loading" : ""}`}
            disabled={loading}
            onClick={refreshList}
          >
            刷新
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {deleteMode && sortedItems.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-50/80 rounded-xl border border-slate-200/60 sticky top-0 z-10">
            <input
              type="checkbox"
              className="checkbox checkbox-xs rounded border-slate-300"
              checked={sortedItems.length > 0 && sortedItems.every((item) => selectedHashes.has(item.hash))}
              onChange={selectAll}
            />
            <span className="text-xs text-slate-500 font-medium flex-1">
              已选择 {selectedHashes.size} 条记录
            </span>
            <button
              className="btn btn-ghost btn-xs h-7 min-h-7 rounded-lg text-rose-600 hover:bg-rose-50 px-2 font-medium"
              disabled={selectedHashes.size === 0}
              onClick={handleDeleteSelected}
            >
              批量删除
            </button>
          </div>
        )}

        {sortedItems.length === 0 && !loading ? (
          <div className="rounded-xl border border-slate-200/70 bg-white/40 p-6 text-center text-sm text-slate-400">
            暂无系统提示词记录
          </div>
        ) : (
          sortedItems.map((item) => (
            <div
              key={item.hash}
              className={`flex items-center gap-3 px-4 py-2.5 bg-white/20 hover:bg-white/40 rounded-xl border border-slate-200/40 transition-all duration-200 cursor-pointer`}
              onClick={() => handleItemClick(item)}
            >
              {deleteMode && (
                <input
                  type="checkbox"
                  className="checkbox checkbox-xs rounded border-slate-300 cursor-pointer"
                  checked={selectedHashes.has(item.hash)}
                />
              )}
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="font-mono text-xs text-slate-700 break-all leading-relaxed">
                  {item.hash}
                </span>
                <span className="text-[10px] text-slate-400">
                  创建时间：{getTimeDisplay(item.last_modified)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title={pendingDeleteHashes.length > 1 ? "批量删除记录" : "删除记录"}
        message={`确认删除所选 ${pendingDeleteHashes.length} 条记录？此操作不可恢复。`}
        confirmText="删除"
        type="error"
        onConfirm={confirmDelete}
      />

      <SystemPromptEditorDialog
        open={editorOpen}
        item={editingItem}
        onClose={() => {
          setEditorOpen(false);
          setEditingItem(null);
        }}
        onSaved={handleEditorSaved}
      />
    </div>
  );
}
