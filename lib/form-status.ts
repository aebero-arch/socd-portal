"use client";

import { useCallback, useState } from "react";

/**
 * The one state machine every form in the portal uses:
 *
 *   idle ──submit──▶ saving ──ok──▶ saved
 *     ▲                 │
 *     └────edit─────────┴──error──▶ failed(message)
 *
 * Server actions return `{ success, error }`; `run` maps that onto the states.
 * (Named useSaveStatus so it is not confused with react-dom's useFormStatus.)
 */
export type FormStatus =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved" }
  | { state: "failed"; message: string };

export type ActionResult = { success: boolean; error?: string | null };

const IDLE: FormStatus = { state: "idle" };

export function useSaveStatus() {
  const [status, setStatus] = useState<FormStatus>(IDLE);

  const fail = useCallback((message: string) => setStatus({ state: "failed", message }), []);
  const reset = useCallback(() => setStatus(IDLE), []);

  /** Runs a server action. Resolves to its result on success, or null on failure. */
  const run = useCallback(
    async <R extends ActionResult>(action: () => Promise<R>, fallback = "Something went wrong. Please try again.") => {
      setStatus({ state: "saving" });
      try {
        const res = await action();
        if (!res.success) {
          setStatus({ state: "failed", message: res.error || fallback });
          return null;
        }
        setStatus({ state: "saved" });
        return res;
      } catch (err) {
        setStatus({ state: "failed", message: err instanceof Error ? err.message : fallback });
        return null;
      }
    },
    []
  );

  return {
    status,
    busy: status.state === "saving",
    error: status.state === "failed" ? status.message : null,
    saved: status.state === "saved",
    run,
    fail,
    reset,
  };
}
