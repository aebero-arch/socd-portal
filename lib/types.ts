export type StaffMember = {
  id: string;
  name: string;
  role: string;
  unit: string;
  email: string;
  local_ext: string | null;
  status: "in-office" | "wfh" | "on-leave" | "fieldwork";
  photo_url: string | null;
};
