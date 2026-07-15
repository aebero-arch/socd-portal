import LoginForm from "./login-form";

export const metadata = {
  title: "Login — SOCD Portal",
  description: "Sign in to access the Statistical Operations and Coordination Division portal",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;
  const errorParam = typeof resolvedParams.error === "string" ? resolvedParams.error : undefined;
  
  const initialError =
    errorParam === "unauthorized"
      ? "Access Denied: Your email is not registered in the personnel directory. Please contact a SuperAdmin to enroll your email."
      : undefined;

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Header / Logo */}
      <div className="text-center mb-8 max-w-sm">
        <div className="inline-block font-mono text-[10px] tracking-widest text-accent uppercase border border-accent/30 px-3 py-1 rounded bg-accent-50/50 mb-3">
          SOCD // GATEWAY
        </div>
        <h1 className="font-display font-bold text-2xl text-ink tracking-tight">
          INTERNAL PORTAL
        </h1>
        <p className="text-xs text-ink-400 mt-1 font-body">
          Statistical Operations & Coordination Division
        </p>
      </div>

      {/* Login / Sign Up Form Card */}
      <LoginForm initialError={initialError} />
    </div>
  );
}

