import type { Review } from "@/lib/mock-data";

type MonthPoint = {
  label: string;
  total: number;
  positive: number;
  negative: number;
  average: number;
};

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthlyData(reviews: Review[]): MonthPoint[] {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: monthKey(date),
      label: new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(date).replace(".", ""),
      total: 0,
      positive: 0,
      negative: 0,
      ratingSum: 0
    };
  });

  const buckets = new Map(months.map((month) => [month.key, month]));

  reviews.forEach((review) => {
    const date = review.createdAt ? new Date(review.createdAt) : null;

    if (!date || Number.isNaN(date.getTime())) {
      return;
    }

    const bucket = buckets.get(monthKey(date));

    if (!bucket) {
      return;
    }

    bucket.total += 1;
    bucket.ratingSum += review.rating;

    if (review.sentiment === "positif") bucket.positive += 1;
    if (review.sentiment === "negatif") bucket.negative += 1;
  });

  return months.map((month) => ({
    label: month.label,
    total: month.total,
    positive: month.positive,
    negative: month.negative,
    average: month.total > 0 ? month.ratingSum / month.total : 0
  }));
}

export function TrendChart({ reviews }: { reviews: Review[] }) {
  const data = getMonthlyData(reviews);
  const maxTotal = Math.max(1, ...data.map((item) => item.total));
  const chartTop = 54;
  const chartBottom = 276;
  const chartHeight = chartBottom - chartTop;
  const gridLeft = 70;
  const gridRight = 850;
  const chartLeft = 110;
  const chartRight = 850;
  const step = (chartRight - chartLeft) / Math.max(1, data.length - 1);
  const barWidth = 10;
  const barGap = 16;
  const ticks = Array.from({ length: 5 }, (_, index) => Math.round(maxTotal - (maxTotal / 4) * index));
  const points = data
    .map((item, index) => {
      const x = chartLeft + index * step;
      const y = chartBottom - (item.average / 5) * chartHeight;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <section className="mb-6 rounded-[20px] border border-[#EADCFF] bg-white p-4 shadow-[0_10px_30px_rgba(88,28,135,0.07)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#D8B4FE] hover:shadow-[0_18px_42px_rgba(88,28,135,0.12)] md:p-5">
      <div className="mb-3.5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-lg font-extrabold text-[#24113F]">Évolution des avis</h2>
          <p className="mt-1 text-xs text-[#7C6F95]">Volume d’avis positifs/négatifs et note moyenne sur 6 mois</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-[#6B5F82]">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#8B5CF6]" /> Positifs</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#EF4444]" /> Négatifs</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-1 w-4.5 rounded-full bg-[#7C3AED]" /> Note moyenne</span>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg viewBox="0 0 900 330" className="block h-[250px] w-full min-w-[680px] overflow-visible md:h-[310px]" role="img" aria-label="Graphique des avis">
          <defs>
            <linearGradient id="positiveGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#C4B5FD" stopOpacity="0.75" />
            </linearGradient>
            <linearGradient id="negativeGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#EF4444" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#FCA5A5" stopOpacity="0.7" />
            </linearGradient>
            <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#6D28D9" floodOpacity="0.16" />
            </filter>
          </defs>

          {ticks.map((value, line) => {
            const y = chartTop + (chartHeight / 4) * line;
            return (
              <g key={line}>
                <line className="chart-grid-line" x1={gridLeft} x2={gridRight} y1={y} y2={y} stroke="#EADCFF" strokeWidth="1.5" strokeDasharray="6 10" />
                <text x="48" y={y + 4} textAnchor="end" fontSize="13" fill="#8B7CA8">{value}</text>
              </g>
            );
          })}

          <g filter="url(#softShadow)">
            {data.map((item, index) => {
              const centerX = chartLeft + index * step;
              const positiveHeight = Math.max(item.positive > 0 ? 8 : 0, (item.positive / maxTotal) * chartHeight);
              const negativeHeight = Math.max(item.negative > 0 ? 8 : 0, (item.negative / maxTotal) * chartHeight);
              const positiveX = centerX - barWidth - barGap / 2;
              const negativeX = centerX + barGap / 2;

              return (
                <g key={`${item.label}-bars`}>
                  <title>{`${item.label} · ${item.total} avis · ${item.positive} positifs · ${item.negative} négatifs · note ${item.average ? item.average.toFixed(1) : "—"}/5`}</title>
                  <rect className="chart-bar transition-opacity duration-200 hover:opacity-75" x={positiveX} y={chartBottom - positiveHeight} width={barWidth} height={positiveHeight} rx="5" fill="url(#positiveGradient)" style={{ animationDelay: `${index * 80}ms` }} />
                  <rect className="chart-bar transition-opacity duration-200 hover:opacity-75" x={negativeX} y={chartBottom - negativeHeight} width={barWidth} height={negativeHeight} rx="5" fill="url(#negativeGradient)" style={{ animationDelay: `${index * 80 + 60}ms` }} />
                </g>
              );
            })}
          </g>

          <polyline className="chart-line" points={points} fill="none" stroke="#7C3AED" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />

          {data.map((item, index) => {
            const centerX = chartLeft + index * step;
            const lineY = chartBottom - (item.average / 5) * chartHeight;
            const valueLabel = item.average > 0 ? item.average.toFixed(1).replace(".", ",") : "0";

            return (
              <g key={`${item.label}-line`}>
                <circle className="chart-point transition duration-200 hover:scale-110" cx={centerX} cy={lineY} r="7" fill="#FFFFFF" stroke="#8B5CF6" strokeWidth="4.5" style={{ animationDelay: `${index * 90 + 250}ms` }} />
                <text className="chart-value" x={centerX} y={Math.max(26, lineY - 16)} textAnchor="middle" fontSize="13" fontWeight="800" fill="#4C1D95" style={{ animationDelay: `${index * 90 + 320}ms` }}>{valueLabel}</text>
                <text x={centerX} y="314" textAnchor="middle" fontSize="13" fill="#8B7CA8" className="capitalize">{item.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
