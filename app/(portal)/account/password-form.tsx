"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { FormError } from "@/components/dialog";
import { useSaveStatus } from "@/lib/form-status";
import { changePassword } from "./actions";

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20";
const labelCls = "block text-xs font-medium text-ink-700 mb-1";

export default function PasswordForm({ required, email }: { required: boolean; email: string }) {
  const router = useRouter();
  const { busy, error, saved, run, fail } = useSaveStatus();
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const current = String(form.get("current") ?? "");
    const next = String(form.get("new") ?? "");
    if (next !== String(form.get("confirm") ?? "")) return fail("The new passwords don't match.");
    if (await run(() => changePassword(current, next))) {
      setDone(true);
      if (required) router.push("/");
    }
  }

  if (done && saved && !required) {
    return <p role="status" className="text-sm text-emerald-700">Password changed. Other devices have been signed out.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {required && (
        <p role="alert" className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          Your password is too easy to guess. Choose a new one to continue.
        </p>
      )}
      {/* Lets password managers save the new password under the right account. */}
      <input type="hidden" name="username" autoComplete="username" value={email} />
      <div>
        <label htmlFor="pw-current" className={labelCls}>Current password</label>
        <input id="pw-current" name="current" type="password" required autoComplete="current-password" disabled={busy} className={inputCls} />
      </div>
      <div>
        <label htmlFor="pw-new" className={labelCls}>New password</label>
        <input id="pw-new" name="new" type="password" required minLength={10} maxLength={128} autoComplete="new-password" disabled={busy} className={inputCls} />
      </div>
      <div>
        <label htmlFor="pw-confirm" className={labelCls}>Confirm new password</label>
        <input id="pw-confirm" name="confirm" type="password" required minLength={10} maxLength={128} autoComplete="new-password" disabled={busy} className={inputCls} />
      </div>
      <FormError message={error} />
      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center gap-2 bg-ink hover:bg-ink-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2.5 rounded-md"
      >
        {busy && <Loader2 size={14} className="animate-spin" />}
        Change password
      </button>
    </form>
  );
}
