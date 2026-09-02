"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { sortCalendarTasks } from "@/lib/crm/logic";
import { COMMERCIAL_STATUSES, type CrmEvent, type CrmTask } from "@/lib/crm/types";

type View = "today" | "day" | "week" | "month";
type PlannerOptions = { cities: string[]; businessTypes: string[]; sources: string[] };
type Presence = "all" | "yes" | "no";

const iso = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};
const addDays = (date: Date, count: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
};
const parseDay = (value: string) => new Date(`${value}T12:00:00`);
const fullDate = (date: string) => parseDay(date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const eventClass = (type: string) => ["R1", "R2", "R3"].includes(type)
  ? "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-sm"
  : "bg-cyan-50 text-cyan-900";

export function CalendarWorkspace({ initialTasks, initialEvents, initialDay, initialView, plannerOptions }: {
  initialTasks: CrmTask[];
  initialEvents: CrmEvent[];
  initialDay: string;
  initialView: View;
  plannerOptions: PlannerOptions;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks.filter((task) => !task.completed));
  const [events] = useState(initialEvents);
  const [view, setView] = useState<View>(initialView);
  const [anchor, setAnchor] = useState(() => parseDay(initialDay));
  const [completing, setCompleting] = useState<Set<string>>(new Set());
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [showPlanner, setShowPlanner] = useState(false);
  const [plannerDates, setPlannerDates] = useState<string[]>([]);
  const [plannerDate, setPlannerDate] = useState("");
  const [prospectsPerDay, setProspectsPerDay] = useState(60);
  const [plannerFilters, setPlannerFilters] = useState({ city: "", businessType: "", status: "", source: "", minRating: "", minReviews: "", email: "all" as Presence, website: "all" as Presence, openingTime: "" });
  const [planning, setPlanning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const monthYear = anchor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const today = iso(new Date());
  const activeDay = iso(anchor);

  const dates = useMemo(() => {
    if (view === "week") {
      const start = new Date(anchor);
      const weekday = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - weekday);
      return Array.from({ length: 7 }, (_, index) => iso(addDays(start, index)));
    }
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    return Array.from({ length: end.getDate() }, (_, index) => iso(new Date(anchor.getFullYear(), anchor.getMonth(), index + 1)));
  }, [view, anchor]);

  function syncRoute(nextView: View, date: Date) {
    router.replace(`/crm/calendar?view=${nextView}&day=${iso(date)}`, { scroll: false });
  }

  function selectView(nextView: View) {
    const date = nextView === "today" ? new Date() : anchor;
    setView(nextView);
    setAnchor(date);
    setSelectedTasks(new Set());
    syncRoute(nextView, date);
  }

  function openDay(date: string) {
    const next = parseDay(date);
    setView("day");
    setAnchor(next);
    setNotice(null);
    setSelectedTasks(new Set());
    syncRoute("day", next);
  }

  function move(direction: number) {
    const next = view === "month"
      ? new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1)
      : addDays(anchor, direction * (view === "week" ? 7 : 1));
    const nextView = view === "today" ? "day" : view;
    setView(nextView);
    setAnchor(next);
    setNotice(null);
    setSelectedTasks(new Set());
    syncRoute(nextView, next);
  }

  async function completeTask(task: CrmTask) {
    setCompleting((current) => new Set(current).add(task.id));
    const response = await fetch(`/api/crm/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true })
    });
    if (response.ok) {
      setTasks((current) => current.filter((item) => item.id !== task.id));
      setSelectedTasks((current) => { const next = new Set(current); next.delete(task.id); return next; });
      setNotice(`Tâche terminée : ${task.title}. Elle a été retirée de la journée.`);
    } else {
      setNotice("La tâche n’a pas pu être terminée.");
    }
    setCompleting((current) => {
      const next = new Set(current);
      next.delete(task.id);
      return next;
    });
  }

  async function deleteTask(id: string) {
    if (!confirm("Supprimer définitivement cette tâche ?")) return;
    if ((await fetch(`/api/crm/tasks/${id}`, { method: "DELETE" })).ok) {
      setTasks((current) => current.filter((item) => item.id !== id));
      setSelectedTasks((current) => { const next = new Set(current); next.delete(id); return next; });
      setNotice("Tâche supprimée.");
    }
  }

  async function rescheduleTask(task: CrmTask) {
    const dueDate = prompt("Nouvelle date (AAAA-MM-JJ)", task.due_date);
    if (!dueDate) return;
    const dueTime = prompt("Heure facultative (HH:MM)", task.due_time?.slice(0, 5) ?? "");
    if (dueTime === null) return;
    const response = await fetch(`/api/crm/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ due_date: dueDate, due_time: dueTime })
    });
    if (response.ok) {
      const updated = await response.json();
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, ...updated } : item));
      setNotice(`Tâche replanifiée au ${new Date(`${dueDate}T12:00:00`).toLocaleDateString("fr-FR")}.`);
    }
  }

  function addPlannerDate() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(plannerDate) || plannerDates.includes(plannerDate)) return;
    setPlannerDates((current) => [...current, plannerDate].sort());
    setPlannerDate("");
  }

  async function planColdCalls() {
    if (!plannerDates.length) return setNotice("Sélectionnez au moins une journée.");
    setPlanning(true);
    const response = await fetch("/api/crm/calendar/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dates: plannerDates, prospectsPerDay, filters: plannerFilters })
    });
    const data = await response.json();
    if (response.ok) {
      setTasks((current) => [...current, ...data.tasks]);
      const detail = data.dates.map((date: string) => `${new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} : ${data.counts[date]}`).join(" · ");
      setShowPlanner(false);
      openDay(data.dates[0]);
      setNotice(`${data.created} appels planifiés. ${detail}${data.openingTime ? ` · uniquement les commerces ouverts à ${data.openingTime}` : ""}${data.unknownOpeningHours ? ` · ${data.unknownOpeningHours} horaire${data.unknownOpeningHours > 1 ? "s" : ""} Google inconnu${data.unknownOpeningHours > 1 ? "s" : ""} exclu${data.unknownOpeningHours > 1 ? "s" : ""}` : ""}${data.shortage ? ` · ${data.shortage} prospect${data.shortage > 1 ? "s" : ""} manquant${data.shortage > 1 ? "s" : ""}` : ""}`);
    } else {
      setNotice(data.error?.message ?? "La répartition n’a pas pu être créée.");
    }
    setPlanning(false);
  }

  async function runTaskBulk(action: "complete" | "delete" | "reschedule") {
    const taskIds = [...selectedTasks];
    if (!taskIds.length) return;
    if (action === "delete" && !confirm(`Supprimer définitivement ${taskIds.length} tâches ?`)) return;
    let dueDate: string | undefined;
    let dueTime: string | undefined;
    if (action === "reschedule") {
      dueDate = prompt("Nouvelle date pour la sélection (AAAA-MM-JJ)", activeDay) ?? undefined;
      if (!dueDate) return;
      const enteredTime = prompt("Heure commune facultative (HH:MM)", "");
      if (enteredTime === null) return;
      dueTime = enteredTime;
    }
    const response = await fetch("/api/crm/tasks/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, taskIds, dueDate, dueTime })
    });
    const data = await response.json();
    if (response.ok) {
      if (action === "reschedule") {
        const updates = new Map((data.tasks ?? []).map((task: CrmTask) => [task.id, task]));
        setTasks((current) => current.map((task) => updates.has(task.id) ? { ...task, ...updates.get(task.id)! } : task));
      } else {
        const removed = new Set(taskIds);
        setTasks((current) => current.filter((task) => !removed.has(task.id)));
      }
      setSelectedTasks(new Set());
      setNotice(`${data.updated} tâche${data.updated > 1 ? "s" : ""} ${action === "complete" ? "terminée" : action === "delete" ? "supprimée" : "replanifiée"}${data.updated > 1 ? "s" : ""}.`);
    } else {
      setNotice(data.error?.message ?? "Action groupée impossible.");
    }
  }

  return <div className="space-y-4 p-5 lg:p-8">
    <section className="rounded-xl border border-[#E8E4DB] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-1 rounded-lg bg-[#F3F0EB] p-1">
          {([['today', 'Aujourd’hui'], ['day', 'Jour'], ['week', 'Semaine'], ['month', 'Mois']] as const).map(([key, label]) => <button key={key} onClick={() => selectView(key)} className={`rounded-md px-3 py-2 text-xs font-black ${view === key ? "bg-white text-[#4C1D95] shadow-sm" : "text-[#6B617F]"}`}>{label}</button>)}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowPlanner(!showPlanner)} className="ao-btn-primary h-9 px-3 text-xs font-black">Préparer mes listes</button>
          <button aria-label="Période précédente" onClick={() => move(-1)} className="ao-btn-secondary h-9 w-9 text-lg">‹</button>
          <h2 className="min-w-[190px] text-center text-lg font-black capitalize text-[#2E1065]">{monthYear}</h2>
          <button aria-label="Période suivante" onClick={() => move(1)} className="ao-btn-secondary h-9 w-9 text-lg">›</button>
          <button onClick={() => selectView("today")} className="ao-btn-secondary h-9 px-3 text-xs font-black">Aujourd’hui</button>
        </div>
      </div>
    </section>

    {showPlanner ? <section className="rounded-xl border border-[#C4B5FD] bg-gradient-to-br from-white to-violet-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="text-[10px] font-black uppercase tracking-[.14em] text-[#7C3AED]">Planificateur cold call</div><h2 className="mt-1 text-lg font-black text-[#2E1065]">Construire automatiquement mes journées</h2><p className="mt-1 max-w-2xl text-xs font-semibold text-[#6B617F]">Prospects actifs avec téléphone, hors Client / Signé / Perdu et sans appel déjà en attente.</p></div>
        <button onClick={() => setShowPlanner(false)} className="text-xs font-black text-[#6B617F]">Fermer</button>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_auto] lg:items-end">
        <div><label className="ao-label">Ajouter une journée</label><div className="mt-1 flex gap-2"><input type="date" value={plannerDate} onChange={(event) => setPlannerDate(event.target.value)} className="ao-input h-10 flex-1 px-3" /><button onClick={addPlannerDate} className="ao-btn-secondary h-10 px-4 text-xs font-black">Ajouter</button></div></div>
        <label className="ao-label">Prospects par jour<input type="number" min="1" max="200" value={prospectsPerDay} onChange={(event) => setProspectsPerDay(Math.min(200, Math.max(1, Number(event.target.value) || 1)))} className="ao-input mt-1 h-10 w-full px-3" /></label>
        <button disabled={planning || !plannerDates.length} onClick={() => void planColdCalls()} className="ao-btn-primary h-10 px-5 text-xs font-black disabled:opacity-50">{planning ? "Répartition…" : `Créer ${plannerDates.length * prospectsPerDay} appels`}</button>
      </div>
      <div className="mt-4 grid gap-2 rounded-xl border border-violet-100 bg-white/80 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <PlannerSelect label="Ville" value={plannerFilters.city} options={plannerOptions.cities} onChange={(city) => setPlannerFilters({ ...plannerFilters, city })} />
        <PlannerSelect label="Métier" value={plannerFilters.businessType} options={plannerOptions.businessTypes} onChange={(businessType) => setPlannerFilters({ ...plannerFilters, businessType })} />
        <PlannerSelect label="Statut" value={plannerFilters.status} options={[...COMMERCIAL_STATUSES].filter((status) => !["Client", "Signé", "Perdu"].includes(status))} onChange={(status) => setPlannerFilters({ ...plannerFilters, status })} />
        <PlannerSelect label="Source" value={plannerFilters.source} options={plannerOptions.sources} onChange={(source) => setPlannerFilters({ ...plannerFilters, source })} />
        <label className="ao-label">Note Google min.<input type="number" min="0" max="5" step="0.1" value={plannerFilters.minRating} onChange={(event) => setPlannerFilters({ ...plannerFilters, minRating: event.target.value })} className="ao-input mt-1 h-9 px-2" /></label>
        <label className="ao-label">Nombre d’avis min.<input type="number" min="0" value={plannerFilters.minReviews} onChange={(event) => setPlannerFilters({ ...plannerFilters, minReviews: event.target.value })} className="ao-input mt-1 h-9 px-2" /></label>
        <PresenceSelect label="A un email" value={plannerFilters.email} onChange={(email) => setPlannerFilters({ ...plannerFilters, email })} />
        <PresenceSelect label="A un site" value={plannerFilters.website} onChange={(website) => setPlannerFilters({ ...plannerFilters, website })} />
        <label className="ao-label">Ouvert à<input type="time" value={plannerFilters.openingTime} onChange={(event) => setPlannerFilters({ ...plannerFilters, openingTime: event.target.value })} className="ao-input mt-1 h-9 px-2" /><span className="mt-1 block text-[9px] font-semibold normal-case text-[#8B7AA8]">Contrôlé pour chaque jour choisi</span></label>
        <button onClick={() => setPlannerFilters({ city: "", businessType: "", status: "", source: "", minRating: "", minReviews: "", email: "all", website: "all", openingTime: "" })} className="self-end justify-self-start px-2 py-2 text-[10px] font-black text-[#7C3AED]">Réinitialiser les filtres</button>
      </div>
      <div className="mt-3 flex min-h-8 flex-wrap gap-2">{plannerDates.map((date) => <button key={date} onClick={() => setPlannerDates((current) => current.filter((item) => item !== date))} className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-black capitalize text-[#4C1D95]">{new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" })} ×</button>)}{!plannerDates.length ? <span className="text-xs font-semibold text-[#8B7AA8]">Ajoutez par exemple le 3 et le 7 septembre.</span> : <span className="self-center text-xs font-black text-emerald-700">{plannerDates.length} jour{plannerDates.length > 1 ? "s" : ""} · {plannerDates.length * prospectsPerDay} prospects prévus</span>}</div>
    </section> : null}

    {notice ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800">{notice}</div> : null}

    {view === "today" || view === "day" ? <DayWorkspace
      date={activeDay}
      tasks={tasks}
      events={events}
      completing={completing}
      selectedTasks={selectedTasks}
      onToggleSelection={(id) => setSelectedTasks((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; })}
      onSelectAll={(ids) => setSelectedTasks(new Set(ids))}
      onBulk={runTaskBulk}
      onComplete={completeTask}
      onDelete={deleteTask}
      onReschedule={rescheduleTask}
    /> : <CalendarGrid dates={dates} today={today} view={view} tasks={tasks} events={events} onOpenDay={openDay} />}
  </div>;
}

function CalendarGrid({ dates, today, view, tasks, events, onOpenDay }: {
  dates: string[];
  today: string;
  view: "week" | "month";
  tasks: CrmTask[];
  events: CrmEvent[];
  onOpenDay: (date: string) => void;
}) {
  return <section className={`grid gap-2 ${view === "week" ? "lg:grid-cols-7" : "sm:grid-cols-2 lg:grid-cols-7"}`}>
    {dates.map((date) => {
      const dayTasks = sortCalendarTasks(tasks.filter((task) => task.due_date === date));
      const dayEvents = events.filter((item) => item.event_date === date).sort((a, b) => (a.event_time ?? "99:99").localeCompare(b.event_time ?? "99:99"));
      return <article key={date} className={`min-h-[155px] rounded-xl border bg-white p-3 ${date === today ? "border-[#A855F7] ring-1 ring-[#E9D5FF]" : "border-[#E8E4DB]"}`}>
        <button onClick={() => onOpenDay(date)} className="mb-3 w-full text-left text-xs font-black capitalize hover:text-[#7C3AED]">
          {parseDay(date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: view === "week" ? "short" : undefined })}
        </button>
        <div className="space-y-1.5">
          {dayEvents.slice(0, 3).map((item) => <button key={item.id} onClick={() => onOpenDay(date)} className={`block w-full rounded-md p-2 text-left text-[10px] font-bold ${eventClass(item.type)}`}><span className="block font-black">{item.event_time?.slice(0, 5) ?? "Toute la journée"}</span>{item.title}</button>)}
          {dayTasks.slice(0, Math.max(0, 4 - dayEvents.length)).map((task) => <button key={task.id} onClick={() => onOpenDay(date)} className="block w-full rounded-md bg-amber-50 p-2 text-left text-[10px] font-bold text-amber-800"><span className="block font-black">{task.due_time?.slice(0, 5) ?? "Sans horaire"}</span>{task.title}</button>)}
          {dayTasks.length + dayEvents.length > 4 ? <button onClick={() => onOpenDay(date)} className="text-[10px] font-black text-[#7C3AED]">+ {dayTasks.length + dayEvents.length - 4} autres</button> : null}
          {!dayTasks.length && !dayEvents.length ? <button onClick={() => onOpenDay(date)} className="text-[10px] text-[#AAA19A]">Aucun élément</button> : null}
        </div>
      </article>;
    })}
  </section>;
}

function DayWorkspace({ date, tasks, events, completing, selectedTasks, onToggleSelection, onSelectAll, onBulk, onComplete, onDelete, onReschedule }: {
  date: string;
  tasks: CrmTask[];
  events: CrmEvent[];
  completing: Set<string>;
  selectedTasks: Set<string>;
  onToggleSelection: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onBulk: (action: "complete" | "delete" | "reschedule") => void;
  onComplete: (task: CrmTask) => void;
  onDelete: (id: string) => void;
  onReschedule: (task: CrmTask) => void;
}) {
  const sorted = sortCalendarTasks(tasks.filter((task) => task.due_date === date));
  const timed = sorted.filter((task) => task.due_time);
  const untimed = sorted.filter((task) => !task.due_time);
  const allSelected = sorted.length > 0 && sorted.every((task) => selectedTasks.has(task.id));
  const dayEvents = events.filter((item) => item.event_date === date).sort((a, b) => (a.event_time ?? "99:99").localeCompare(b.event_time ?? "99:99"));
  const returnTo = `/crm/calendar?view=day&day=${date}`;

  return <div className="space-y-4">
    <section className="rounded-xl border border-[#E8E4DB] bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[.14em] text-[#8B7AA8]">Plan de journée</div>
          <h2 className="mt-1 text-2xl font-black capitalize tracking-[-.03em] text-[#2E1065]">{fullDate(date)}</h2>
          <p className="mt-1 text-xs font-semibold text-[#6B617F]">Les tâches terminées disparaissent de cette liste mais restent conservées dans l’historique du prospect.</p>
        </div>
        <div className="flex gap-2 text-center">
          <Metric value={sorted.length} label="À faire" />
          <Metric value={timed.length} label="Horaires" />
          <Metric value={dayEvents.length} label="Événements" accent />
        </div>
      </div>
    </section>

    {dayEvents.length ? <section className="rounded-xl border border-[#E8E4DB] bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-xs font-black uppercase tracking-wide text-[#6B617F]">Événements commerciaux</h3>
      <div className="grid gap-2 lg:grid-cols-2">
        {dayEvents.map((item) => <Link key={item.id} href={`/crm/leads/${item.lead_id}?returnTo=${encodeURIComponent(returnTo)}`} className={`rounded-lg p-3 text-xs font-black ${eventClass(item.type)}`}>
          <span className="mr-2 opacity-80">{item.event_time?.slice(0, 5) ?? "Toute la journée"}</span>{item.title}
          {item.duration_minutes ? <span className="ml-2 opacity-70">· {item.duration_minutes} min</span> : null}
        </Link>)}
      </div>
    </section> : null}

    <section className="overflow-hidden rounded-xl border border-[#E8E4DB] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8E4DB] px-4 py-3">
        <div><h3 className="text-sm font-black">Liste d’appels et d’actions</h3><p className="text-[11px] font-semibold text-[#8B7AA8]">{sorted.length} tâche{sorted.length > 1 ? "s" : ""} active{sorted.length > 1 ? "s" : ""}</p></div>
        <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-black text-amber-800">Heures d’abord · sans horaire ensuite</span>
      </div>
      {selectedTasks.size ? <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-violet-300 bg-[#2E1065] px-4 py-3 text-white shadow-lg"><span className="mr-auto text-xs font-black">{selectedTasks.size} tâche{selectedTasks.size > 1 ? "s" : ""} sélectionnée{selectedTasks.size > 1 ? "s" : ""}</span><button onClick={() => void onBulk("complete")} className="rounded-lg bg-emerald-500 px-3 py-2 text-[10px] font-black">Marquer terminées</button><button onClick={() => void onBulk("reschedule")} className="rounded-lg border border-white/30 px-3 py-2 text-[10px] font-black">Replanifier</button><button onClick={() => void onBulk("delete")} className="rounded-lg bg-red-500 px-3 py-2 text-[10px] font-black">Supprimer</button></div> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1150px] text-left text-xs">
          <thead className="bg-[#FAF9F7] text-[10px] uppercase tracking-wide text-[#8B7AA8]"><tr><th className="w-10 p-3"><input aria-label="Tout sélectionner" type="checkbox" checked={allSelected} onChange={() => onSelectAll(allSelected ? [] : sorted.map((task) => task.id))} className="h-4 w-4 accent-[#7C3AED]" /></th><th className="w-12 p-3">#</th><th className="w-12 p-3">Fait</th><th className="w-20 p-3">Heure</th><th className="p-3">Action</th><th className="p-3">Prospect</th><th className="p-3">Ville</th><th className="p-3">Contact rapide</th><th className="p-3">Description</th><th className="p-3 text-right">Actions</th></tr></thead>
          <tbody>
            <TaskRows tasks={timed} startIndex={0} returnTo={returnTo} completing={completing} selectedTasks={selectedTasks} onToggleSelection={onToggleSelection} onComplete={onComplete} onDelete={onDelete} onReschedule={onReschedule} />
            {untimed.length ? <tr className="border-t-2 border-[#E8E4DB] bg-[#FAF9F7]"><td colSpan={10} className="px-3 py-2 text-[10px] font-black uppercase tracking-[.12em] text-[#8B7AA8]">Sans horaire</td></tr> : null}
            <TaskRows tasks={untimed} startIndex={timed.length} returnTo={returnTo} completing={completing} selectedTasks={selectedTasks} onToggleSelection={onToggleSelection} onComplete={onComplete} onDelete={onDelete} onReschedule={onReschedule} />
          </tbody>
        </table>
        {!sorted.length ? <div className="p-12 text-center"><div className="text-2xl">✓</div><div className="mt-2 text-sm font-black text-[#2E1065]">Journée à jour</div><p className="mt-1 text-xs font-semibold text-[#8B7AA8]">Aucune tâche active pour cette date.</p></div> : null}
      </div>
    </section>
  </div>;
}

function TaskRows({ tasks, startIndex, returnTo, completing, selectedTasks, onToggleSelection, onComplete, onDelete, onReschedule }: {
  tasks: CrmTask[];
  startIndex: number;
  returnTo: string;
  completing: Set<string>;
  selectedTasks: Set<string>;
  onToggleSelection: (id: string) => void;
  onComplete: (task: CrmTask) => void;
  onDelete: (id: string) => void;
  onReschedule: (task: CrmTask) => void;
}) {
  return <>{tasks.map((task, index) => {
    const lead = task.crm_leads;
    const isCompleting = completing.has(task.id);
    return <tr key={task.id} className={`border-t border-[#EEEAE3] transition hover:bg-[#FCFBF9] ${isCompleting ? "opacity-50" : ""}`}>
      <td className="p-3"><input aria-label={`Sélectionner ${task.title}`} type="checkbox" checked={selectedTasks.has(task.id)} onChange={() => onToggleSelection(task.id)} className="h-4 w-4 accent-[#7C3AED]" /></td>
      <td className="p-3 font-black text-[#8B7AA8]">{startIndex + index + 1}</td>
      <td className="p-3"><input aria-label={`Terminer ${task.title}`} type="checkbox" checked={isCompleting} disabled={isCompleting} onChange={() => void onComplete(task)} className="h-4 w-4 accent-[#7C3AED]" /></td>
      <td className="p-3 font-black text-[#2E1065]">{task.due_time?.slice(0, 5) ?? "—"}</td>
      <td className="p-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${task.type === "Appel" ? "bg-amber-50 text-amber-800" : "bg-sky-50 text-sky-800"}`}>{task.type}</span><div className="mt-1 font-black">{task.title}</div></td>
      <td className="p-3"><Link href={`/crm/leads/${task.lead_id}?returnTo=${encodeURIComponent(returnTo)}`} className="font-black text-[#4C1D95] hover:underline">{lead?.name ?? "Ouvrir le prospect"}</Link></td>
      <td className="p-3 font-semibold">{lead?.city ?? "—"}</td>
      <td className="p-3"><div className="flex flex-wrap gap-2">{lead?.phone ? <a href={`tel:${lead.phone}`} className="rounded-md bg-[#2E1065] px-2.5 py-1.5 text-[10px] font-black text-white">Appeler</a> : null}{lead?.email ? <a href={`mailto:${lead.email}`} className="rounded-md border border-[#D8D0E5] px-2.5 py-1.5 text-[10px] font-black text-[#4C1D95]">Email</a> : null}{!lead?.phone && !lead?.email ? <span className="text-[#8B7AA8]">—</span> : null}</div></td>
      <td className="max-w-[260px] p-3 text-[#6B617F]">{task.description ?? "—"}</td>
      <td className="p-3"><div className="flex justify-end gap-3"><button onClick={() => void onReschedule(task)} className="text-[10px] font-black text-[#4C1D95]">Replanifier</button><button onClick={() => void onDelete(task.id)} className="text-[10px] font-black text-red-600">Supprimer</button></div></td>
    </tr>;
  })}</>;
}

function Metric({ value, label, accent = false }: { value: number; label: string; accent?: boolean }) {
  return <div className={`min-w-[72px] rounded-lg px-3 py-2 ${accent ? "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white" : "bg-[#F3F0EB] text-[#2E1065]"}`}><div className="text-lg font-black">{value}</div><div className={`text-[9px] font-black uppercase tracking-wide ${accent ? "text-white/75" : "text-[#8B7AA8]"}`}>{label}</div></div>;
}

function PlannerSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="ao-label">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="ao-select mt-1 h-9 px-2"><option value="">Tous</option>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function PresenceSelect({ label, value, onChange }: { label: string; value: Presence; onChange: (value: Presence) => void }) {
  return <label className="ao-label">{label}<select value={value} onChange={(event) => onChange(event.target.value as Presence)} className="ao-select mt-1 h-9 px-2"><option value="all">Tous</option><option value="yes">Oui</option><option value="no">Non</option></select></label>;
}
