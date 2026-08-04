import { HansAvatar } from "@/components/hans-avatar";
import { Icon } from "@/components/icons";
import type { Review } from "@/lib/mock-data";
import { getDynamicHansRecommendations } from "@/lib/hans-dynamic-recommendations";

export function HansTodoList({
  reviews,
  googleConnected = false
}: {
  reviews: Review[];
  googleConnected?: boolean;
}) {
  const tasks = getDynamicHansRecommendations(reviews, googleConnected);
  const allDone = tasks.every((task) => task.state === "done");

  return (
    <section className="mb-7 rounded-[14px] border border-[#DDD6FE] bg-[#F5F0FF] px-5 py-5">
      <div className="mb-3.5 flex items-center gap-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#E9D5FF] bg-white shadow-sm">
          <HansAvatar size={34} />
        </div>
        <div>
          <h2 className="text-[15px] font-bold text-[#4C1D95]">Ce que Hans recommande aujourd'hui</h2>
          <p className="mt-0.5 text-xs text-[#6B617F]">{allDone ? "Tout est à jour. Hans n'a aucune recommandation prioritaire." : "Cette liste se met à jour automatiquement selon vos actions."}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {tasks.map((recommendation) => {
          const done = recommendation.state === "done";
          const inProgress = recommendation.state === "in_progress";

          return (
            <article key={recommendation.id} className={`flex items-start gap-3 rounded-lg bg-white/80 px-3.5 py-3 text-[13px] leading-5 transition ${done ? "opacity-70" : ""}`}>
              <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${done ? "border-[#7C3AED] bg-[#7C3AED] text-white" : "border-[#C4B5FD] bg-white text-transparent"}`}>
                {done ? <Icon name="check" className="h-3.5 w-3.5" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className={done ? "text-[#6B617F] line-through" : "text-[#211432]"}>{recommendation.title}</strong>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${done ? "bg-[#F3E8FF] text-[#7C3AED]" : inProgress ? "bg-[#F5F0FF] text-[#4C1D95]" : "bg-white text-[#8B7AA8]"}`}>
                    {done ? "Fait" : inProgress ? "En cours" : "À faire"}
                  </span>
                </div>
                <p className={done ? "mt-1 text-[#8B7AA8] line-through" : "mt-1 text-[#6B617F]"}>{recommendation.description}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
