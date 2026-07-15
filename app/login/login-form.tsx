"use client";

import { useState, useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { login, signup } from "./actions";
import { Lock, Mail, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";

export default function LoginForm({ initialError }: { initialError?: string }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const router = useRouter();


  // Selected server action
  const currentAction = mode === "login" ? login : signup;

  const [state, formAction, isPending] = useActionState(
    async (prevState: any, formData: FormData) => {
      const result = await currentAction(prevState, formData);
      if (result?.success && mode === "login") {
        router.push("/");
        router.refresh();
      }
      return result;
    },
    null
  );

  // Clear states when toggling modes
  useEffect(() => {
    // Reset action state by refreshing/triggering state logic if needed, 
    // but simply changing the tab is enough since it swaps the action.
  }, [mode]);

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Tab Selectors */}
      <div className="flex border-b border-border mb-8">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`flex-1 pb-3 text-center text-xs font-mono tracking-widest uppercase border-b-2 transition-all ${
            mode === "login"
              ? "border-accent text-ink font-semibold"
              : "border-transparent text-ink-400 hover:text-ink"
          }`}
        >
          01 // Access Portal
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`flex-1 pb-3 text-center text-xs font-mono tracking-widest uppercase border-b-2 transition-all ${
            mode === "signup"
              ? "border-accent text-ink font-semibold"
              : "border-transparent text-ink-400 hover:text-ink"
          }`}
        >
          02 // Register Account
        </button>
      </div>

      {/* Card Wrapper */}
      <div className="bg-surface p-8 border border-border tick-corners shadow-sm transition-all duration-300">
        <div className="mb-6">
          <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
            {mode === "login" ? "AUTH_REQD" : "NEW_ENROLLMENT"}
          </p>
          <h2 className="font-display font-semibold text-xl text-ink mt-1">
            {mode === "login" ? "Sign In to SOCD Portal" : "Create Internal Account"}
          </h2>
          <p className="text-xs text-ink-400 mt-2 font-body leading-relaxed">
            {mode === "login"
              ? "Enter your credentials to access the statistics database, directory, and division schedules."
              : "Register your institutional email address to request access to the Statistical Operations portal."}
          </p>
        </div>

        <form action={formAction} className="space-y-4">
          {/* Email input */}
          <div className="space-y-1">
            <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-400">
              Agency Email Address
            </label>
            <div className="relative">
              <Mail
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
              />
              <input
                type="email"
                name="email"
                required
                placeholder="staff@agency.gov.ph"
                className="w-full rounded-md border border-border bg-background pl-9 pr-3 py-2.5 text-sm placeholder:text-ink-400/60 focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all font-body"
              />
            </div>
          </div>

          {/* Password input */}
          <div className="space-y-1">
            <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-400">
              Secure Password
            </label>
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
              />
              <input
                type="password"
                name="password"
                required
                placeholder="••••••••"
                className="w-full rounded-md border border-border bg-background pl-9 pr-3 py-2.5 text-sm placeholder:text-ink-400/60 focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all font-mono"
              />
            </div>
          </div>

          {/* Status Message */}
          {(state?.error || (mode === "login" && initialError)) && (
            <div className="bg-red-50 border-l-2 border-red-500 p-3 mt-4 text-xs text-red-700 font-body">
              {state?.error || initialError}
            </div>
          )}

          {state?.success && state?.message && (
            <div className="bg-accent-50 border-l-2 border-accent p-3 mt-4 text-xs text-accent-600 font-body flex items-start gap-2">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <span>{state.message}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-ink hover:bg-ink-700 disabled:bg-ink-400 text-white font-mono text-[11px] tracking-widest uppercase py-3 px-4 rounded-md flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm mt-6 group"
          >
            {isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Processing request...
              </>
            ) : (
              <>
                {mode === "login" ? "Execute Login" : "Initialize Account"}
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Decorative Subtext */}
      <div className="text-center mt-6">
        <p className="font-mono text-[10px] text-ink-400 uppercase tracking-widest">
          SYS_STATUS: OPERATIONAL // SECURE_SSL_ACTIVE
        </p>
      </div>
    </div>
  );
}
