import { HansAvatar } from "@/components/hans-avatar";
import { Icon } from "@/components/icons";
import type { HansScore } from "@/lib/hans-score";

export function HansScoreCard({ score }: { score: HansScore }) {
  return (
    <section className="mb-6 overflow-hidden rounded-[20px] border border-[#E9D5FF] bg-white shadow-[0_10px_30px_rgba(76,29,149,0.07)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#D8B4FE] hover:shadow-[0_18px_42px_rgba(76,29,149,0.12)]">
      <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
        <div className="bg-gradient-to-br from-[#4C1D95] to-[#7C3AED] p-5 text-white">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-white shadow-sm">
              <HansAvatar size={42} />
            </span>
            <div>
              <div className="text-xs font-semibold text-white/60">Hans Score</div>
              <div className="text-sm font-black">Réputation IA</div>
            </div>
          </div>
          <div className="text-5xl font-black tracking-[-0.06em]">{score.score}<span className="text-xl text-white/55">/100</span></div>
          <div className="mt-3 inline-flex rounded-full bg-white/12 px-3 py-1 text-xs font-bold text-white/80">{score.label}</div>
          <p className="mt-4 text-xs leading-5 text-white/70">{score.explanation}</p>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-3">
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-[#211432]"><Icon name="chart" className="h-4 w-4 text-[#7C3AED]" /> Calcul</h3>
            <div className="space-y-2 text-xs font-semibold text-[#6B617F]">
              <div className="flex justify-between gap-3 rounded-xl bg-[#FBFAFF] px-3 py-2"><span>Note moyenne</span><strong className="text-[#211432]">{score.averageRating.toFixed(1).replace(".", ",")}/5</strong></div>
              <div className="flex justify-between gap-3 rounded-xl bg-[#FBFAFF] px-3 py-2"><span>Volume</span><strong className="text-[#211432]">{score.totalReviews} avis</strong></div>
              <div className="flex justify-between gap-3 rounded-xl bg-[#FBFAFF] px-3 py-2"><span>Avis négatifs</span><strong className="text-[#211432]">{Math.round(score.negativeShare * 100)}%</strong></div>
            </div>
            <div className="mt-3 grid grid-cols-5 gap-1.5">
              {([1, 2, 3, 4, 5] as const).map((star) => (
                <div key={star} className="rounded-lg bg-[#F3E8FF] px-1.5 py-1 text-center text-[10px] font-black text-[#7C3AED]">
                  {star}★<br />{score.starDistribution[star]}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-[#211432]"><Icon name="check" className="h-4 w-4 text-[#7C3AED]" /> Forces détectées</h3>
            <div className="flex flex-wrap gap-2">
              {score.strengths.map((strength) => (
                <span key={strength} className="rounded-full bg-[#F3E8FF] px-3 py-1.5 text-xs font-bold text-[#7C3AED]">{strength}</span>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-[#211432]"><Icon name="alert" className="h-4 w-4 text-[#DC2626]" /> Points d'amélioration</h3>
            <div className="flex flex-wrap gap-2">
              {score.improvements.map((improvement) => (
                <span key={improvement} className="rounded-full bg-[#FEF2F2] px-3 py-1.5 text-xs font-bold text-[#DC2626]">{improvement}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
