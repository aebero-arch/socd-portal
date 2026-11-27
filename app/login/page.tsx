import LoginForm from "./login-form";

export const metadata = {
  title: "Sign in — SOCD Portal",
};

// Why the portal sent someone back here (see app/(portal)/layout.tsx).
const ERRORS: Record<string, string> = {
  unauthorized: "This email isn't in the personnel directory. Ask a SuperAdmin to add it.",
  session: "Your session has ended. Please sign in again.",
  unavailable: "The portal server can't be reached. Try again in a moment.",
  maintenance: "The portal is down for maintenance. Please try again later.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  const initialError = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-4 py-12">
      <h1 className="font-display font-semibold text-2xl text-ink mb-8">SOCD Portal</h1>
      <LoginForm initialError={initialError} />
    </div>
  );
}
