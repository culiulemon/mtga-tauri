import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  defaultKeymap,
  history,
  historyField,
  historyKeymap,
  redo,
  redoDepth,
  undo,
  undoDepth,
} from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { MergeView } from "@codemirror/merge";
import { type Extension, EditorState } from "@codemirror/state";
import {
  closeSearchPanel,
  openSearchPanel,
  search,
  searchKeymap,
  searchPanelOpen,
} from "@codemirror/search";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import MtgaDialog from "@/components/ui/MtgaDialog";
import { useMtgaStore } from "@/hooks/useMtgaStore";
import type { SystemPromptItem } from "@/types/mtgaTypes";

interface SystemPromptEditorDialogProps {
  open: boolean;
  item: SystemPromptItem | null;
  onClose: () => void;
  onSaved: () => void;
}

const stateFields = { history: historyField };

const editorTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "13px", backgroundColor: "#ffffff" },
  ".cm-editor": { height: "100%" },
  ".cm-scroller": {
    height: "100%",
    overflow: "auto",
    lineHeight: "1.65",
    fontFamily:
      "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace",
  },
  ".cm-gutters": { backgroundColor: "#f8fafc", color: "#64748b", borderRight: "1px solid #e2e8f0" },
  ".cm-activeLine": { backgroundColor: "#f8fafc" },
  ".cm-activeLineGutter": { backgroundColor: "#f1f5f9" },
  ".cm-content": { caretColor: "#0f172a" },
  ".cm-selectionBackground, ::selection": { backgroundColor: "#fcd34d66" },
  ".cm-search": { borderBottom: "1px solid #e2e8f0", backgroundColor: "#fffaf0" },
  ".cm-keyword": { color: "#b45309" },
  ".cm-strong": { color: "#0f172a", fontWeight: "700" },
  ".cm-emphasis": { color: "#7c2d12", fontStyle: "italic" },
  ".cm-link": { color: "#0369a1", textDecoration: "underline" },
  ".cm-url": { color: "#0284c7" },
  ".cm-string": { color: "#166534" },
  ".cm-quote": { color: "#475569" },
  ".cm-heading": { color: "#1d4ed8", fontWeight: "700" },
  ".cm-comment": { color: "#64748b" },
});

