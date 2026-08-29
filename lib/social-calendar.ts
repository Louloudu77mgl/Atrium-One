export type SocialCalendarMoment = {
  key: string;
  label: string;
  shortLabel: string;
  date: string;
  daysUntil: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function getUpcomingFrenchCommercialMoments(referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const upcoming = buildMomentsForYear(year).concat(buildMomentsForYear(year + 1))
    .map((moment) => ({
      ...moment,
      daysUntil: Math.ceil((moment.at.getTime() - startOfDay(referenceDate).getTime()) / DAY_MS)
    }))
    .filter((moment) => moment.daysUntil >= 0 && moment.daysUntil <= 90)
    .sort((left, right) => left.daysUntil - right.daysUntil);

  return upcoming.slice(0, 4).map(({ at, ...moment }) => ({
    ...moment,
    date: at.toISOString(),
  }));
}

function buildMomentsForYear(year: number) {
  return [
    { key: "soldes-hiver", label: "Soldes d'hiver", shortLabel: "Soldes", at: new Date(Date.UTC(year, 0, 10)) },
    { key: "saint-valentin", label: "Saint-Valentin", shortLabel: "Saint-Valentin", at: new Date(Date.UTC(year, 1, 14)) },
    { key: "paques", label: "Pâques", shortLabel: "Pâques", at: easterDate(year) },
    { key: "fete-des-meres", label: "Fête des mères", shortLabel: "Fête des mères", at: lastSundayOfMonthUtc(year, 4) },
    { key: "fete-des-peres", label: "Fête des pères", shortLabel: "Fête des pères", at: nthSundayOfMonthUtc(year, 5, 3) },
    { key: "fete-musique", label: "Fête de la musique", shortLabel: "Fête de la musique", at: new Date(Date.UTC(year, 5, 21)) },
    { key: "soldes-ete", label: "Soldes d'été", shortLabel: "Soldes", at: new Date(Date.UTC(year, 5, 26)) },
    { key: "vacances-ete", label: "Vacances d'été", shortLabel: "Vacances d'été", at: new Date(Date.UTC(year, 6, 1)) },
    { key: "fete-nationale", label: "Fête nationale", shortLabel: "14 juillet", at: new Date(Date.UTC(year, 6, 14)) },
    { key: "assomption", label: "Week-end du 15 août", shortLabel: "15 août", at: new Date(Date.UTC(year, 7, 15)) },
    { key: "rentree", label: "Rentrée", shortLabel: "Rentrée", at: new Date(Date.UTC(year, 8, 1)) },
    { key: "halloween", label: "Halloween", shortLabel: "Halloween", at: new Date(Date.UTC(year, 9, 31)) },
    { key: "black-friday", label: "Black Friday", shortLabel: "Black Friday", at: nthWeekdayOfMonthUtc(year, 10, 5, 4) },
    { key: "noel", label: "Noël", shortLabel: "Noël", at: new Date(Date.UTC(year, 11, 25)) }
  ];
}

function startOfDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function nthSundayOfMonthUtc(year: number, monthIndex: number, nth: number) {
  return nthWeekdayOfMonthUtc(year, monthIndex, nth, 0);
}

function nthWeekdayOfMonthUtc(year: number, monthIndex: number, nth: number, weekday: number) {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const delta = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, monthIndex, 1 + delta + (nth - 1) * 7));
}

function lastSundayOfMonthUtc(year: number, monthIndex: number) {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  return new Date(Date.UTC(year, monthIndex + 1, 0 - last.getUTCDay()));
}

function easterDate(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}
