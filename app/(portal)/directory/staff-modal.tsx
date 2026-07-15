"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { X, UserPlus, Save, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { addStaff, editStaff, type ActionState } from "./actions";
import { OFFICES, RSSO_OFFICES, PSO_OFFICES, derivePortalRole, type StaffMember, type Office, type PortalRole } from "@/lib/types";

interface Props {
  staff?: StaffMember; // If provided, we are in Edit Mode
  onClose: () => void;
  onSuccess: () => void;
}

export default function StaffModal({ staff, onClose, onSuccess }: Props) {
  const isEdit = !!staff;
  const formRef = useRef<HTMLFormElement>(null);

  // Parse phone number into Area Code and Mobile Number if editing
  let initialAreaCode = "+63";
  let initialContactNo = "";
  if (isEdit && staff?.local_ext) {
    const parts = staff.local_ext.split(" ");
    if (parts.length > 1) {
      initialAreaCode = parts[0];
      initialContactNo = parts[1];
    } else {
      if (staff.local_ext.startsWith("+")) {
        initialAreaCode = staff.local_ext.substring(0, 3);
        initialContactNo = staff.local_ext.substring(3);
      } else {
        initialContactNo = staff.local_ext;
      }
    }
  }

  // Portal role state — auto-derived from office, but overridable
  const [selectedOffice, setSelectedOffice] = useState<Office | "">(staff?.office || "");
  const [portalRole, setPortalRole] = useState<PortalRole | "">(
    staff?.portal_role || ""
  );

  // Auto-derive portal role when office changes
  function handleOfficeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const office = e.target.value as Office | "";
    setSelectedOffice(office);
    if (office) {
      const derived = derivePortalRole(office as Office);
      if (derived) setPortalRole(derived);
    }
  }

  // Selected server action
  const formActionFn = isEdit
    ? async (prev: ActionState | null, formData: FormData) => editStaff(staff.id, prev, formData)
    : addStaff;

  const [state, formAction, isPending] = useActionState(formActionFn, null);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      const t = setTimeout(() => onSuccess(), 1500);
      return () => clearTimeout(t);
    }
  }, [state, onSuccess]);

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

      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-lg bg-surface border border-border shadow-2xl tick-corners">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
              {isEdit ? "SYS_OP // EDIT_RECORD" : "SYS_OP // NEW_ENROLLMENT"}
            </p>
            <h2 id="modal-title" className="font-display font-semibold text-lg text-ink mt-0.5">
              {isEdit ? "Edit Staff Information" : "Add Staff Member"}
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
        <form ref={formRef} action={formAction} className="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Name + Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-400">
                Full Name <span className="text-warm">*</span>
              </label>
              <input
                type="text"
                name="name"
                required
                defaultValue={staff?.name || ""}
                placeholder="Juan Dela Cruz"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-ink-400/50 focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all text-ink font-body"
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
                defaultValue={staff?.email || ""}
                placeholder="j.delacruz@psa.gov.ph"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-ink-400/50 focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all text-ink font-body"
              />
            </div>
          </div>

          {/* Position / Role */}
          <div className="space-y-1">
            <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-400">
              Position / Designation <span className="text-warm">*</span>
            </label>
            <input
              type="text"
              name="role"
              required
              defaultValue={staff?.role || ""}
              placeholder="e.g. Statistician III, Division Chief"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-ink-400/50 focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all text-ink font-body"
            />
          </div>

          {/* Office / Province + Portal Role (side by side) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-400">
                Office / Province <span className="text-warm">*</span>
              </label>
              <select
                name="office"
                required
                value={selectedOffice}
                onChange={handleOfficeChange}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all cursor-pointer font-body"
              >
                <option value="">— Select —</option>
                <optgroup label="RSSO Offices">
                  {RSSO_OFFICES.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </optgroup>
                <optgroup label="PSO Offices (Provinces)">
                  {PSO_OFFICES.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-400">
                Portal Role <span className="text-warm">*</span>
              </label>
              <select
                name="portal_role"
                required
                value={portalRole}
                onChange={(e) => setPortalRole(e.target.value as PortalRole)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all cursor-pointer font-body"
              >
                <option value="">— Select role —</option>
                <option value="SuperAdmin">SuperAdmin (Full control)</option>
                <option value="RSSO">RSSO (Regional office staff)</option>
                <option value="PSO">PSO (Provincial office staff)</option>

              </select>
              <p className="text-[10px] text-ink-400/60 font-body">
                Auto-filled from office. Override if needed.
              </p>
            </div>
          </div>

          {/* Contact Number with Area Code */}
          <div className="space-y-1">
            <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-400">
              Contact Number <span className="text-ink-400/50">(optional)</span>
            </label>
            <div className="flex gap-2">
              <select
                name="area_code"
                defaultValue={initialAreaCode}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all cursor-pointer shrink-0 font-body"
              >
                <option value="+63">PH (+63)</option>
                <option value="+1">US (+1)</option>
                <option value="+65">SG (+65)</option>
              </select>
              <input
                type="tel"
                name="contact_no"
                defaultValue={initialContactNo}
                placeholder="9171234567"
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-ink-400/50 focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all text-ink font-body font-mono"
              />
            </div>
            <p className="text-[10px] text-ink-400/60 font-body">10-digit number, excluding leading 0 (e.g. 9171234567)</p>
          </div>

          {/* Account setup note (Add Mode Only) */}
          {!isEdit && (
            <div className="border border-border rounded-md p-4 bg-accent-50/30">
              <p className="text-sm font-medium text-ink font-body">
                Portal credentials are configured separately
              </p>
              <p className="text-xs text-ink-400 mt-0.5 leading-relaxed font-body">
                Adding a directory record does not send an email or create a password. Provision login credentials through the administrator setup process.
              </p>
            </div>
          )}

          {/* Status Messages */}
          {state?.error && (
            <div className="flex items-start gap-2 bg-red-50 border-l-2 border-red-500 p-3 text-xs text-red-700 font-body">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{state.error}</span>
            </div>
          )}
          {state?.success && state.message && (
            <div className="flex items-start gap-2 bg-accent-50 border-l-2 border-accent p-3 text-xs text-accent-600 font-body">
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
              <><CheckCircle2 size={14} /> Done!</>
            ) : isEdit ? (
              <><Save size={14} /> Save Changes</>
            ) : (
              <><UserPlus size={14} /> Add Staff Member</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
