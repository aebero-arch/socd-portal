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

export type StaffMember = {
  id: string;
  name: string;
  role: string;
  unit: string;
  office: Office | null;
  email: string;
  local_ext: string | null;
  status: "in-office" | "wfh" | "on-leave" | "fieldwork";
  photo_url: string | null;
};

