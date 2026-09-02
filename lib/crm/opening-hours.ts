import type { GoogleOpeningHours } from "@/lib/crm/types";

const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

export const GOOGLE_WEEKDAYS = [
  { value: "1", label: "Lundi" },
  { value: "2", label: "Mardi" },
  { value: "3", label: "Mercredi" },
  { value: "4", label: "Jeudi" },
  { value: "5", label: "Vendredi" },
  { value: "6", label: "Samedi" },
  { value: "0", label: "Dimanche" }
] as const;

function timeInMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}

export function googleWeekdayForDate(date: string) {
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getUTCDay();
}

export function hasOpeningHours(hours?: GoogleOpeningHours | null) {
  return Boolean(hours?.periods?.some((period) => period.open));
}

export function isOpenAt(hours: GoogleOpeningHours | null | undefined, googleDay: number, time: string) {
  const targetTime = timeInMinutes(time);
  if (!hours?.periods?.length || googleDay < 0 || googleDay > 6 || targetTime === null) return false;
  const target = googleDay * MINUTES_PER_DAY + targetTime;

  return hours.periods.some((period) => {
    if (!period.open) return false;
    const open = (period.open.day ?? 0) * MINUTES_PER_DAY + (period.open.hour ?? 0) * 60 + (period.open.minute ?? 0);
    if (!period.close) return true;
    let close = (period.close.day ?? 0) * MINUTES_PER_DAY + (period.close.hour ?? 0) * 60 + (period.close.minute ?? 0);
    if (close <= open) close += MINUTES_PER_WEEK;
    return (target >= open && target < close) || (target + MINUTES_PER_WEEK >= open && target + MINUTES_PER_WEEK < close);
  });
}

export function isOpenAtDate(hours: GoogleOpeningHours | null | undefined, date: string, time: string) {
  const day = googleWeekdayForDate(date);
  return day !== null && isOpenAt(hours, day, time);
}
