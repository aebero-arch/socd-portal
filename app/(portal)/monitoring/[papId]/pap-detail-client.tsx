"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import type { Pap, PapActivity, PapSubmission, PortalRole } from "@/lib/types";
import { PSO_OFFICES } from "@/lib/types";
import AllProvincesTab from "./all-provinces-tab";
import ProvinceTab from "./province-tab";

const ALL_TAB = "__all__";

interface Props {
  pap: Pap;
  allPaps: Pap[];
  initialActivities: PapActivity[];
  initialSubmissions: PapSubmission[];
  userRole: PortalRole | null;
  userOffice: string | null;   // e.g. "Davao del Sur" for PSO, null/RSSO for RSSO
}

export default function PapDetailClient({
  pap,
  allPaps,
  initialActivities,
  initialSubmissions,
  userRole,
  userOffice,
}: Props) {
  const isRSSO         = userRole === "RSSO" || userRole === "SuperAdmin";
  const isPSO          = userRole === "PSO";
  const canAddActivity = isRSSO;

  // PSO starts on their own province tab; RSSO starts on "All Provinces"
  const defaultTab = isPSO && userOffice ? userOffice : ALL_TAB;
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  // Shared state — lifted so both AllProvincesTab and ProvinceTab stay in sync
  const [activities,   setActivities]   = useState<PapActivity[]>(initialActivities);
  const [submissions,  setSubmissions]  = useState<PapSubmission[]>(initialSubmissions);

  // Build tab list
  const tabs: { id: string; label: string }[] = [];
  if (isRSSO) {
    tabs.push({ id: ALL_TAB, label: "All Provinces" });
  }
  if (isPSO && userOffice) {
    tabs.push({ id: userOffice, label: userOffice });
  } else if (isRSSO) {
    PSO_OFFICES.forEach((office) => tabs.push({ id: office, label: office }));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Province tab bar */}
      <div className="flex items-center gap-0.5 border-b border-border overflow-x-auto pb-0">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-1.5 px-4 py-2.5 text-xs font-mono whitespace-nowrap border-b-2 -mb-px transition-colors
                ${isActive
                  ? "border-accent text-accent"
                  : "border-transparent text-ink-400 hover:text-ink hover:border-ink/20"}
              `}
            >
              {tab.id === ALL_TAB && <Globe size={12} />}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === ALL_TAB && isRSSO ? (
        <AllProvincesTab
          activities={activities}
          submissions={submissions}
          onSelectProvince={(office) => setActiveTab(office)}
        />
      ) : (
        <ProvinceTab
          pap={pap}
          office={activeTab}
          activities={activities}
          submissions={submissions}
          userRole={userRole}
          onActivitiesChange={setActivities}
          onSubmissionsChange={setSubmissions}
        />
      )}
    </div>
  );
}
