"use client";

import { useActionState, useEffect, useRef } from "react";
import { X, UserPlus, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { addStaff, type AddStaffState } from "./staff-actions";
import { OFFICES } from "@/lib/types";

const STATUS_OPTIONS = [
  { value: "in-office", label: "In Office" },
  { value: "wfh", label: "Work from Home" },
  { value: "on-leave", label: "On Leave" },
  { value: "fieldwork", label: "Fieldwork" },
];

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddStaffModal({ onClose, onSuccess }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, isPending] = useActionState(
    async (prev: AddStaffState | null, formData: FormData) => {
      return await addStaff(prev, formData);
    },
    null
  );

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      // Notify parent to re-fetch after a short delay
      const t = setTimeout(() => onSuccess(), 1500);
      return () => clearTimeout(t);
    }
  }, [state, onSuccess]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg bg-surface border border-border shadow-2xl tick-corners">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
              SYS_OP // NEW_ENROLLMENT
            </p>
            <h2 id="modal-title" className="font-display font-semibold text-lg text-ink mt-0.5">
              Add Staff Member
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-ink-400 hover:text-ink transition-colors p-1 rounded cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form ref={formRef} action={formAction} className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Name + Email side-by-side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-400">
                Full Name <span className="text-warm">*</span>
              </label>
              <input
                type="text"
                name="name"
                required
                placeholder="Juan Dela Cruz"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-ink-400/50 focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-400">
                Email Address <span className="text-warm">*</span>
              </label>
              <input
                type="email"
                name="email"
                required
                placeholder="j.delacruz@psa.gov.ph"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-ink-400/50 focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
              />
            </div>
          </div>

          {/* Position / Role */}
          <div className="space-y-1">
            <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-400">
              Position / Role <span className="text-warm">*</span>
            </label>
            <input
              type="text"
              name="role"
              required
              placeholder="e.g. Statistician III, Division Chief"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-ink-400/50 focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
            />
          </div>

          {/* Office / Province */}
          <div className="space-y-1">
            <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-400">
              Office / Province <span className="text-warm">*</span>
            </label>
            <select
              name="office"
              required
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all cursor-pointer"
            >
              <option value="">— Select office/province —</option>
              {OFFICES.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          {/* Contact Number with Area Code */}
          <div className="space-y-1">
            <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-400">
              Contact Number <span className="text-ink-400/50">(optional)</span>
            </label>
            <div className="flex gap-2">
              <select
                name="area_code"
                defaultValue="+63"
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all cursor-pointer shrink-0"
              >
                <option value="+63">PH (+63)</option>
                <option value="+1">US (+1)</option>
                <option value="+65">SG (+65)</option>
              </select>
              <input
                type="tel"
                name="contact_no"
                placeholder="9171234567"
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-ink-400/50 focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
              />
            </div>
            <p className="text-[10px] text-ink-400/60 font-body">Enter the 10-digit number (excluding the leading 0, e.g. 9171234567)</p>
          </div>

          {/* Create Account Toggle */}
          <div className="border border-border rounded-md p-4 bg-accent-50/30">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                name="create_account"
                defaultChecked
                className="mt-0.5 accent-accent w-4 h-4 cursor-pointer"
              />
              <div>
                <p className="text-sm font-medium text-ink group-hover:text-accent transition-colors">
                  Send portal invite email
                </p>
                <p className="text-xs text-ink-400 mt-0.5 leading-relaxed">
                  Sends an invitation link to this email address so the staff member can set their password and log in to the portal.
                </p>
              </div>
            </label>
          </div>

          {/* Status Messages */}
          {state?.error && (
            <div className="flex items-start gap-2 bg-red-50 border-l-2 border-red-500 p-3 text-xs text-red-700">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{state.error}</span>
            </div>
          )}
          {state?.success && state.message && (
            <div className="flex items-start gap-2 bg-accent-50 border-l-2 border-accent p-3 text-xs text-accent-600">
              <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
              <span>{state.message}</span>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-mono text-ink-400 hover:text-ink border border-border rounded-md transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form={formRef.current?.id}
            onClick={() => formRef.current?.requestSubmit()}
            disabled={isPending || state?.success === true}
            className="flex items-center gap-2 px-5 py-2 bg-ink hover:bg-ink-700 disabled:bg-ink-400 text-white text-sm font-mono rounded-md transition-colors cursor-pointer shadow-sm"
          >
            {isPending ? (
              <><Loader2 size={14} className="animate-spin" /> Processing…</>
            ) : state?.success ? (
              <><CheckCircle2 size={14} /> Added!</>
            ) : (
              <><UserPlus size={14} /> Add Staff Member</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