export default function SystemPromptEditorDialog({
  open,
  item,
  onClose,
  onSaved,
}: SystemPromptEditorDialogProps) {
  const store = useMtgaStore();
  const editorHostRef = useRef<HTMLDivElement>(null);
  const mergeHostRef = useRef<HTMLDivElement>(null);
  const editorSurfaceRef = useRef<HTMLDivElement>(null);

  const [draftText, setDraftText] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mergeHeaderTemplate, setMergeHeaderTemplate] = useState(
    "minmax(0, 1fr) minmax(0, 1fr)",
  );

  const singleViewRef = useRef<EditorView | null>(null);
  const diffViewRef = useRef<MergeView | null>(null);
  const editableStateSnapshotRef = useRef<unknown>(null);
  const editableScrollRef = useRef({ top: 0, left: 0 });
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mergeObserverRef = useRef<ResizeObserver | null>(null);
  const mergeRafRef = useRef(0);
  const mountRevisionRef = useRef(0);
  const diffSwitchingRef = useRef(false);
  const pendingDiffModeRef = useRef<boolean | null>(null);

  const originalText = item?.original_text ?? "";
  const effectiveText = item?.latest_delta?.edited_text ?? item?.original_text ?? "";
  const isDirty = draftText !== effectiveText;
  const charCount = draftText.length;
  const lineCount = draftText.split("\n").length;

  const createdAtLabel = useMemo(() => {
    const raw = item?.created_at ?? "";
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;
    return date.toLocaleString("zh-CN", { hour12: false });
  }, [item?.created_at]);

  const editedAtLabel = useMemo(() => {
    const raw = item?.latest_delta?.edited_at ?? "";
    if (!raw) return "";
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;
    return date.toLocaleString("zh-CN", { hour12: false });
  }, [item?.latest_delta?.edited_at]);

  const getActiveEditableView = useCallback(
    () => diffViewRef.current?.b ?? singleViewRef.current,
    [],
  );

  const getActiveScrollElement = useCallback(
    () => diffViewRef.current?.dom ?? singleViewRef.current?.scrollDOM ?? null,
    [],
  );

  const refreshHistoryState = useCallback((state?: EditorState) => {
    if (!state) {
      setCanUndo(false);
      setCanRedo(false);
      return;
    }
    setCanUndo(undoDepth(state) > 0);
    setCanRedo(redoDepth(state) > 0);
  }, []);

  const createEditableExtensions = useCallback(() => {
    const updateListener = EditorView.updateListener.of((update) => {
      setDraftText(update.state.doc.toString());
      refreshHistoryState(update.state);
    });
    return [
      markdown(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      lineNumbers(),
      history(),
      search({ top: true }),
      editorTheme,
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      EditorView.lineWrapping,
      updateListener,
    ];
  }, [refreshHistoryState]);

  const createOriginalExtensions = useCallback(
    () => [
      markdown(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      lineNumbers(),
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      editorTheme,
      EditorView.lineWrapping,
    ],
    [],
  );

  const deserializeEditableState = useCallback(
    (extensions: readonly Extension[]) => {
      if (!editableStateSnapshotRef.current) {
        return EditorState.create({ doc: draftText, extensions });
      }
      return EditorState.fromJSON(editableStateSnapshotRef.current, { doc: draftText, extensions }, stateFields);
    },
    [draftText],
  );

  const restoreEditableScroll = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const scrollEl = getActiveScrollElement();
        if (!scrollEl) return;
        scrollEl.scrollTop = editableScrollRef.current.top;
        scrollEl.scrollLeft = editableScrollRef.current.left;
      });
    });
  }, [getActiveScrollElement]);

  const destroyViews = useCallback(() => {
    mergeObserverRef.current?.disconnect();
    mergeObserverRef.current = null;
    if (mergeRafRef.current) {
      cancelAnimationFrame(mergeRafRef.current);
      mergeRafRef.current = 0;
    }
    diffViewRef.current?.destroy();
    diffViewRef.current = null;
    singleViewRef.current?.destroy();
    singleViewRef.current = null;
    setMergeHeaderTemplate("minmax(0, 1fr) minmax(0, 1fr)");
    refreshHistoryState();
  }, [refreshHistoryState]);

  const createSingleView = useCallback(() => {
    if (!editorHostRef.current) return;
    singleViewRef.current = new EditorView({
      state: deserializeEditableState(createEditableExtensions()),
      parent: editorHostRef.current,
    });
    setDraftText(singleViewRef.current.state.doc.toString());
    refreshHistoryState(singleViewRef.current.state);
    restoreEditableScroll();
  }, [createEditableExtensions, deserializeEditableState, refreshHistoryState, restoreEditableScroll]);

  const createDiffView = useCallback(() => {
    if (!mergeHostRef.current) return;
    diffViewRef.current = new MergeView({
      parent: mergeHostRef.current,
      orientation: "a-b",
      gutter: false,
      highlightChanges: true,
      a: { doc: originalText, extensions: createOriginalExtensions() },
      b: { doc: draftText, extensions: createEditableExtensions() },
    });
    if (typeof ResizeObserver !== "undefined") {
      mergeObserverRef.current = new ResizeObserver(() => {
        if (mergeRafRef.current) return;
        mergeRafRef.current = requestAnimationFrame(() => {
          mergeRafRef.current = 0;
          if (!diffViewRef.current) return;
          const editors = diffViewRef.current.dom.querySelectorAll<HTMLElement>(".cm-mergeViewEditor");
          const left = editors.item(0);
          const right = editors.item(1);
          if (left && right && left.clientWidth > 0 && right.clientWidth > 0) {
            setMergeHeaderTemplate(`${left.clientWidth}px ${right.clientWidth}px`);
          }
        });
      });
      mergeObserverRef.current.observe(diffViewRef.current.dom);
    }
    restoreEditableScroll();
  }, [originalText, draftText, createEditableExtensions, createOriginalExtensions, restoreEditableScroll]);

  const captureActiveEditableState = useCallback(
    (includeSnapshot = false) => {
      const activeView = getActiveEditableView();
      if (activeView) {
        setDraftText(activeView.state.doc.toString());
        if (includeSnapshot) {
          editableStateSnapshotRef.current = activeView.state.toJSON(stateFields);
        }
      }
      const scrollEl = getActiveScrollElement();
      if (scrollEl) {
        editableScrollRef.current = { top: scrollEl.scrollTop, left: scrollEl.scrollLeft };
      }
    },
    [getActiveEditableView, getActiveScrollElement],
  );

  const flushActiveEditableInput = useCallback(async () => {
    const activeView = getActiveEditableView();
    if (!activeView) return;
    if (activeView.composing || activeView.hasFocus) {
      activeView.contentDOM.blur();
    }
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }, [getActiveEditableView]);

  const runCommand = useCallback(
    (command: (view: EditorView) => boolean) => {
      const activeView = getActiveEditableView();
      if (!activeView) return false;
      const ok = command(activeView);
      captureActiveEditableState();
      refreshHistoryState(activeView.state);
      activeView.focus();
      return ok;
    },
    [getActiveEditableView, captureActiveEditableState, refreshHistoryState],
  );

  const handleSearch = useCallback(() => {
    const activeView = getActiveEditableView();
    if (!activeView) return;
    const opened = searchPanelOpen(activeView.state);
    runCommand(opened ? closeSearchPanel : openSearchPanel);
  }, [getActiveEditableView, runCommand]);

  const handleUndo = useCallback(async () => {
    await flushActiveEditableInput();
    runCommand(undo);
  }, [flushActiveEditableInput, runCommand]);

  const handleRedo = useCallback(async () => {
    await flushActiveEditableInput();
    runCommand(redo);
  }, [flushActiveEditableInput, runCommand]);

  const handleRestoreOriginal = useCallback(() => {
    const activeView = getActiveEditableView();
    if (!activeView) {
      setDraftText(originalText);
      editableStateSnapshotRef.current = null;
      return;
    }
    activeView.dispatch({
      changes: { from: 0, to: activeView.state.doc.length, insert: originalText },
    });
  }, [getActiveEditableView, originalText]);

  const handleClear = useCallback(() => {
    const activeView = getActiveEditableView();
    if (!activeView) {
      setDraftText("");
      editableStateSnapshotRef.current = null;
      return;
    }
    activeView.dispatch({
      changes: { from: 0, to: activeView.state.doc.length, insert: "" },
    });
  }, [getActiveEditableView]);

  const handleCopyHash = useCallback(async () => {
    const hashValue = item?.hash;
    if (!hashValue || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(hashValue);
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => {
        setCopied(false);
        copiedTimerRef.current = null;
      }, 1400);
    } catch {
      /* ignore */
    }
  }, [item?.hash]);

  const handleSave = useCallback(async () => {
    if (saving || !item) return;
    setSaving(true);
    try {
      await flushActiveEditableInput();
      captureActiveEditableState(true);
      await store.updateSystemPrompt({ hash: item.hash, edited_text: draftText });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }, [saving, item, draftText, flushActiveEditableInput, captureActiveEditableState, store, onSaved, onClose]);

  const handleDiffToggle = useCallback(
    async (checked: boolean) => {
      pendingDiffModeRef.current = checked;
      if (!open || diffSwitchingRef.current) return;
      diffSwitchingRef.current = true;
      try {
        while (pendingDiffModeRef.current !== null) {
          const nextMode = pendingDiffModeRef.current;
          pendingDiffModeRef.current = null;
          if (nextMode === showDiff) continue;
          await flushActiveEditableInput();
          captureActiveEditableState(true);
          setShowDiff(nextMode);
        }
      } finally {
        diffSwitchingRef.current = false;
      }
    },
    [open, showDiff, flushActiveEditableInput, captureActiveEditableState],
  );

  useEffect(() => {
    if (!open) {
      mountRevisionRef.current += 1;
      pendingDiffModeRef.current = null;
      diffSwitchingRef.current = false;
      destroyViews();
      return;
    }
    setDraftText(effectiveText);
    editableStateSnapshotRef.current = null;
    editableScrollRef.current = { top: 0, left: 0 };
    setCopied(false);
    pendingDiffModeRef.current = null;
    diffSwitchingRef.current = false;
    setShowDiff(false);
    setSaving(false);

    const revision = ++mountRevisionRef.current;
    const mount = async () => {
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      if (revision !== mountRevisionRef.current || !open) return;
      createSingleView();
    };
    mount();

    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = null;
      }
      destroyViews();
    };
  }, [open, item?.hash]);

  useEffect(() => {
    if (!open || showDiff) return;
    destroyViews();
    createSingleView();
  }, [showDiff, open, destroyViews, createSingleView]);

  useEffect(() => {
    if (!open || !showDiff) return;
    destroyViews();
    createDiffView();
  }, [showDiff, open, destroyViews, createDiffView]);

  return (
    <MtgaDialog open={open} onClose={onClose} maxWidth="max-w-6xl">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="text-lg font-semibold text-slate-900">系统提示词编辑器</h3>
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-mono text-[11px] text-slate-500">
                {item?.hash || "-"}
              </span>
              <button className="btn btn-ghost btn-xs h-6 min-h-6 px-2" onClick={handleCopyHash}>
                {copied ? "已复制" : "复制"}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="label cursor-pointer gap-2 px-0 py-0">
              <span className="label-text text-xs text-slate-500">Diff</span>
              <input
                type="checkbox"
                className="toggle toggle-xs toggle-warning"
                checked={showDiff}
                onChange={(e) => handleDiffToggle(e.target.checked)}
              />
            </label>
            <span
              className={`rounded-md px-2 py-0.5 text-[11px] ${
                isDirty
                  ? "border border-amber-200 bg-amber-100 text-amber-700"
                  : "border border-emerald-200 bg-emerald-100 text-emerald-700"
              }`}
            >
              {isDirty ? "未保存修改" : "已同步"}
            </span>
          </div>
        </div>
        <div className="flex w-full items-center gap-2 text-[11px] text-slate-400">
          <span className="truncate">创建时间：{createdAtLabel || "-"}</span>
          {editedAtLabel && (
            <span className="ml-auto shrink-0 text-right">编辑时间：{editedAtLabel}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button className="btn btn-xs rounded-lg border-slate-200" onClick={handleSearch}>
            查找/替换面板
          </button>
          <button
            className="btn btn-xs rounded-lg border-slate-200"
            disabled={!canUndo}
            onClick={handleUndo}
          >
            撤销
          </button>
          <button
            className="btn btn-xs rounded-lg border-slate-200"
            disabled={!canRedo}
            onClick={handleRedo}
          >
            重做
          </button>
          <button
            className="btn btn-xs rounded-lg border-slate-200"
            onClick={handleRestoreOriginal}
          >
            恢复原文
          </button>
          <button className="btn btn-xs rounded-lg border-slate-200" onClick={handleClear}>
            清空
          </button>
        </div>
      </div>

      <div
        ref={editorSurfaceRef}
        className="flex h-[68vh] min-h-[480px] flex-col overflow-hidden px-6 py-5"
      >
        {!showDiff ? (
          <div
            ref={editorHostRef}
            className="flex-1 min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white"
          />
        ) : (
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80">
            <div
              className="grid shrink-0 border-b border-slate-200"
              style={{ gridTemplateColumns: mergeHeaderTemplate }}
            >
              <div className="bg-slate-100 px-3 py-2 text-xs text-slate-600">原文</div>
              <div className="border-l border-slate-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                当前编辑稿
              </div>
            </div>
            <div className="mtga-merge-host flex-1 min-h-0 overflow-hidden" ref={mergeHostRef} />
          </div>
        )}
      </div>

      <div className="flex w-full items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          {lineCount} 行 · {charCount} 字符
          <span className="mx-1 text-slate-300">|</span>
          快捷键：Ctrl/Cmd+F 查找，Ctrl/Cmd+Z 撤销
        </div>
        <div className="flex items-center gap-2">
          <button className="mtga-btn-dialog-ghost min-w-24" onClick={onClose}>
            取消
          </button>
          <button
            className={`mtga-btn-dialog-primary min-w-24 ${saving ? "loading" : ""}`}
            disabled={saving}
            onClick={handleSave}
          >
            保存
          </button>
        </div>
      </div>
    </MtgaDialog>
  );
}
