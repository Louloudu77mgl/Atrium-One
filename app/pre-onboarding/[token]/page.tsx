import { notFound } from "next/navigation";
import { PreOnboardingForm } from "@/components/PreOnboardingForm";
import { PRE_ONBOARDING_PUBLIC_TOKEN } from "@/lib/crm/pre-onboarding";

export const metadata = {
  title: "Pré-onboarding | AtriumOne",
  description: "Préparez vos accès Google Business, Gmail et Instagram pour votre test AtriumOne."
};

export default async function PreOnboardingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token !== PRE_ONBOARDING_PUBLIC_TOKEN) notFound();
  return <PreOnboardingForm token={token} />;
}
