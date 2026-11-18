export type Office =
  | "ORD"
  | "CRASD"
  | "SOCD"
  | "Davao del Norte"
  | "Davao del Sur"
  | "Davao Oriental"
  | "Davao de Oro"
  | "Davao Occidental";

export const OFFICES: Office[] = [
  "ORD",
  "CRASD",
  "SOCD",
  "Davao del Norte",
  "Davao del Sur",
  "Davao Oriental",
  "Davao de Oro",
  "Davao Occidental",
];

export type PortalRole = "SuperAdmin" | "RSSO" | "PSO";


// Offices that belong to RSSO role
export const RSSO_OFFICES: Office[] = ["ORD", "CRASD", "SOCD"];
// Offices that belong to PSO role (provinces)
export const PSO_OFFICES: Office[] = [
  "Davao del Norte",
  "Davao del Sur",
  "Davao Oriental",
  "Davao de Oro",
  "Davao Occidental",
];

// Derive portal role from office selection
export function derivePortalRole(office: Office | null): PortalRole | null {
  if (!office) return null;
  if (RSSO_OFFICES.includes(office)) return "RSSO";
  if (PSO_OFFICES.includes(office)) return "PSO";
  return null;
}

export type StaffMember = {
  id: string;
  name: string;
  role: string;
  unit: string;
  office: Office | null;
  portal_role: PortalRole | null;
  email: string;
  local_ext: string | null;
  status: "in-office" | "wfh" | "on-leave" | "fieldwork";
  photo_url: string | null;
};

export const PAP_SERVICES = [
  "NATIONAL CENSUSES SERVICE",
  "MACROECONOMIC ACCOUNTS SERVICE",
  "COMMUNITY BASED STATISTICS SERVICE",
  "SOCIAL SECTOR STATISTICS SERVICE",
  "ECONOMIC SECTOR STATISTICS SERVICE",
] as const;

export type PapService = (typeof PAP_SERVICES)[number];

export type Pap = {
  id: string;
  name: string;
  service: string | null;
  year: number;
  created_at: string;
};

export type PapYears = {
  years: number[];        // years that have PAPs, newest first
  current_year: number;   // this year in Manila
  default_year: number;   // year pages open on when none is chosen
};

/** Reads ?year=YYYY, falling back to the default year. */
export function pickYear(param: string | undefined, fallback: number): number {
  return param && /^\d{4}$/.test(param) ? Number(param) : fallback;
}

export type ActivityType = "monthly" | "quarterly" | "one-time";

export type PapActivity = {
  id: string;
  pap_id: string;
  pap_name?: string; // joined from paps table
  activity_type: ActivityType;
  quarter: string | null;
  month: string | null;
  output_deliverable: string;
  deadline: string; // ISO date
  response_rate_fillable: boolean;
  created_at: string;
};

export type PapSubmission = {
  id: string;
  pap_monitoring_id: string;
  office: string;
  actual_submission: string | null;
  pso_remarks: string | null;
  response_rate: number | null;
  rsso_remarks: string | null;
  rating_quantity: number | null;
  created_at: string;
};

// ── Focal persons & year-end ratings ─────────────────────────────────────────
export type FocalAssignment = {
  pap_id: string;
  office: string;
  focal_id: string | null;
  alternate_id: string | null;
  focal_name: string | null;
  alternate_name: string | null;
};

export type StaffOption = {
  id: string;
  name: string;
  office: string;
  role: string;
};

export type RatingCounts = {
  activities_total: number;
  activities_rated: number;
  activities_missing: number;
  activities_pending: number;
};

export type ProjectOfficeRating = RatingCounts & {
  office: string;
  rating: number | null;
  focal_id: string | null;
  focal_name: string | null;
  alternate_id: string | null;
  alternate_name: string | null;
};

export type ProjectRating = {
  pap_id: string;
  pap_name: string;
  rating: number | null;
  offices: ProjectOfficeRating[];
};

export type OfficeRating = {
  office: string;
  rating: number | null;
  projects_rated: number;
  projects_total: number;
};

export type FocalProjectRating = RatingCounts & {
  pap_id: string;
  pap_name: string;
  office: string;
  rating: number | null;
};

export type FocalPersonRating = {
  staff_id: string;
  name: string;
  office: string;
  rating: number | null;
  projects_rated: number;
  projects: FocalProjectRating[];
};

export type RatingsReport = {
  year: number;
  years: number[];
  as_of: string;
  missing_activity_rating: number;
  offices: OfficeRating[];
  projects: ProjectRating[];
  focal_persons: FocalPersonRating[];
};
