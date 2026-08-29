import { Icon } from "@/components/icons";
import type { Review } from "@/lib/mock-data";
import { getReviewCountersFromReviews } from "@/lib/review-counters";

type TimelineItem = {
  id: string;
  title: string;
  body: string;
  dateLabel: string;
  tone: "purple" | "red" | "green";
};

export function ActivityTimeline({ reviews }: { reviews: Review[] }) {
  const items = getActivityItems(reviews);

  return (
    <section className="mb-7 rounded-[20px] border border-[#E9D5FF] bg-white p-5 shadow-[0_10px_30px_rgba(76,29,149,0.07)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-[#211432]">Activité récente</h2>
          <p className="mt-1 text-xs text-[#6B617F]">Les signaux importants du module Avis Google IA.</p>
        </div>
        <Icon name="chart" className="h-5 w-5 text-[#7C3AED]" />
      </div>
      <div className="space-y-0">
        {items.map((item, index) => (
          <article key={item.id} className="relative grid grid-cols-[18px_1fr] gap-3 pb-4 last:pb-0">
            {index < items.length - 1 ? <span className="absolute left-[8px] top-5 h-[calc(100%-20px)] w-px bg-[#E9D5FF]" /> : null}
            <span className={`relative z-10 mt-1 h-4 w-4 rounded-full ring-4 ring-white ${item.tone === "red" ? "bg-[#DC2626]" : item.tone === "green" ? "bg-[#16A34A]" : "bg-[#7C3AED]"}`} />
            <div className="rounded-2xl bg-[#FBFAFF] px-4 py-3 transition duration-300 hover:bg-[#F5F0FF]">
              <div className="mb-1 flex items-center justify-between gap-3">
                <strong className="text-sm text-[#211432]">{item.title}</strong>
                <span className="shrink-0 text-[11px] font-semibold text-[#8B7AA8]">{item.dateLabel}</span>
              </div>
              <p className="text-xs leading-5 text-[#6B617F]">{item.body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function getActivityItems(reviews: Review[]): TimelineItem[] {
  const counters = getReviewCountersFromReviews(reviews);
  const items: TimelineItem[] = [];

  if (counters.generated > 0) {
    items.push({
      id: "generated",
      title: "Réponses Hans générées",
      body: `${counters.generated} réponse${counters.generated > 1 ? "s" : ""} attendent une validation.`,
      dateLabel: "Aujourd'hui",
      tone: "purple"
    });
  }

  if (counters.urgent > 0) {
    items.push({
      id: "urgent",
      title: "Avis urgents détectés",
      body: `${counters.urgent} avis nécessitent une réponse rapide et empathique.`,
      dateLabel: "Aujourd'hui",
      tone: "red"
    });
  }

  if (counters.readyToPublish > 0) {
    items.push({
      id: "validated",
      title: "Réponses validées",
      body: `${counters.readyToPublish} réponse${counters.readyToPublish > 1 ? "s sont" : " est"} prête${counters.readyToPublish > 1 ? "s" : ""} à publier sur Google.`,
      dateLabel: "Cette semaine",
      tone: "green"
    });
  }

  items.push({
    id: "account",
    title: "Compte commerçant actif",
    body: reviews.length > 0 ? `${reviews.length} avis analysés dans AtriumOne.` : "Le module Avis Google IA est prêt à recevoir les premiers avis.",
    dateLabel: "Initialisation",
    tone: "purple"
  });

  return items;
}
