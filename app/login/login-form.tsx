"use client";

import { useState, useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { login, signup, loginWithGoogle } from "./actions";
import { Lock, Mail, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";

declare global {
  interface Window {
    google?: any;
  }
}

export default function LoginForm({ initialError }: { initialError?: string }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Selected server action
  const currentAction = mode === "login" ? login : signup;

  const [state, formAction, isPending] = useActionState(
    async (prevState: any, formData: FormData) => {
      setGoogleError(null);
      const result = await currentAction(prevState, formData);
      if (result?.success && mode === "login") {
        router.push("/");
        router.refresh();
      }
      return result;
    },
    null
  );

  // Initialize Google Sign-In SDK
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const handleCredentialResponse = async (response: any) => {
      if (!response.credential) return;
      setGoogleLoading(true);
      setGoogleError(null);
      try {
        const res = await loginWithGoogle(response.credential);
        if (res.success) {
          router.push("/");
          router.refresh();
        } else {
          setGoogleError(res.error || "Google sign-in failed.");
        }
      } catch {
        setGoogleError("Unable to complete Google sign-in. Please try again.");
      } finally {
        setGoogleLoading(false);
      }
    };

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
        });

        if (googleBtnRef.current) {
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: "outline",
            size: "large",
            width: "100%",
            text: "signin_with",
            shape: "rectangular",
          });
        }
      }
    };
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [router]);

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      {/* Tab Selectors */}
      <div className="flex border-b border-border mb-8">
        <button
          type="button"
          onClick={() => { setMode("login"); setGoogleError(null); }}
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
          onClick={() => { setMode("signup"); setGoogleError(null); }}
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
              ? "Sign in with your registered Google institutional account or email credentials."
              : "Register your institutional email address to request access to the Statistical Operations portal."}
          </p>
        </div>

        {/* Google Sign-In Option */}
        {mode === "login" && (
          <div className="space-y-4 mb-6">
            {/* Rendered Google GSI button container */}
            <div ref={googleBtnRef} className="w-full flex justify-center min-h-[44px]">
              {/* Fallback button if NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured or loading */}
              {(!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || googleLoading) && (
                <button
                  type="button"
                  disabled={googleLoading}
                  onClick={() => {
                    if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
                      setGoogleError("Google Sign-In requires NEXT_PUBLIC_GOOGLE_CLIENT_ID to be configured in Vercel/environment variables.");
                    }
                  }}
                  className="w-full border border-border hover:border-accent/40 bg-background hover:bg-surface text-ink font-medium text-xs py-2.5 px-4 rounded-md flex items-center justify-center gap-3 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {googleLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin text-accent" />
                      <span>Verifying Google account...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <span>Sign in with Google</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-border w-full" />
              <span className="bg-surface px-3 text-[10px] font-mono uppercase tracking-widest text-ink-400 shrink-0">
                Or sign in with password
              </span>
              <div className="border-t border-border w-full" />
            </div>
          </div>
        )}

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

          {/* Error / Status Messages */}
          {(googleError || state?.error || (mode === "login" && initialError)) && (
            <div className="bg-red-50 border-l-2 border-red-500 p-3 mt-4 text-xs text-red-700 font-body">
              {googleError || state?.error || initialError}
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
            disabled={isPending || googleLoading}
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
          SYS_STATUS: OPERATIONAL // GOOGLE_OAUTH_ACTIVE
        </p>
      </div>
    </div>
  );
}
