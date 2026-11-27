"use client";

import { useState } from "react";
import { Edit2, Loader2, Megaphone, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogActions, FormError, type EditDialog } from "@/components/dialog";
import { useSaveStatus } from "@/lib/form-status";
import type { Announcement, AnnouncementInput, PortalRole } from "@/lib/types";
import { saveAnnouncement, deleteAnnouncement } from "./actions";
import AnnouncementCard from "./announcement-card";

const REGIONAL_OFFICES = ["ORD", "CRASD", "SOCD"];
const PROVINCES = ["Davao del Norte", "Davao del Sur", "Davao Oriental", "Davao de Oro", "Davao Occidental"];

function sortAnnouncements(list: Announcement[]) {
  return [...list].sort((a, b) =>
    a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : b.created_at.localeCompare(a.created_at)
  );
}

export default function CommsClient({
  initialAnnouncements,
  userRole,
}: {
  initialAnnouncements: Announcement[];
  userRole: PortalRole | null;
}) {
  const canManage = userRole === "SuperAdmin" || userRole === "RSSO";
  const [items, setItems] = useState<Announcement[]>(initialAnnouncements);
  const [dialog, setDialog] = useState<EditDialog<Announcement>>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(a: Announcement) {
    if (!confirm(`Delete "${a.title}"? This can't be undone.`)) return;
    setDeletingId(a.id);
    const res = await deleteAnnouncement(a.id);
    setDeletingId(null);
    if (!res.success) {
      alert(res.error || "Could not delete the announcement.");
      return;
    }
    setItems((prev) => prev.filter((x) => x.id !== a.id));
  }

  return (
    <div className="space-y-5">
      {canManage && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setDialog({ kind: "new" })}
            className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-600 text-white text-xs font-mono rounded-md transition-colors cursor-pointer"
          >
            <Plus size={14} /> New announcement
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl bg-surface p-12 text-center">
          <Megaphone size={30} className="mx-auto text-ink-400/30 mb-3" />
          <p className="text-sm text-ink">No announcements yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <AnnouncementCard
              key={a.id}
              announcement={a}
              actions={
                canManage ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setDialog({ kind: "edit", item: a })}
                      className="p-1.5 text-ink-400 hover:text-ink rounded-md"
                      title="Edit"
                      aria-label={`Edit ${a.title}`}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(a)}
                      disabled={deletingId === a.id}
                      className="p-1.5 text-ink-400 hover:text-red-600 rounded-md disabled:opacity-50"
                      title="Delete"
                      aria-label={`Delete ${a.title}`}
                    >
                      {deletingId === a.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </>
                ) : undefined
              }
            />
          ))}
        </div>
      )}

      {dialog && (
        <AnnouncementForm
          existing={dialog.kind === "edit" ? dialog.item : null}
          onClose={() => setDialog(null)}
          onSaved={(saved) => {
            setItems((prev) => sortAnnouncements([...prev.filter((x) => x.id !== saved.id), saved]));
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}

function AnnouncementForm({
  existing,
  onClose,
  onSaved,
}: {
  existing: Announcement | null;
  onClose: () => void;
  onSaved: (a: Announcement) => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [linkUrl, setLinkUrl] = useState(existing?.link_url ?? "");
  const [pinned, setPinned] = useState(existing?.pinned ?? false);
  const [everyone, setEveryone] = useState((existing?.audience.length ?? 0) === 0);
  const [offices, setOffices] = useState<string[]>(existing?.audience ?? []);
  const { busy: saving, error, run, fail } = useSaveStatus();

  function toggleOffice(office: string) {
    setOffices((prev) => (prev.includes(office) ? prev.filter((o) => o !== office) : [...prev, office]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return fail("Please fill in the title and the message.");
    if (!everyone && offices.length === 0) return fail("Choose at least one office, or send it to everyone.");
    const input: AnnouncementInput = {
      title: title.trim(),
      body: body.trim(),
      audience: everyone ? [] : offices,
      link_url: linkUrl.trim() || null,
      pinned,
    };
    const res = await run(() => saveAnnouncement(existing?.id ?? null, input), "Could not save the announcement.");
    if (res?.data) onSaved(res.data);
  }

  const inputCls =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/20";
  const labelCls = "block font-mono text-[10px] uppercase tracking-wider text-ink-400 mb-1";

  const officeBox = (office: string) => (
    <label key={office} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
      <input
        type="checkbox"
        className="h-4 w-4 accent-accent"
        checked={offices.includes(office)}
        onChange={() => toggleOffice(office)}
        disabled={saving}
      />
      {office}
    </label>
  );

  return (
    <Dialog
      title={existing ? "Edit announcement" : "New announcement"}
      onClose={onClose}
      busy={saving}
      onSubmit={handleSubmit}
      footer={<DialogActions onCancel={onClose} busy={saving} label={existing ? "Save changes" : "Post announcement"} />}
    >
      <div>
        <label className={labelCls} htmlFor="ann-title">Title</label>
        <input
          id="ann-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          required
          autoFocus
          disabled={saving}
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls} htmlFor="ann-body">Message</label>
        <textarea
          id="ann-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={5000}
          rows={6}
          required
          disabled={saving}
          className={`${inputCls} resize-y`}
        />
        <p className="mt-1 text-right font-mono text-[10px] text-ink-400">{body.length} / 5000</p>
      </div>

      <fieldset>
        <legend className={labelCls}>Who should see it</legend>
        <div className="flex flex-wrap gap-4 text-sm text-ink">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" className="accent-accent" checked={everyone} onChange={() => setEveryone(true)} disabled={saving} />
            Everyone
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" className="accent-accent" checked={!everyone} onChange={() => setEveryone(false)} disabled={saving} />
            Selected offices
          </label>
        </div>
        {!everyone && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 rounded-md border border-border p-3">
            <div className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink-400">Regional office</p>
              {REGIONAL_OFFICES.map(officeBox)}
            </div>
            <div className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink-400">Provinces</p>
              {PROVINCES.map(officeBox)}
            </div>
          </div>
        )}
      </fieldset>

      <div>
        <label className={labelCls} htmlFor="ann-link">Link (optional)</label>
        <input
          id="ann-link"
          type="url"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="https://"
          disabled={saving}
          className={inputCls}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
        <input type="checkbox" className="h-4 w-4 accent-accent" checked={pinned} onChange={(e) => setPinned(e.target.checked)} disabled={saving} />
        Pin to the top
      </label>

      <FormError message={error} />
    </Dialog>
  );
}
