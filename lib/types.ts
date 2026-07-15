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

export type PortalRole = "RSSO" | "PSO";

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

export type Pap = {
  id: string;
  name: string;
  created_at: string;
};

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
  actual_submission: string | null;
  rsso_remarks: string | null;
  pso_remarks: string | null;
  response_rate_fillable: boolean;
  response_rate: number | null;
  rating_quantity: number | null;
  created_at: string;
};
