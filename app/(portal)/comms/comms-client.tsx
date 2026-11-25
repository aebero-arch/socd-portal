"use client";

import { useState } from "react";
import { AlertCircle, Edit2, Loader2, Megaphone, Plus, Trash2, X } from "lucide-react";
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
  const [editing, setEditing] = useState<Announcement | "new" | null>(null);
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
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink-400">
            <span className="font-mono text-ink font-semibold">{items.length}</span>{" "}
            announcement{items.length !== 1 ? "s" : ""}
          </p>
          <button
            type="button"
            onClick={() => setEditing("new")}
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
          {canManage && (
            <p className="text-xs text-ink-400 mt-1">Post one with “New announcement”.</p>
          )}
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
                      onClick={() => setEditing(a)}
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

      {editing && (
        <AnnouncementForm
          existing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setItems((prev) => sortAnnouncements([...prev.filter((x) => x.id !== saved.id), saved]));
            setEditing(null);
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleOffice(office: string) {
    setOffices((prev) => (prev.includes(office) ? prev.filter((o) => o !== office) : [...prev, office]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !body.trim()) {
      setError("Please fill in the title and the message.");
      return;
    }
    if (!everyone && offices.length === 0) {
      setError("Choose at least one office, or send it to everyone.");
      return;
    }
    const input: AnnouncementInput = {
      title: title.trim(),
      body: body.trim(),
      audience: everyone ? [] : offices,
      link_url: linkUrl.trim() || null,
      pinned,
    };
    setSaving(true);
    const res = await saveAnnouncement(existing?.id ?? null, input);
    setSaving(false);
    if (!res.success || !res.data) {
      setError(res.error || "Could not save the announcement.");
      return;
    }
    onSaved(res.data);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm" onClick={saving ? undefined : onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-xl bg-surface border border-border shadow-2xl rounded-xl flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
          <h3 className="font-display font-semibold text-base text-ink">
            {existing ? "Edit announcement" : "New announcement"}
          </h3>
          <button type="button" onClick={onClose} disabled={saving} className="p-1 text-ink-400 hover:text-ink rounded-md" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto">
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
                <p className="sm:col-span-2 text-[11px] text-ink-400">
                  SuperAdmin and RSSO accounts see every announcement.
                </p>
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

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button type="button" onClick={onClose} disabled={saving} className="px-3 py-1.5 text-xs font-mono text-ink-400 border border-border rounded-md">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-accent text-white text-xs font-mono rounded-md hover:bg-accent-600 disabled:opacity-60"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            {saving ? "Saving…" : existing ? "Save changes" : "Post announcement"}
          </button>
        </div>
      </form>
    </div>
  );
}
