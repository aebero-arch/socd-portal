"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Phone, Mail, UserPlus, Download, Pencil, Trash2, Loader2 } from "lucide-react";
import type { StaffMember, Office } from "@/lib/types";
import { OFFICES } from "@/lib/types";
import StaffModal from "./staff-modal";
import { updateStaffStatus, deleteStaff } from "./actions";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      title={`Copy ${text}`}
      className="ml-2 text-ink-400 hover:text-accent transition-colors shrink-0 cursor-pointer"
    >
      {copied ? (
        <Check size={13} className="text-accent" />
      ) : (
        <Copy size={13} />
      )}
    </button>
  );
}

interface ContactRowProps {
  staff: StaffMember;
  onEdit: (staff: StaffMember) => void;
}

function ContactRow({ staff, onEdit }: ContactRowProps) {
  const [status, setStatus] = useState(staff.status);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as any;
    setStatus(newStatus);
    setIsUpdating(true);
    const result = await updateStaffStatus(staff.id, newStatus);
    setIsUpdating(false);
    if (!result.success) {
      alert(result.error || "Failed to update status");
      setStatus(staff.status); // revert
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to remove ${staff.name} from the directory?`)) {
      setIsDeleting(true);
      const result = await deleteStaff(staff.id);
      setIsDeleting(false);
      if (result.success) {
        router.refresh();
      } else {
        alert(result.error || "Failed to delete staff member");
      }
    }
  };

  return (
    <tr className={`group border-b border-border last:border-0 hover:bg-accent-50/30 transition-colors ${isDeleting ? "opacity-50 pointer-events-none" : ""}`}>
      <td className="py-3 pl-4 pr-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-ink text-white flex items-center justify-center text-[11px] font-mono shrink-0">
            {staff.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)}
          </div>
          <div>
            <p className="text-sm font-medium text-ink leading-tight">{staff.name}</p>
            <p className="text-xs text-ink-400 leading-tight mt-0.5">{staff.role}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-4 hidden md:table-cell">
        <span className="font-mono text-[10px] uppercase tracking-wide text-ink-400 border border-border px-2 py-0.5 rounded">
          {staff.office || staff.unit}
        </span>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center">
          <a
            href={`mailto:${staff.email}`}
            className="text-sm text-accent hover:text-accent-600 hover:underline font-body truncate max-w-[200px]"
          >
            {staff.email}
          </a>
          <CopyButton text={staff.email} />
        </div>
      </td>
      <td className="py-3 px-4 hidden lg:table-cell">
        {staff.local_ext ? (
          <div className="flex items-center gap-1.5">
            <Phone size={12} className="text-ink-400 shrink-0" />
            <span className="font-mono text-sm text-ink-400">{staff.local_ext}</span>
          </div>
        ) : (
          <span className="text-ink-400/40 text-xs font-mono">—</span>
        )}
      </td>
      <td className="py-3 px-4">
        <select
          value={status}
          onChange={handleStatusChange}
          disabled={isUpdating}
          className={`rounded px-2.5 py-1 text-xs font-mono border focus:outline-none transition-all cursor-pointer ${
            status === "in-office" ? "bg-accent-50 border-accent/20 text-accent-600" :
            status === "wfh" ? "bg-warm-50 border-warm/20 text-warm" :
            status === "fieldwork" ? "bg-blue-50 border-blue-200 text-blue-600" :
            "bg-ink-50 border-ink-100 text-ink-400"
          }`}
        >
          <option value="in-office">In Office</option>
          <option value="wfh">WFH</option>
          <option value="fieldwork">Fieldwork</option>
          <option value="on-leave">On Leave</option>
        </select>
      </td>
      <td className="py-3 px-4 pr-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(staff)}
            title="Edit Staff Member"
            className="p-1 text-ink-400 hover:text-accent hover:bg-accent-50/50 rounded transition-colors cursor-pointer"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={handleDelete}
            title="Delete Staff Member"
            disabled={isDeleting}
            className="p-1 text-ink-400 hover:text-red-500 hover:bg-red-50/50 rounded transition-colors cursor-pointer disabled:opacity-50"
          >
            {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        </div>
      </td>
    </tr>
  );
}

const OFFICE_LABELS: Record<Office, { code: string; label: string }> = {
  "ORD": { code: "00", label: "ORD" },
  "CRASD": { code: "01", label: "CRASD" },
  "SOCD": { code: "02", label: "SOCD" },
  "Davao del Norte": { code: "03", label: "Davao del Norte" },
  "Davao del Sur": { code: "04", label: "Davao del Sur" },
  "Davao Oriental": { code: "05", label: "Davao Oriental" },
  "Davao de Oro": { code: "06", label: "Davao de Oro" },
  "Davao Occidental": { code: "07", label: "Davao Occidental" },
};

export default function PersonnelDirectoryClient({ staff }: { staff: StaffMember[] }) {
  const [activeOffice, setActiveOffice] = useState<Office | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | undefined>(undefined);
  const router = useRouter();

  const filtered = staff.filter((s) => {
    const matchesOffice =
      activeOffice === "ALL" || s.office === activeOffice;
    const matchesSearch =
      search === "" ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      s.role.toLowerCase().includes(search.toLowerCase()) ||
      (s.office || "").toLowerCase().includes(search.toLowerCase()) ||
      s.unit.toLowerCase().includes(search.toLowerCase());
    return matchesOffice && matchesSearch;
  });

  const countByOffice = (office: Office | "ALL") =>
    office === "ALL"
      ? staff.length
      : staff.filter((s) => s.office === office).length;

  // Export to Excel / CSV
  const handleExport = () => {
    const headers = ["Name", "Position", "Office/Province", "Email Address", "Contact Number", "Status"];
    const rows = filtered.map((s) => [
      s.name,
      s.role,
      s.office || s.unit,
      s.email,
      s.local_ext || "",
      s.status,
    ]);

    // Build CSV content
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((val) => `"${val.replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    // Download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `personnel_directory_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEditClick = (member: StaffMember) => {
    setEditingStaff(member);
    setModalOpen(true);
  };

  const handleAddClick = () => {
    setEditingStaff(undefined);
    setModalOpen(true);
  };

  return (
    <div>
      {modalOpen && (
        <StaffModal
          staff={editingStaff}
          onClose={() => {
            setModalOpen(false);
            setEditingStaff(undefined);
          }}
          onSuccess={() => {
            setModalOpen(false);
            setEditingStaff(undefined);
            router.refresh();
          }}
        />
      )}

      {/* Toolbar (Search + Export + Add) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        {/* Search */}
        <div className="relative w-full sm:max-w-sm">
          <Mail
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search directory by name, role, or email…"
            className="w-full rounded-md border border-border bg-background pl-9 pr-3 py-2 text-sm placeholder:text-ink-400/60 focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all text-ink"
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={handleExport}
            className="flex items-center justify-center gap-2 px-4 py-2 border border-border bg-surface text-ink-400 hover:text-accent hover:border-accent text-xs font-mono uppercase tracking-wide rounded-md transition-all cursor-pointer shadow-sm w-full sm:w-auto"
          >
            <Download size={14} />
            Export Directory
          </button>
          <button
            onClick={handleAddClick}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-ink hover:bg-ink-700 text-white text-xs font-mono uppercase tracking-wide rounded-md transition-colors shadow-sm cursor-pointer w-full sm:w-auto shrink-0"
          >
            <UserPlus size={14} />
            Add Staff
          </button>
        </div>
      </div>

      {/* Office Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveOffice("ALL")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wide transition-all cursor-pointer ${
            activeOffice === "ALL"
              ? "bg-ink text-white"
              : "border border-border text-ink-400 hover:border-accent hover:text-ink"
          }`}
        >
          All
          <span
            className={`text-[10px] rounded-full px-1.5 py-0.5 font-mono ${
              activeOffice === "ALL"
                ? "bg-white/20 text-white"
                : "bg-ink-50 text-ink-400"
            }`}
          >
            {countByOffice("ALL")}
          </span>
        </button>

        {OFFICES.map((office) => {
          const count = countByOffice(office);
          const info = OFFICE_LABELS[office];
          return (
            <button
              key={office}
              onClick={() => setActiveOffice(office)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wide transition-all cursor-pointer ${
                activeOffice === office
                  ? "bg-ink text-white"
                  : "border border-border text-ink-400 hover:border-accent hover:text-ink"
              }`}
            >
              <span className="text-[9px] opacity-60">{info.code}</span>
              {info.label}
              <span
                className={`text-[10px] rounded-full px-1.5 py-0.5 font-mono ${
                  activeOffice === office
                    ? "bg-white/20 text-white"
                    : "bg-ink-50 text-ink-400"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden bg-surface tick-corners shadow-sm">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-ink-400">
            <Mail size={28} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-mono uppercase tracking-wide">No staff found</p>
            <p className="text-xs mt-1 text-ink-400/60">Try adjusting your search or filter</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-ink-50/50">
                <th className="text-left py-2.5 pl-4 pr-6 font-mono text-[10px] uppercase tracking-widest text-ink-400">
                  Staff Member
                </th>
                <th className="text-left py-2.5 px-4 font-mono text-[10px] uppercase tracking-widest text-ink-400 hidden md:table-cell">
                  Office / Province
                </th>
                <th className="text-left py-2.5 px-4 font-mono text-[10px] uppercase tracking-widest text-ink-400">
                  Email Address
                </th>
                <th className="text-left py-2.5 px-4 font-mono text-[10px] uppercase tracking-widest text-ink-400 hidden lg:table-cell">
                  Contact Number
                </th>
                <th className="text-left py-2.5 px-4 font-mono text-[10px] uppercase tracking-widest text-ink-400">
                  Status
                </th>
                <th className="text-left py-2.5 px-4 pr-6 font-mono text-[10px] uppercase tracking-widest text-ink-400 w-24">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <ContactRow key={s.id} staff={s} onEdit={handleEditClick} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-3 text-right font-mono text-[10px] text-ink-400/60 uppercase tracking-widest">
        {filtered.length} of {staff.length} staff members
      </p>
    </div>
  );
}
