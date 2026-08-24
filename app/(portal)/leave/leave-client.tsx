"use client";

import { useState } from "react";
import {
  Calendar,
  List,
  Check,
  X,
  UserCheck,
  CalendarDays,
  Plus,
  Trash2,
  AlertCircle,
  Briefcase,
  Home as HomeIcon,
  ChevronLeft,
  ChevronRight,
  Filter
} from "lucide-react";
import type { PortalRole, StaffMember } from "@/lib/types";
import type { LeaveRequest } from "./page";
import { addLeave, updateLeaveStatus, deleteLeave } from "./actions";

interface LeaveClientProps {
  staffList: StaffMember[];
  initialLeaves: LeaveRequest[];
  currentUser: { id: string; name: string; email: string; portal_role: PortalRole } | null;
}

type TabType = "status" | "calendar" | "requests";

const LEAVE_TYPES = [
  { value: "vacation", label: "Vacation Leave", color: "bg-emerald-500 text-emerald-800 bg-emerald-50 border-emerald-200" },
  { value: "sick", label: "Sick Leave", color: "bg-red-500 text-red-800 bg-red-50 border-red-200" },
  { value: "emergency", label: "Emergency Leave", color: "bg-amber-500 text-amber-800 bg-amber-50 border-amber-200" },
  { value: "official-business", label: "Official Business", color: "bg-blue-500 text-blue-800 bg-blue-50 border-blue-200" },
  { value: "wfh", label: "WFH Schedule", color: "bg-purple-500 text-purple-800 bg-purple-50 border-purple-200" },
  { value: "fieldwork", label: "Fieldwork Schedule", color: "bg-sky-500 text-sky-800 bg-sky-50 border-sky-200" },
];

