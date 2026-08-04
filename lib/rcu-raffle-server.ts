import { randomBytes, randomInt, randomUUID } from "crypto";
import { getRcuVisitDay } from "@/lib/rcu-game-server";
import {
  listStoredRcuGameRecords,
  listStoredRcuRaffleDraws,
  saveStoredRcuRaffleDraw,
  type RcuRaffleDrawRecord
} from "@/lib/rcu-store";
import type { RcuProgram } from "@/lib/rcu";

export function normalizeRaffleMonth(value: string | null | undefined) {
  const month = String(value ?? "").trim();
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : null;
}

export async function getRcuRaffleStatus({ form, month }: { form: RcuProgram; month: string }) {
  const normalizedMonth = normalizeRaffleMonth(month);
  if (!normalizedMonth || form.form_type !== "raffle") throw new Error("Tombola ou mois invalide.");
  const [plays, draws] = await Promise.all([
    listStoredRcuGameRecords(form.merchant_id, { programId: form.id }),
    listStoredRcuRaffleDraws(form.merchant_id, { programId: form.id, month: normalizedMonth })
  ]);
  return {
    month: normalizedMonth,
    ticketCount: plays.filter((play) => play.result.raffleMonth === normalizedMonth && play.result.raffleTicket).length,
    draw: draws[0] ?? null
  };
}

export async function drawRcuRaffle({ form, month, now = new Date() }: { form: RcuProgram; month: string; now?: Date }) {
  const normalizedMonth = normalizeRaffleMonth(month);
  if (!normalizedMonth || form.form_type !== "raffle") throw new Error("Tombola ou mois invalide.");
  const existing = await listStoredRcuRaffleDraws(form.merchant_id, { programId: form.id, month: normalizedMonth });
  if (existing[0]) return { draw: existing[0], alreadyDrawn: true };
  const tickets = (await listStoredRcuGameRecords(form.merchant_id, { programId: form.id }))
    .filter((play) => play.result.raffleMonth === normalizedMonth && play.result.raffleTicket);
  if (!tickets.length) throw new Error("Aucun ticket enregistré pour ce mois.");
  const winner = tickets[randomInt(tickets.length)];
  const draw: RcuRaffleDrawRecord = {
    id: randomUUID(),
    public_token: randomBytes(16).toString("hex"),
    record_type: "raffle_draw",
    merchant_id: form.merchant_id,
    program_id: form.id,
    program_title: form.title,
    customer_key: winner.customer_key,
    raffle_month: normalizedMonth,
    prize_label: form.game_config.rafflePrize ?? "Le lot du mois",
    winner_play_id: winner.id,
    winner_ticket: winner.result.raffleTicket!,
    winner_name: `${winner.first_name} ${winner.last_name}`.trim(),
    winner_phone: winner.phone,
    total_tickets: tickets.length,
    visit_day: getRcuVisitDay(now),
    occurred_at: now.toISOString()
  };
  const persisted = await saveStoredRcuRaffleDraw(draw);
  return { draw: persisted, alreadyDrawn: persisted.id !== draw.id };
}
