"use client";

import { useEffect, type ReactNode } from "react";
import { AlertCircle, Loader2, X } from "lucide-react";

const WIDTH = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
} as const;

/**
 * The one dialog shell. Pages keep a single `dialog` value and render
 * `<Dialog>` for whichever one is open. While `busy`, it can't be closed.
 * With `onSubmit`, the panel is a <form> and Enter submits it.
 */
export function Dialog({
  title,
  onClose,
  busy = false,
  onSubmit,
  footer,
  size = "md",
  stacked = false,
  children,
}: {
  title: ReactNode;
  onClose: () => void;
  busy?: boolean;
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  footer?: ReactNode;
  size?: keyof typeof WIDTH;
  /** Opens above another dialog. */
  stacked?: boolean;
  children: ReactNode;
}) {
  // Escape closes the top dialog only: a stacked dialog listens in the capture
  // phase, so it runs first and marks the key as handled.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      if (!busy) onClose();
    }
    window.addEventListener("keydown", onKey, stacked);
    return () => window.removeEventListener("keydown", onKey, stacked);
  }, [busy, onClose, stacked]);

  const panel = `relative z-10 w-full ${WIDTH[size]} bg-surface border border-border shadow-2xl rounded-xl flex flex-col max-h-[90vh]`;
  const content = (
    <>
      <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-4 border-b border-border">
        <h3 className="font-display font-semibold text-base text-ink truncate">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="p-1 text-ink-400 hover:text-ink rounded-md disabled:opacity-40"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>
      <div className="px-6 py-4 space-y-4 overflow-y-auto">{children}</div>
      {footer && <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">{footer}</div>}
    </>
  );

  return (
    <div className={`fixed inset-0 ${stacked ? "z-[60]" : "z-50"} flex items-center justify-center p-4`} role="dialog" aria-modal="true">
      <div
        className={`absolute inset-0 ${stacked ? "bg-ink-900/40" : "bg-ink-900/60 backdrop-blur-sm"}`}
        onClick={busy ? undefined : onClose}
      />
      {onSubmit ? (
        <form onSubmit={onSubmit} className={panel}>
          {content}
        </form>
      ) : (
        <div className={panel}>{content}</div>
      )}
    </div>
  );
}

/** Cancel + primary button for a dialog footer. */
export function DialogActions({
  onCancel,
  busy = false,
  label,
  busyLabel = "Saving…",
  disabled = false,
  onConfirm,
  cancelLabel = "Cancel",
}: {
  onCancel: () => void;
  busy?: boolean;
  label: string;
  busyLabel?: string;
  disabled?: boolean;
  /** Omit inside a form: the button then submits it. */
  onConfirm?: () => void;
  cancelLabel?: string;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="px-3 py-1.5 text-xs font-mono text-ink-400 border border-border rounded-md hover:text-ink disabled:opacity-50"
      >
        {cancelLabel}
      </button>
      <button
        type={onConfirm ? "button" : "submit"}
        onClick={onConfirm}
        disabled={busy || disabled}
        className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-accent text-white text-xs font-mono rounded-md hover:bg-accent-600 disabled:opacity-60"
      >
        {busy && <Loader2 size={13} className="animate-spin" />}
        {busy ? busyLabel : label}
      </button>
    </>
  );
}

/** The error line shown when a form's status is `failed`. */
export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg">
      <AlertCircle size={14} className="shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}

/** Which add/edit dialog a page has open: none (null), a new item, or an existing one. */
export type EditDialog<T> = null | { kind: "new" } | { kind: "edit"; item: T };
