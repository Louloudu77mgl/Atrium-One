export const PRE_ONBOARDING_PUBLIC_TOKEN = "7c9e4a16-b523-48f1-9d72-e6a8143fb095";
export const PRE_ONBOARDING_PUBLIC_PATH = `/pre-onboarding/${PRE_ONBOARDING_PUBLIC_TOKEN}`;

export const PRE_ONBOARDING_STATUSES = ["À configurer", "En cours", "Terminé"] as const;
export type PreOnboardingStatus = (typeof PRE_ONBOARDING_STATUSES)[number];

export type CrmPreOnboarding = {
  id: string;
  lead_id: string;
  business_name: string;
  manager_name: string;
  contact_email: string;
  google_business_email: string;
  google_business_confirmed: boolean;
  gmail_email: string;
  gmail_same_as_google: boolean;
  gmail_confirmed: boolean;
  instagram_business_name: string;
  instagram_handle: string;
  instagram_professional_confirmed: boolean;
  global_confirmed: boolean;
  status: PreOnboardingStatus;
  google_configured: boolean;
  gmail_configured: boolean;
  instagram_configured: boolean;
  notification_status: "pending" | "sent" | "failed" | "skipped";
  notification_error: string | null;
  submitted_at: string;
  updated_at: string;
};

export function normalizeInstagramHandle(value: string) {
  return value.trim().replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/\/?(?:\?.*)?$/, "");
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
