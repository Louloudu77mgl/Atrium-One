export const CRM_ADMIN_EMAIL = "louisdacre@gmail.com";

export const COMMERCIAL_STATUSES = [
  "Nouveau",
  "À appeler",
  "Appelé",
  "Contacté",
  "À relancer",
  "RDV pris",
  "Démo réalisée",
  "Test AtriumOne",
  "Proposition envoyée",
  "En négociation",
  "Signé",
  "Client",
  "Perdu",
  "À revoir plus tard"
] as const;

export const CRM_TASK_TYPES = ["Appel", "Relance", "Email", "RDV", "Démo", "Closing", "Suivi", "Autre"] as const;
export const CRM_APPOINTMENT_TYPES = ["Premier échange", "Démo AtriumOne", "Onboarding", "RDV commercial", "Follow-up", "Closing", "Autre"] as const;
export const CRM_EVENT_TYPES = ["Appel effectué", "R1", "R2", "R3", "Point de suivi", "Autre"] as const;
export const CRM_CALL_RESULTS = ["Pas de réponse", "À rappeler", "Intéressé", "Pas intéressé", "RDV obtenu", "Mauvais contact", "Autre"] as const;
export const CRM_OPPORTUNITY_STATUSES = ["Ouverte", "Qualification", "Proposition", "Négociation", "Gagnée", "Perdue"] as const;
export const LOST_REASONS = ["Trop cher", "Pas intéressé", "Déjà équipé", "Pas le bon moment", "Pas de réponse", "Mauvaise cible", "Projet reporté", "Autre"] as const;
export const CRM_MODULES = ["reviews", "instagram", "hans", "automations", "emailing", "rcu", "customers", "insights"] as const;

export type CommercialStatus = (typeof COMMERCIAL_STATUSES)[number];
export type CrmModule = (typeof CRM_MODULES)[number];

export type CrmLead = {
  id: string;
  business_id: string | null;
  auth_user_id: string | null;
  name: string;
  business_type: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  phone: string | null;
  email: string | null;
  email_source: "website" | "manual" | "unavailable" | "account";
  website: string | null;
  google_place_id: string | null;
  google_maps_url: string | null;
  google_rating: number | null;
  google_reviews_count: number | null;
  google_profile_created_at: string | null;
  latitude: number | null;
  longitude: number | null;
  google_business_status: string | null;
  lead_source: "Google Prospection" | "Inscription site" | "Manuel" | "Recommandation" | "Import" | "Autre";
  commercial_status: CommercialStatus;
  signed_at: string | null;
  signed_offer: string | null;
  monthly_value: number | null;
  mrr: number | null;
  contract_started_at: string | null;
  signed_comment: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  lost_comment: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CrmTask = {
  id: string;
  lead_id: string;
  title: string;
  description: string | null;
  type: string;
  due_date: string;
  due_time: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  crm_leads?: Pick<CrmLead, "id" | "name" | "city" | "phone" | "email" | "business_type"> | null;
};

export type CrmAppointment = {
  id: string;
  lead_id: string;
  title: string;
  type: string;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  notes: string | null;
  result: string | null;
  created_at: string;
  updated_at: string;
  crm_leads?: Pick<CrmLead, "id" | "name" | "city"> | null;
};

export type CrmEvent = {
  id: string;
  lead_id: string;
  title: string;
  type: (typeof CRM_EVENT_TYPES)[number];
  event_date: string;
  event_time: string | null;
  duration_minutes: number | null;
  call_result: string | null;
  notes: string | null;
  result: string | null;
  source_appointment_id: string | null;
  created_at: string;
  updated_at: string;
  crm_leads?: Pick<CrmLead, "id" | "name" | "city"> | null;
};

export type CrmOpportunity = {
  id: string;
  lead_id: string;
  name: string;
  status: (typeof CRM_OPPORTUNITY_STATUSES)[number];
  mrr: number;
  arr: number;
  closed_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type BusinessAccess = {
  business_id: string;
  account_enabled: boolean;
  onboarding_status: "pending" | "active" | "suspended";
  signup_source: string;
  enabled_at: string | null;
  enabled_by: string | null;
  disabled_at: string | null;
  updated_at: string;
};

export type PlacesProspect = {
  placeId: string;
  name: string;
  businessType: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  emailSource: "website" | "unavailable";
  website: string | null;
  rating: number | null;
  reviewsCount: number | null;
  googleMapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  businessStatus: string | null;
  alreadyExists: boolean;
  existingLeadId: string | null;
};

export const MODULE_LABELS: Record<CrmModule, string> = {
  reviews: "Avis Google",
  instagram: "Instagram",
  hans: "Hans",
  automations: "Automatisations",
  emailing: "Emailing",
  rcu: "RCU",
  customers: "Base clients",
  insights: "Insights"
};
