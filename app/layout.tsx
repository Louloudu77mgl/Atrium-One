import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { socialFontVariables } from "./social-font-assets";
import { FailureSupportProvider } from "@/components/FailureSupportProvider";
import { PendingOnboardingBanner } from "@/components/PendingOnboardingBanner";
import { AdminImpersonationBanner } from "@/components/AdminImpersonationBanner";
import { getOwnBusinessAccess, isCrmAdminEmail } from "@/lib/crm/access";
import { getAdminImpersonationSession } from "@/lib/crm/impersonation-session";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "AtriumOne",
  description: "Dashboard IA pour commerçants indépendants"
};

async function PendingOnboardingState() {
  let pending = false;
  let modules: Record<string, boolean> = {};

  try {
    const state = await getOwnBusinessAccess();
    pending = Boolean(state.access && !state.access.account_enabled);
    modules = state.modules;
  } catch {
    // Public pages and deployments awaiting the additive migration remain available.
  }

  return <PendingOnboardingBanner pending={pending} modules={modules} bookingUrl={process.env.NEXT_PUBLIC_CSM_BOOKING_URL?.trim() || null} />;
}

async function AdminImpersonationState() {
  const [user, impersonation] = await Promise.all([getCurrentUser(), getAdminImpersonationSession()]);
  if (!impersonation || !isCrmAdminEmail(user?.email)) return null;
  return <AdminImpersonationBanner businessName={impersonation.businessName} leadId={impersonation.leadId} />;
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={socialFontVariables}>
        <Suspense fallback={null}>
          <AdminImpersonationState />
        </Suspense>
        <Suspense fallback={null}>
          <PendingOnboardingState />
        </Suspense>
        <FailureSupportProvider>{children}</FailureSupportProvider>
      </body>
    </html>
  );
}
