import { type ReactNode } from "react";
import MtgaDialog from "@/components/ui/MtgaDialog";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  type?: "info" | "error";
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  children?: ReactNode;
}

export default function ConfirmDialog({
  open,
  onClose,
  title = "确认操作",
  message,
  type = "info",
  confirmText = "确认",
  cancelText = "取消",
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const isError = type === "error";

  return (
    <MtgaDialog
      open={open}
      onClose={() => {
        onClose();
      }}
      maxWidth="max-w-sm"
      header={
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${isError ? "bg-error/10 text-error" : "bg-primary/10 text-primary"}`}>
            {isError ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8h.01M11 12h1v4h1m8-4a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <h3 className="text-lg font-semibold text-slate-900 leading-none">{title}</h3>
        </div>
      }
      footer={
        <>
          <button className="mtga-btn-dialog-ghost flex-1" onClick={onClose}>
            {cancelText}
          </button>
          <button
            className={`flex-1 ${isError ? "mtga-btn-dialog-error" : "mtga-btn-dialog-primary"}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </>
      }
    >
      <div className="px-6 py-5 space-y-3">
        <div className="text-sm text-slate-600 leading-relaxed">
          {children || message}
        </div>
      </div>
    </MtgaDialog>
  );
}
