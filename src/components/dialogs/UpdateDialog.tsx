import DOMPurify from "dompurify";
import MtgaDialog from "@/components/ui/MtgaDialog";

interface UpdateDialogProps {
  open: boolean;
  onClose: () => void;
  versionLabel?: string;
  notesHtml?: string;
  releaseUrl?: string;
  onOpenRelease: () => void;
}

export default function UpdateDialog({
  open,
  onClose,
  versionLabel,
  notesHtml,
  releaseUrl,
  onOpenRelease,
}: UpdateDialogProps) {
  const sanitizedNotes = DOMPurify.sanitize(notesHtml || "", {
    WHOLE_DOCUMENT: true,
  });

  const handleNotesClick = async (e: React.MouseEvent) => {
    const anchor = (e.target as HTMLElement).closest("a");
    if (!anchor || !anchor.getAttribute("href")) return;
    e.preventDefault();
    const href = anchor.getAttribute("href")!;
    const url = /^https?:\/\//i.test(href)
      ? href
      : releaseUrl
        ? new URL(href, releaseUrl).toString()
        : href;
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(url);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <MtgaDialog
      open={open}
      onClose={onClose}
      maxWidth="max-w-md"
      header={
        <div className="flex items-center justify-between bg-white/50">
          <h3 className="mtga-card-title text-lg">发现新版本</h3>
          {versionLabel && (
            <div className="mtga-chip bg-amber-50 border-amber-200 text-amber-700 font-medium">
              {versionLabel}
            </div>
          )}
        </div>
      }
      footer={
        <div className="flex justify-center w-full">
          <button
            className="mtga-btn-dialog-primary w-full max-w-xs"
            disabled={!releaseUrl}
            onClick={onOpenRelease}
          >
            前往发布页
          </button>
        </div>
      }
    >
      <div className="px-6 py-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
          更新日志
        </div>
        <div
          className="mtga-soft-panel bg-slate-50/40 max-h-[260px] overflow-y-auto p-4"
          onClick={handleNotesClick}
        >
          {sanitizedNotes ? (
            <div
              className="text-sm text-slate-600 leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1 [&_a]:text-amber-600 [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-amber-700"
              dangerouslySetInnerHTML={{ __html: sanitizedNotes }}
            />
          ) : (
            <div className="text-sm text-slate-400 italic py-6 text-center">
              该版本暂无更新说明。
            </div>
          )}
        </div>
      </div>
    </MtgaDialog>
  );
}
