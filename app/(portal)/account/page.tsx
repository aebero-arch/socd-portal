import PageHeader from "@/components/page-header";
import { getMe } from "@/lib/me";
import PasswordForm from "./password-form";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ required?: string }>;
}) {
  const [{ required }, me] = await Promise.all([searchParams, getMe()]);

  return (
    <div className="max-w-md">
      <PageHeader title="Change password" />
      {me?.has_password === false ? (
        <p className="text-sm text-ink-700">
          You sign in with Google, so this account has no portal password. A SuperAdmin can set one if you need it.
        </p>
      ) : (
        <PasswordForm required={required === "1"} email={me?.email ?? ""} />
      )}
    </div>
  );
}
