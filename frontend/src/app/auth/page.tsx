import { AuthShell } from "@/components/auth/auth-shell";
import { validatedStaffReturn } from "@/lib/navigation/staff-return";

type AuthPageProps = { searchParams: Promise<{ returnTo?: string | string[]; reason?: string | string[] }> };

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const params = await searchParams;
  const candidate = typeof params.returnTo === "string" ? params.returnTo : undefined;
  const returnTo = validatedStaffReturn(candidate);
  const reason = typeof params.reason === "string" ? params.reason : undefined;
  return <AuthShell returnTo={returnTo} reason={reason} />;
}
