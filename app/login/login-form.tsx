"use client";

import { useState, useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { login, loginWithGoogle } from "./actions";
import { Loader2 } from "lucide-react";

declare global {
  interface Window {
    google?: any;
  }
}

export default function LoginForm({ initialError }: { initialError?: string }) {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(
    async (prevState: any, formData: FormData) => {
      setGoogleError(null);
      const result = await login(prevState, formData);
      if (result?.success) {
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

  const busy = isPending || googleLoading;
  const error = googleError || state?.error || (!state ? initialError : null);
  const googleConfigured = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

  const inputCls =
    "w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20";
  const labelCls = "block text-xs font-medium text-ink-700 mb-1";

  return (
    <div className="w-full max-w-sm bg-surface border border-border rounded-xl p-6 shadow-sm">
      {googleConfigured && (
        <>
          {/* Google renders its own button here once its script loads. */}
          <div ref={googleBtnRef} className="w-full flex justify-center min-h-[44px]">
            {googleLoading && <Loader2 size={18} className="animate-spin text-accent self-center" />}
          </div>
          <div className="my-5 flex items-center gap-3 text-xs text-ink-400">
            <div className="h-px flex-1 bg-border" />
            or
            <div className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="email" className={labelCls}>Email</label>
          <input id="email" type="email" name="email" required autoComplete="email" disabled={busy} className={inputCls} />
        </div>
        <div>
          <label htmlFor="password" className={labelCls}>Password</label>
          <input id="password" type="password" name="password" required autoComplete="current-password" disabled={busy} className={inputCls} />
        </div>

        {error && (
          <p role="alert" className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-ink hover:bg-ink-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-md flex items-center justify-center gap-2 transition-colors"
        >
          {isPending && <Loader2 size={14} className="animate-spin" />}
          Sign in
        </button>
      </form>
    </div>
  );
}
