import { useEffect, useRef, useState } from "react";
import { useMtgaStore } from "@/hooks/useMtgaStore";
import ConfirmDialog from "@/components/dialogs/ConfirmDialog";

interface LogPanelProps {
  emptyText?: string;
}

export default function LogPanel({ emptyText = "日志输出占位" }: LogPanelProps) {
  const store = useMtgaStore();
  const logBoxRef = useRef<HTMLDivElement>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const tryFormatJsonText = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed === null || typeof parsed !== "object") return null;
      return JSON.stringify(parsed, null, 2);
    } catch {
      return null;
    }
  };

  const formatLogEntry = (entry: string) => {
    const directJson = tryFormatJsonText(entry);
    if (directJson) return directJson;

    const jsonMatches = Array.from(entry.matchAll(/{/g));
    for (const match of jsonMatches) {
      const idx = match.index;
      if (typeof idx !== "number") continue;
      const prefix = entry.slice(0, idx).trimEnd();
      const suffix = entry.slice(idx);
      const formatted = tryFormatJsonText(suffix);
      if (!formatted) continue;
      return prefix ? `${prefix}\n${formatted}` : formatted;
    }

    return entry;
  };

  const formattedLogs = store.logs.length
    ? store.logs.map((entry) => formatLogEntry(entry.text)).join("\n")
    : emptyText;

  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [store.logs.length]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="mtga-card-title">运行日志</h2>
          <p className="mtga-card-subtitle">实时记录后端与操作状态</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-sm btn-outline rounded-xl border-slate-200 hover:border-amber-500 hover:bg-amber-50/50 hover:text-amber-600"
            disabled={store.logs.length === 0}
            onClick={() => setClearConfirmOpen(true)}
          >
            清空
          </button>
          <span className="text-xs text-slate-500">共 {store.logs.length} 条</span>
        </div>
      </div>
      <div
        ref={logBoxRef}
        className="mtga-log-scroll mt-4 flex-1 overflow-auto rounded-xl border border-slate-200/50 bg-slate-500/10 backdrop-blur-md p-4 text-sm font-mono text-slate-700"
      >
        <pre className="whitespace-pre-wrap leading-relaxed">{formattedLogs}</pre>
      </div>

      <ConfirmDialog
        open={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        title="确认清空日志"
        message="确定要清空当前日志吗？"
        confirmText="清空"
        type="error"
        onConfirm={() => {
          store.clearLogs();
          setClearConfirmOpen(false);
        }}
      />
    </div>
  );
}
