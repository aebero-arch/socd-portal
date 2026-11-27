"use client";

import { useState } from "react";
import { addStaff, editStaff } from "./actions";
import { Dialog, DialogActions, FormError } from "@/components/dialog";
import { useSaveStatus } from "@/lib/form-status";
import { OFFICES, RSSO_OFFICES, PSO_OFFICES, derivePortalRole, type StaffMember, type Office, type PortalRole } from "@/lib/types";

interface Props {
  staff?: StaffMember; // If provided, we are in Edit Mode
  onClose: () => void;
  onSuccess: () => void;
}

export default function StaffModal({ staff, onClose, onSuccess }: Props) {
  const isEdit = !!staff;
  const { busy, error, run } = useSaveStatus();

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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const saved = await run(() => (staff ? editStaff(staff.id, null, formData) : addStaff(null, formData)));
    if (saved) onSuccess();
  }

  return (
    <Dialog
      title={isEdit ? "Edit staff" : "Add staff"}
      onClose={onClose}
      busy={busy}
      onSubmit={handleSubmit}
      footer={<DialogActions onCancel={onClose} busy={busy} label={isEdit ? "Save changes" : "Add staff"} />}
    >
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
            autoFocus
            defaultValue={staff?.name || ""}
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
      </div>

      <FormError message={error} />
    </Dialog>
  );
}
