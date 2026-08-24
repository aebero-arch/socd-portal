"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, Search, ExternalLink, Globe, FileText, Database, Link2 } from "lucide-react";
import type { PortalRole } from "@/lib/types";
import type { DivisionLink } from "./page";
import { addLink, editLink, deleteLink } from "./actions";

interface LinksClientProps {
  initialLinks: DivisionLink[];
  userRole: PortalRole | null;
}

const CATEGORIES = [
  { name: "ALL", label: "All Resources", icon: Globe },
  { name: "PSA Systems", label: "PSA Systems", icon: Globe },
  { name: "Databases & Registries", label: "Databases & Registries", icon: Database },
  { name: "Forms & Guidelines", label: "Forms & Guidelines", icon: FileText },
  { name: "Others", label: "Others", icon: Link2 },
];

export default function LinksClient({ initialLinks, userRole }: LinksClientProps) {
  const [links, setLinks] = useState<DivisionLink[]>(initialLinks);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<DivisionLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSuperAdmin = userRole === "SuperAdmin";

  // Filter links
  const filteredLinks = links.filter((l) => {
    const matchesSearch =
      l.label.toLowerCase().includes(search.toLowerCase()) ||
      (l.description && l.description.toLowerCase().includes(search.toLowerCase())) ||
      l.url.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory = selectedCategory === "ALL" || l.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const handleOpenAddModal = () => {
    setEditingLink(null);
    setError(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (link: DivisionLink) => {
    setEditingLink(link);
    setError(null);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this link?")) return;
    
    const res = await deleteLink(id);
    if (res.success) {
      setLinks(links.filter((l) => l.id !== id));
    } else {
      alert(res.error || "Failed to delete link");
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    
    let res;
    if (editingLink) {
      res = await editLink(editingLink.id, null, formData);
    } else {
      res = await addLink(null, formData);
    }

    setLoading(false);
    if (res.success) {
      // Reload page state or update state locally
      // For simple local updates:
      const updatedList = await fetch("/api/links").then((r) => r.json());
      setLinks(updatedList);
      setModalOpen(false);
    } else {
      setError(res.error || "Something went wrong.");
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "PSA Systems":
        return "bg-sky-50 text-sky-700 border-sky-200/50";
      case "Databases & Registries":
        return "bg-indigo-50 text-indigo-700 border-indigo-200/50";
      case "Forms & Guidelines":
        return "bg-emerald-50 text-emerald-700 border-emerald-200/50";
      default:
        return "bg-ink-50 text-ink-700 border-ink-100/50";
    }
  };

  return (
    <div>
      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            placeholder="Search links and resources..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-lg text-sm focus:border-accent focus:outline-none transition-all placeholder:text-ink-400"
          />
        </div>

        {isSuperAdmin && (
          <button
            onClick={handleOpenAddModal}
            className="flex items-center justify-center gap-2 bg-accent hover:bg-accent-600 text-white font-medium rounded-lg text-sm px-4 py-2 transition-colors cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
          >
            <Plus size={16} />
            <span>Add Resource Link</span>
          </button>
        )}
      </div>

      {/* Category Filter Chips */}
      <div className="flex flex-wrap items-center gap-2 mb-8 border-b border-border pb-5">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = selectedCategory === cat.name;
          return (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(cat.name)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                isActive
                  ? "bg-accent border-accent text-white shadow-[0_2px_8px_-2px_rgba(31,138,131,0.3)]"
                  : "bg-surface border-border text-ink-400 hover:text-ink hover:border-ink-400/50"
              }`}
            >
              <Icon size={12} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Links Cards Grid */}
      {filteredLinks.length === 0 ? (
        <div className="tick-corners bg-surface border border-border rounded-lg p-12 text-center">
          <Link2 size={32} className="mx-auto text-ink-400/40 mb-3" />
          <h3 className="font-display font-semibold text-sm text-ink">No resources found</h3>
          <p className="text-xs text-ink-400 mt-1 max-w-sm mx-auto">
            Try adjusting your search query or selecting a different category of resources.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredLinks.map((link) => (
            <div
              key={link.id}
              className="tick-corners group bg-surface border border-border rounded-lg p-5 flex flex-col justify-between hover:border-accent/40 hover:shadow-[0_4px_20px_-4px_rgba(19,33,59,0.08)] transition-all"
            >
              <div>
                <div className="flex justify-between items-start gap-4 mb-3">
                  <span
                    className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border ${getCategoryColor(
                      link.category
                    )}`}
                  >
                    {link.category}
                  </span>
                  
                  {isSuperAdmin && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenEditModal(link)}
                        className="p-1 text-ink-400 hover:text-accent rounded hover:bg-ink-50 transition-colors"
                        title="Edit link"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(link.id)}
                        className="p-1 text-ink-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                        title="Delete link"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>

                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-display font-semibold text-sm text-ink group-hover:text-accent hover:underline mb-1 transition-colors"
                >
                  <span>{link.label}</span>
                  <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
                </a>

                <p className="text-xs text-ink-400 line-clamp-3 leading-relaxed mt-1">
                  {link.description || "No description provided."}
                </p>
              </div>

              <div className="border-t border-border mt-4 pt-3 flex justify-between items-center text-[10px] text-ink-400/60 font-mono">
                <span className="truncate max-w-[200px]" title={link.url}>
                  {link.url.replace(/^https?:\/\/(www\.)?/, "")}
                </span>
                <span>
                  {new Date(link.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-ink-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border bg-ink-50 flex items-center justify-between">
              <h2 className="font-display font-semibold text-sm text-ink">
                {editingLink ? "Edit Resource Link" : "Add Resource Link"}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-ink-400 hover:text-ink cursor-pointer text-xs"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 text-red-700 text-xs px-3.5 py-2.5 rounded-lg border border-red-200/50">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-ink-700 uppercase tracking-wider mb-1.5">
                  Link Title / Label
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  defaultValue={editingLink?.label || ""}
                  placeholder="e.g. PSA Data Archive"
                  className="w-full bg-surface border border-border rounded-lg text-sm px-3 py-2 focus:border-accent focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 uppercase tracking-wider mb-1.5">
                  URL
                </label>
                <input
                  type="url"
                  name="url"
                  required
                  defaultValue={editingLink?.url || ""}
                  placeholder="https://example.gov.ph"
                  className="w-full bg-surface border border-border rounded-lg text-sm px-3 py-2 focus:border-accent focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 uppercase tracking-wider mb-1.5">
                  Category
                </label>
                <select
                  name="category"
                  required
                  defaultValue={editingLink?.category || "PSA Systems"}
                  className="w-full bg-surface border border-border rounded-lg text-sm px-3 py-2 focus:border-accent focus:outline-none transition-all"
                >
                  <option value="PSA Systems">PSA Systems</option>
                  <option value="Databases & Registries">Databases & Registries</option>
                  <option value="Forms & Guidelines">Forms & Guidelines</option>
                  <option value="Others">Others</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={editingLink?.description || ""}
                  placeholder="Brief summary of what this link is for..."
                  className="w-full bg-surface border border-border rounded-lg text-sm px-3 py-2 focus:border-accent focus:outline-none transition-all resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-border hover:bg-ink-50 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-accent hover:bg-accent-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  {loading ? "Saving..." : editingLink ? "Save Changes" : "Create Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