export default function LeaveClient({ staffList, initialLeaves, currentUser }: LeaveClientProps) {
  const [leaves, setLeaves] = useState<LeaveRequest[]>(initialLeaves);
  const [activeTab, setActiveTab] = useState<TabType>("status");

  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());

  // Filters
  const [filterStaff, setFilterStaff] = useState("ALL");
  const [filterType, setFilterType] = useState("ALL");

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSuperAdmin = currentUser?.portal_role === "SuperAdmin";
  const todayStr = new Date().toISOString().split("T")[0];

  // Helper to sync local leaves list from backend
  const refreshLeaves = async () => {
    const res = await fetch("/api/leaves");
    if (res.ok) {
      const data = await res.json();
      setLeaves(data);
    }
  };

  // Get active status today
  const staffStatusToday = staffList.map((s) => {
    // Find if there is an approved leave request for today
    const activeRequest = leaves.find(
      (l) =>
        l.staff_id === s.id &&
        l.status === "approved" &&
        l.start_date <= todayStr &&
        l.end_date >= todayStr
    );
    return {
      ...s,
      effectiveStatus: activeRequest ? activeRequest.leave_type : "in-office",
      leaveNotes: activeRequest ? activeRequest.notes : null,
    };
  });

  const activeWFHToday = staffStatusToday.filter((s) => s.effectiveStatus === "wfh");
  const activeLeaveToday = staffStatusToday.filter((s) =>
    ["vacation", "sick", "emergency", "official-business"].includes(s.effectiveStatus)
  );
  const activeFieldworkToday = staffStatusToday.filter((s) => s.effectiveStatus === "fieldwork");
  const activeInOfficeToday = staffStatusToday.filter((s) => s.effectiveStatus === "in-office");

  // Filtered requests for the table
  const filteredLeaves = leaves.filter((l) => {
    const matchesStaff = filterStaff === "ALL" || l.staff_id === filterStaff;
    const matchesType = filterType === "ALL" || l.leave_type === filterType;
    return matchesStaff && matchesType;
  });

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);
  const blankDays = Array.from({ length: firstDayIndex }, (_, i) => i);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleOpenAddModal = () => {
    setError(null);
    setModalOpen(true);
  };

  const handleAction = async (id: string, action: "approve" | "deny" | "delete") => {
    if (action === "delete" && !confirm("Are you sure you want to cancel this request?")) return;

    setLoading(true);
    let res;
    if (action === "approve") {
      res = await updateLeaveStatus(id, "approved");
    } else if (action === "deny") {
      res = await updateLeaveStatus(id, "denied");
    } else {
      res = await deleteLeave(id);
    }
    setLoading(false);

    if (res.success) {
      await refreshLeaves();
    } else {
      alert(res.error || "Failed to execute action.");
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const res = await addLeave(null, formData);

    setLoading(false);
    if (res.success) {
      await refreshLeaves();
      setModalOpen(false);
    } else {
      setError(res.error || "Something went wrong.");
    }
  };

  const getLeaveTypeBadge = (type: string) => {
    const found = LEAVE_TYPES.find((t) => t.value === type);
    return found ? (
      <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded border ${found.color.split(" ").slice(1).join(" ")}`}>
        {found.label}
      </span>
    ) : null;
  };

  const getEventBulletColor = (type: string) => {
    switch (type) {
      case "wfh":
        return "bg-purple-500";
      case "fieldwork":
        return "bg-sky-500";
      case "vacation":
        return "bg-emerald-500";
      case "sick":
        return "bg-red-500";
      case "emergency":
        return "bg-amber-500";
      default:
        return "bg-blue-500";
    }
  };

  // Find events for a specific calendar date
  const getEventsForDate = (dayNum: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    return leaves.filter(
      (l) => l.status === "approved" && l.start_date <= dateStr && l.end_date >= dateStr
    );
  };

  return (
    <div>
      {/* Page Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mb-6 border-b border-border">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("status")}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 cursor-pointer transition-all ${activeTab === "status"
                ? "border-accent text-accent"
                : "border-transparent text-ink-400 hover:text-ink"
              }`}
          >
            <UserCheck size={14} />
            <span>Today&apos;s Status</span>
          </button>
          <button
            onClick={() => setActiveTab("calendar")}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 cursor-pointer transition-all ${activeTab === "calendar"
                ? "border-accent text-accent"
                : "border-transparent text-ink-400 hover:text-ink"
              }`}
          >
            <CalendarDays size={14} />
            <span>Month Calendar</span>
          </button>
          <button
            onClick={() => setActiveTab("requests")}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 cursor-pointer transition-all ${activeTab === "requests"
                ? "border-accent text-accent"
                : "border-transparent text-ink-400 hover:text-ink"
              }`}
          >
            <List size={14} />
            <span>Schedule Logs</span>
          </button>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center justify-center gap-2 bg-accent hover:bg-accent-600 text-white font-medium rounded-lg text-sm px-4 py-2 mb-2 transition-colors cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
        >
          <Plus size={16} />
          <span>Book Schedule / Leave</span>
        </button>
      </div>

      {/* TAB 1: TODAY'S STATUS */}
      {activeTab === "status" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* WFH Board */}
            <div className="tick-corners bg-surface border border-border rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                <h3 className="font-display font-semibold text-sm text-ink">Working From Home ({activeWFHToday.length})</h3>
              </div>
              {activeWFHToday.length === 0 ? (
                <p className="text-xs text-ink-400 italic">No one is scheduled for WFH today.</p>
              ) : (
                <div className="space-y-3">
                  {activeWFHToday.map((s) => (
                    <div key={s.id} className="flex flex-col p-3 bg-purple-50/30 border border-purple-100/50 rounded-lg">
                      <span className="font-semibold text-xs text-ink">{s.name}</span>
                      <span className="text-[10px] text-ink-400">{s.role} · {s.office}</span>
                      {s.leaveNotes && <span className="text-[10px] text-purple-700/80 mt-1 italic">&ldquo;{s.leaveNotes}&rdquo;</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Fieldwork Board */}
            <div className="tick-corners bg-surface border border-border rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                <h3 className="font-display font-semibold text-sm text-ink">On Fieldwork ({activeFieldworkToday.length})</h3>
              </div>
              {activeFieldworkToday.length === 0 ? (
                <p className="text-xs text-ink-400 italic">No one is scheduled for fieldwork today.</p>
              ) : (
                <div className="space-y-3">
                  {activeFieldworkToday.map((s) => (
                    <div key={s.id} className="flex flex-col p-3 bg-sky-50/30 border border-sky-100/50 rounded-lg">
                      <span className="font-semibold text-xs text-ink">{s.name}</span>
                      <span className="text-[10px] text-ink-400">{s.role} · {s.office}</span>
                      {s.leaveNotes && <span className="text-[10px] text-sky-700/80 mt-1 italic">&ldquo;{s.leaveNotes}&rdquo;</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Leave Board */}
            <div className="tick-corners bg-surface border border-border rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <h3 className="font-display font-semibold text-sm text-ink">On Leave / OB ({activeLeaveToday.length})</h3>
              </div>
              {activeLeaveToday.length === 0 ? (
                <p className="text-xs text-ink-400 italic">No one is scheduled for leave today.</p>
              ) : (
                <div className="space-y-3">
                  {activeLeaveToday.map((s) => (
                    <div key={s.id} className="flex flex-col p-3 bg-amber-50/30 border border-amber-100/50 rounded-lg">
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-semibold text-xs text-ink">{s.name}</span>
                        <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded">{s.effectiveStatus}</span>
                      </div>
                      <span className="text-[10px] text-ink-400">{s.role} · {s.office}</span>
                      {s.leaveNotes && <span className="text-[10px] text-amber-700/80 mt-1 italic">&ldquo;{s.leaveNotes}&rdquo;</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* In Office list */}
          <div className="tick-corners bg-surface border border-border rounded-lg p-5">
            <h3 className="font-display font-semibold text-sm text-ink mb-4 flex items-center gap-2">
              <UserCheck size={16} className="text-accent" />
              <span>Available In-Office ({activeInOfficeToday.length})</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {activeInOfficeToday.map((s) => (
                <div key={s.id} className="p-3 border border-border rounded-lg flex flex-col hover:border-accent/30 transition-colors">
                  <span className="font-semibold text-xs text-ink">{s.name}</span>
                  <span className="text-[10px] text-ink-400 truncate">{s.role}</span>
                  <span className="text-[9px] text-accent font-mono font-semibold mt-1 uppercase">{s.office}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MONTH CALENDAR */}
      {activeTab === "calendar" && (
        <div className="bg-surface border border-border rounded-lg p-6 tick-corners">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display font-semibold text-base text-ink flex items-center gap-2">
              <span>{monthNames[month]} {year}</span>
            </h3>
            <div className="flex gap-2">
              <button
                onClick={prevMonth}
                className="p-2 border border-border hover:bg-ink-50 rounded-lg text-ink-700 transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={nextMonth}
                className="p-2 border border-border hover:bg-ink-50 rounded-lg text-ink-700 transition-colors cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-7 gap-px bg-border border border-border rounded-lg overflow-hidden">
            {/* Calendar Week Headers */}
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="bg-ink-50 py-2.5 text-center font-mono text-[10px] font-semibold text-ink-400 uppercase">
                {day}
              </div>
            ))}

            {/* Empty cells before month start */}
            {blankDays.map((i) => (
              <div key={`empty-${i}`} className="bg-surface min-h-[100px] p-2 text-ink-100 opacity-30 select-none" />
            ))}

            {/* Actual day cells */}
            {daysArray.map((dayNum) => {
              const dayEvents = getEventsForDate(dayNum);
              const isToday =
                year === new Date().getFullYear() &&
                month === new Date().getMonth() &&
                dayNum === new Date().getDate();

              return (
                <div
                  key={dayNum}
                  className={`bg-surface min-h-[110px] p-2 flex flex-col justify-between group border-t border-r border-border hover:bg-ink-50/20 transition-all ${isToday ? "bg-accent-50/25 ring-1 ring-accent inset-0" : ""
                    }`}
                >
                  <div className="flex justify-between items-center">
                    <span
                      className={`text-xs font-mono font-semibold ${isToday
                          ? "bg-accent text-white w-5 h-5 rounded-full flex items-center justify-center shadow-xs"
                          : "text-ink-700"
                        }`}
                    >
                      {dayNum}
                    </span>
                  </div>

                  {/* List of day events */}
                  <div className="flex-1 mt-2 space-y-1.5 overflow-y-auto max-h-[75px] scrollbar-thin">
                    {dayEvents.map((evt) => (
                      <div
                        key={evt.id}
                        className="text-[9px] font-medium leading-tight px-1.5 py-0.5 rounded border truncate"
                        style={{
                          borderColor: "rgba(31, 138, 131, 0.15)",
                        }}
                        title={`${evt.staff_name} — ${evt.leave_type}`}
                      >
                        <div className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getEventBulletColor(evt.leave_type)}`} />
                          <span className="text-ink truncate font-semibold">{evt.staff_name.split(" ")[0]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: SCHEDULE LOGS */}
      {activeTab === "requests" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 bg-surface border border-border rounded-lg p-4">
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-ink-700 uppercase tracking-wider">Filter Staff</label>
              <select
                value={filterStaff}
                onChange={(e) => setFilterStaff(e.target.value)}
                className="bg-surface border border-border rounded-lg text-xs px-3 py-2 focus:border-accent focus:outline-none w-full"
              >
                <option value="ALL">All Staff Members</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.office})</option>
                ))}
              </select>
            </div>

            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-ink-700 uppercase tracking-wider">Filter Schedule Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-surface border border-border rounded-lg text-xs px-3 py-2 focus:border-accent focus:outline-none w-full"
              >
                <option value="ALL">All Schedule Types</option>
                {LEAVE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Requests Table */}
          <div className="bg-surface border border-border rounded-lg overflow-hidden tick-corners">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-ink-50 border-b border-border text-[10px] font-mono font-semibold text-ink-400 uppercase">
                    <th className="px-5 py-3">Staff Member</th>
                    <th className="px-5 py-3">Schedule Type</th>
                    <th className="px-5 py-3">Duration</th>
                    <th className="px-5 py-3">Notes</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs text-ink-700">
                  {filteredLeaves.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-ink-400 italic">
                        No leave or schedule requests found matching filters.
                      </td>
                    </tr>
                  ) : (
                    filteredLeaves.map((l) => (
                      <tr key={l.id} className="hover:bg-ink-50/10 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-semibold text-ink">{l.staff_name}</div>
                          <div className="text-[10px] text-ink-400">{l.staff_office}</div>
                        </td>
                        <td className="px-5 py-4">{getLeaveTypeBadge(l.leave_type)}</td>
                        <td className="px-5 py-4">
                          <div className="font-semibold">
                            {new Date(l.start_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                          </div>
                          <div className="text-[10px] text-ink-400">
                            to {new Date(l.end_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                          </div>
                        </td>
                        <td className="px-5 py-4 max-w-xs truncate" title={l.notes || ""}>
                          {l.notes || <span className="text-ink-100/50 italic">—</span>}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`text-[9px] uppercase font-mono font-semibold px-2 py-0.5 rounded-full ${l.status === "approved"
                                ? "bg-emerald-100 text-emerald-800"
                                : l.status === "denied"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-amber-100 text-amber-800 animate-pulse"
                              }`}
                          >
                            {l.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            {/* SuperAdmin approvals */}
                            {isSuperAdmin && l.status === "pending" && (
                              <>
                                <button
                                  onClick={() => handleAction(l.id, "approve")}
                                  disabled={loading}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                                  title="Approve request"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => handleAction(l.id, "deny")}
                                  disabled={loading}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                  title="Deny request"
                                >
                                  <X size={14} />
                                </button>
                              </>
                            )}

                            {/* Self or SuperAdmin cancel */}
                            {(isSuperAdmin || l.staff_id === currentUser?.id) && (
                              <button
                                onClick={() => handleAction(l.id, "delete")}
                                disabled={loading}
                                className="p-1.5 text-ink-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors cursor-pointer"
                                title="Cancel schedule"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-ink-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border bg-ink-50 flex items-center justify-between">
              <h2 className="font-display font-semibold text-sm text-ink">Book Leave or Schedule</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-ink-400 hover:text-ink cursor-pointer text-xs"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 text-red-700 text-xs px-3.5 py-2.5 rounded-lg border border-red-200/50 flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Staff Member dropdown (disabled/restricted for normal users) */}
              <div>
                <label className="block text-xs font-semibold text-ink-700 uppercase tracking-wider mb-1.5">Staff Member</label>
                {isSuperAdmin ? (
                  <select
                    name="staff_id"
                    required
                    defaultValue={currentUser?.id || ""}
                    className="w-full bg-surface border border-border rounded-lg text-sm px-3 py-2 focus:border-accent focus:outline-none transition-all"
                  >
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.office})</option>
                    ))}
                  </select>
                ) : (
                  <>
                    <input type="hidden" name="staff_id" value={currentUser?.id || ""} />
                    <div className="w-full bg-ink-50 border border-border rounded-lg text-sm px-3 py-2 text-ink-400">
                      {currentUser?.name}
                    </div>
                  </>
                )}
              </div>

              {/* Leave Type */}
              <div>
                <label className="block text-xs font-semibold text-ink-700 uppercase tracking-wider mb-1.5">Schedule Type</label>
                <select
                  name="leave_type"
                  required
                  defaultValue="vacation"
                  className="w-full bg-surface border border-border rounded-lg text-sm px-3 py-2 focus:border-accent focus:outline-none transition-all"
                >
                  <option value="vacation">Vacation Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="emergency">Emergency Leave</option>
                  <option value="official-business">Official Business (OB)</option>
                  <option value="wfh">Working From Home (WFH)</option>
                  <option value="fieldwork">Fieldwork</option>
                </select>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-700 uppercase tracking-wider mb-1.5">Start Date</label>
                  <input
                    type="date"
                    name="start_date"
                    required
                    defaultValue={todayStr}
                    className="w-full bg-surface border border-border rounded-lg text-sm px-3 py-2 focus:border-accent focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-700 uppercase tracking-wider mb-1.5">End Date</label>
                  <input
                    type="date"
                    name="end_date"
                    required
                    defaultValue={todayStr}
                    className="w-full bg-surface border border-border rounded-lg text-sm px-3 py-2 focus:border-accent focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-semibold text-ink-700 uppercase tracking-wider mb-1.5">Remarks / Reason</label>
                <textarea
                  name="remarks"
                  rows={3}
                  placeholder="Details, reason, or coverage arrangements..."
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
                  {loading ? "Booking..." : isSuperAdmin ? "Log Schedule" : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
