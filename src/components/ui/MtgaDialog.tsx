import { useEffect, useRef, useCallback, type ReactNode } from "react";

interface MtgaDialogProps {
  open: boolean;
  onClose: () => void;
  maxWidth?: string;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export default function MtgaDialog({
  open,
  onClose,
  maxWidth = "max-w-sm",
  closeOnBackdrop = true,
  closeOnEsc = true,
  header,
  footer,
  children,
}: MtgaDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const requestClose = useCallback(() => {
    if (!open) return;
    onClose();
  }, [open, onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!closeOnEsc) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        e.preventDefault();
        requestClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeOnEsc, open, requestClose]);

  return (
    <dialog
      ref={dialogRef}
      className={`modal ${open ? "modal-open" : ""}`}
      onClick={(e) => {
        if (closeOnBackdrop && e.target === dialogRef.current) {
          requestClose();
        }
      }}
    >
      <div
        className={`modal-box mtga-card p-0 overflow-hidden border-slate-200/60 shadow-2xl transition-all duration-200 ${maxWidth} ${
          open ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <div className="mtga-card-body p-0 flex flex-col">
          {header && (
            <div className="px-6 py-5 border-b border-slate-100/50">{header}</div>
          )}
          <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
          {footer && (
            <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center gap-3">
              {footer}
            </div>
          )}
        </div>
      </div>
      {open && (
        <div
          className="modal-backdrop bg-slate-900/20 backdrop-blur-[2px] transition-opacity duration-200 opacity-100"
          onClick={() => {
            if (closeOnBackdrop) requestClose();
          }}
        />
      )}
    </dialog>
  );
}
