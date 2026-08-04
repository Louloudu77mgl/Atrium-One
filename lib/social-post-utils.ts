import type { SocialPostRow } from "@/lib/supabase/types";

export function getPostStatusLabel(status: SocialPostRow["status"]) {
  const labels = {
    draft: "Brouillon",
    editing: "En cours",
    ready: "Prêt",
    exported: "Exporté",
    saved: "Sauvegardé",
    scheduled: "Planifié",
    published: "Publié"
  };

  return labels[status];
}
