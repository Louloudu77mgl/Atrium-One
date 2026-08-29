import type { Metadata } from "next";
import "./globals.css";
import { socialFontVariables } from "./social-font-assets";
import { FailureSupportProvider } from "@/components/FailureSupportProvider";
import { PendingOnboardingBanner } from "@/components/PendingOnboardingBanner";
import { getOwnBusinessAccess } from "@/lib/crm/access";

export const metadata: Metadata = {
  title: "AtriumOne",
  description: "Dashboard IA pour commerçants indépendants"
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  let pending = false;
  let modules: Record<string, boolean> = {};
  try {
    const state = await getOwnBusinessAccess();
    pending = Boolean(state.access && !state.access.account_enabled);
    modules = state.modules;
  } catch {
    // Public pages and deployments awaiting the additive migration remain available.
  }

  return (
    <html lang="fr">
      <body className={socialFontVariables}>
        <PendingOnboardingBanner pending={pending} modules={modules} bookingUrl={process.env.NEXT_PUBLIC_CSM_BOOKING_URL?.trim() || null} />
        <FailureSupportProvider>{children}</FailureSupportProvider>
      </body>
    </html>
  );
}
