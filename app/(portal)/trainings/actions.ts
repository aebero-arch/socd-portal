"use server";

import { revalidatePath } from "next/cache";
import { backendUrl, getAuthorizationHeaders, getServerToken } from "@/lib/api/server";

export interface TrainingActionResult {
  success: boolean;
  error: string | null;
}

async function callBackend(path: string, method: string, body?: unknown): Promise<TrainingActionResult> {
  try {
    const token = await getServerToken();
    if (!token) {
      return { success: false, error: "Your session has ended. Please sign in again." };
    }
    const res = await fetch(`${backendUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...getAuthorizationHeaders(token) },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const detail = typeof data.detail === "string" ? data.detail : "The request failed.";
      return { success: false, error: detail };
    }
    revalidatePath("/trainings");
    revalidatePath("/");
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "An unexpected error occurred." };
  }
}

function text(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function saveTraining(id: string | null, formData: FormData): Promise<TrainingActionResult> {
  const body = {
    title: text(formData, "title") ?? "",
    training_date: text(formData, "training_date"),
    end_date: text(formData, "end_date"),
    mode: text(formData, "mode") ?? "in-person",
    venue: text(formData, "venue"),
    organizer: text(formData, "organizer"),
    description: text(formData, "description"),
    materials_url: text(formData, "materials_url"),
  };
  if (!body.title || !body.training_date) {
    return { success: false, error: "Please give the training a title and a date." };
  }
  return id
    ? callBackend(`/api/trainings/${encodeURIComponent(id)}`, "PUT", body)
    : callBackend("/api/trainings", "POST", body);
}

export async function deleteTraining(id: string): Promise<TrainingActionResult> {
  return callBackend(`/api/trainings/${encodeURIComponent(id)}`, "DELETE");
}

export async function signUpForTraining(id: string): Promise<TrainingActionResult> {
  return callBackend(`/api/trainings/${encodeURIComponent(id)}/register`, "POST");
}

export async function withdrawFromTraining(id: string): Promise<TrainingActionResult> {
  return callBackend(`/api/trainings/${encodeURIComponent(id)}/register`, "DELETE");
}

export async function setTrainingAttendance(
  id: string,
  staffId: string,
  attended: boolean
): Promise<TrainingActionResult> {
  return callBackend(
    `/api/trainings/${encodeURIComponent(id)}/attendance/${encodeURIComponent(staffId)}`,
    "PATCH",
    { attended }
  );
}