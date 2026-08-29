-- AtriumOne CRM V2 — additive and idempotent migration.
-- Preserves every V1 table, lead, task, appointment and AtriumOne account.

alter table public.crm_searches add column if not exists google_result_count integer not null default 0;
alter table public.crm_searches add column if not exists pages_fetched integer not null default 0;

do $$
declare
  status_constraint text;
begin
  for status_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.crm_leads'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%commercial_status%'
  loop
    execute format('alter table public.crm_leads drop constraint %I', status_constraint);
  end loop;

  alter table public.crm_leads
    add constraint crm_leads_commercial_status_check
    check (commercial_status in ('Nouveau', 'À appeler', 'Appelé', 'Contacté', 'À relancer', 'RDV pris', 'Démo réalisée', 'Test AtriumOne', 'Proposition envoyée', 'En négociation', 'Signé', 'Client', 'Perdu', 'À revoir plus tard'));
end $$;

create table if not exists public.crm_search_leads (
  search_id uuid not null references public.crm_searches(id) on delete cascade,
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (search_id, lead_id)
);
create index if not exists crm_search_leads_lead_idx on public.crm_search_leads (lead_id, search_id);

create table if not exists public.crm_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  title text not null,
  type text not null check (type in ('Appel effectué', 'R1', 'R2', 'R3', 'Point de suivi', 'Autre')),
  event_date date not null,
  event_time time,
  duration_minutes integer check (duration_minutes is null or duration_minutes between 5 and 1440),
  call_result text check (call_result is null or call_result in ('Pas de réponse', 'À rappeler', 'Intéressé', 'Pas intéressé', 'RDV obtenu', 'Mauvais contact', 'Autre')),
  notes text,
  result text,
  source_appointment_id uuid unique references public.crm_appointments(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_events_date_idx on public.crm_events (event_date, event_time);
create index if not exists crm_events_lead_created_idx on public.crm_events (lead_id, created_at desc);
create index if not exists crm_events_type_date_idx on public.crm_events (type, event_date);

create table if not exists public.crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  name text not null,
  status text not null default 'Ouverte' check (status in ('Ouverte', 'Qualification', 'Proposition', 'Négociation', 'Gagnée', 'Perdue')),
  mrr numeric(14,2) not null default 0 check (mrr >= 0),
  arr numeric(14,2) generated always as (mrr * 12) stored,
  closed_at timestamptz,
  lost_at timestamptz,
  lost_reason text,
  notes text,
  legacy_signed_backfill boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists crm_opportunities_legacy_signed_unique
  on public.crm_opportunities (lead_id) where legacy_signed_backfill;
create index if not exists crm_opportunities_pipeline_idx on public.crm_opportunities (status, created_at desc);
create index if not exists crm_opportunities_lead_idx on public.crm_opportunities (lead_id, created_at desc);

drop trigger if exists set_crm_events_updated_at on public.crm_events;
create trigger set_crm_events_updated_at before update on public.crm_events
for each row execute function public.set_crm_updated_at();

drop trigger if exists set_crm_opportunities_updated_at on public.crm_opportunities;
create trigger set_crm_opportunities_updated_at before update on public.crm_opportunities
for each row execute function public.set_crm_updated_at();

create or replace function public.log_crm_v2_activity()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_lead_id uuid;
  event_type text;
  details jsonb;
begin
  if tg_table_name = 'crm_search_leads' then
    target_lead_id := new.lead_id;
    event_type := 'search_source_added';
    select jsonb_build_object('search_id', new.search_id, 'city', city, 'business_type', business_type)
      into details from public.crm_searches where id = new.search_id;
  elsif tg_table_name = 'crm_events' then
    target_lead_id := coalesce(new.lead_id, old.lead_id);
    if tg_op = 'DELETE' then event_type := 'event_deleted'; details := jsonb_build_object('type', old.type, 'title', old.title);
    elsif tg_op = 'INSERT' then event_type := case new.type when 'Appel effectué' then 'call_completed' when 'R1' then 'r1_completed' when 'R2' then 'r2_completed' when 'R3' then 'r3_completed' when 'Point de suivi' then 'followup_completed' else 'event_created' end; details := jsonb_build_object('event_id', new.id, 'type', new.type, 'title', new.title, 'result', coalesce(new.call_result, new.result), 'event_date', new.event_date);
    else event_type := 'event_updated'; details := jsonb_build_object('event_id', new.id, 'type', new.type, 'title', new.title); end if;
  elsif tg_table_name = 'crm_opportunities' then
    target_lead_id := coalesce(new.lead_id, old.lead_id);
    if tg_op = 'DELETE' then event_type := 'opportunity_deleted'; details := jsonb_build_object('name', old.name);
    elsif tg_op = 'INSERT' then event_type := 'opportunity_created'; details := jsonb_build_object('opportunity_id', new.id, 'name', new.name, 'status', new.status, 'mrr', new.mrr, 'arr', new.arr);
    elsif new.status is distinct from old.status then
      event_type := case new.status when 'Gagnée' then 'deal_won' when 'Perdue' then 'deal_lost' else 'opportunity_status_changed' end;
      details := jsonb_build_object('opportunity_id', new.id, 'name', new.name, 'from', old.status, 'to', new.status, 'mrr', new.mrr, 'arr', new.arr, 'lost_reason', new.lost_reason);
    else event_type := 'opportunity_updated'; details := jsonb_build_object('opportunity_id', new.id, 'name', new.name, 'mrr', new.mrr, 'arr', new.arr); end if;
  else
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  insert into public.crm_activity (lead_id, type, metadata, created_by)
  values (target_lead_id, event_type, coalesce(details, '{}'::jsonb), auth.uid());
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists log_crm_search_lead_activity on public.crm_search_leads;
create trigger log_crm_search_lead_activity after insert on public.crm_search_leads
for each row execute function public.log_crm_v2_activity();
drop trigger if exists log_crm_event_activity on public.crm_events;
create trigger log_crm_event_activity after insert or update or delete on public.crm_events
for each row execute function public.log_crm_v2_activity();
drop trigger if exists log_crm_opportunity_activity on public.crm_opportunities;
create trigger log_crm_opportunity_activity after insert or update or delete on public.crm_opportunities
for each row execute function public.log_crm_v2_activity();

-- Backfill V1 search results through their stable Google Place ID or stored lead reference.
insert into public.crm_search_leads (search_id, lead_id)
select distinct s.id, l.id
from public.crm_searches s
cross join lateral jsonb_array_elements(coalesce(s.results, '[]'::jsonb)) result
join public.crm_leads l on
  (nullif(result ->> 'placeId', '') is not null and l.google_place_id = result ->> 'placeId')
  or (nullif(result ->> 'existingLeadId', '') is not null and l.id::text = result ->> 'existingLeadId')
where l.deleted_at is null
on conflict on constraint crm_search_leads_pkey do nothing;

update public.crm_searches s
set imported_count = relation_count.count,
    google_result_count = greatest(s.google_result_count, s.result_count),
    pages_fetched = greatest(s.pages_fetched, case when s.result_count > 0 then ceil(s.result_count / 20.0)::integer else 0 end)
from (select search_id, count(*)::integer as count from public.crm_search_leads group by search_id) relation_count
where s.id = relation_count.search_id;

-- Preserve V1 appointments and expose them as V2 commercial events.
insert into public.crm_events (lead_id, title, type, event_date, event_time, duration_minutes, notes, result, source_appointment_id, created_by, created_at, updated_at)
select a.lead_id,
       concat(case a.type when 'Premier échange' then 'R1' when 'Démo AtriumOne' then 'R2' when 'Closing' then 'R3' else 'Point de suivi' end, ' - AtriumOne x ', l.name),
       case a.type when 'Premier échange' then 'R1' when 'Démo AtriumOne' then 'R2' when 'Closing' then 'R3' else 'Point de suivi' end,
       a.appointment_date, a.appointment_time, a.duration_minutes, a.notes, a.result, a.id, a.created_by, a.created_at, a.updated_at
from public.crm_appointments a
join public.crm_leads l on l.id = a.lead_id
on conflict (source_appointment_id) do nothing;

-- Convert historical signed leads with revenue into one won opportunity.
insert into public.crm_opportunities (lead_id, name, status, mrr, closed_at, notes, legacy_signed_backfill, created_at, updated_at)
select l.id, concat('AtriumOne - ', l.name), 'Gagnée', coalesce(l.mrr, l.monthly_value, 0), coalesce(l.signed_at::timestamptz, l.updated_at), l.signed_comment, true, l.created_at, l.updated_at
from public.crm_leads l
where l.commercial_status in ('Signé', 'Client')
  and coalesce(l.mrr, l.monthly_value, 0) > 0
on conflict (lead_id) where legacy_signed_backfill do nothing;

create or replace function public.delete_crm_search_with_exclusive_leads(target_search_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  exclusive_lead_ids uuid[];
  removed_searches integer := 0;
  removed_leads integer := 0;
  removed_relations integer := 0;
begin
  if not public.is_atriumone_crm_admin() then raise exception 'CRM_FORBIDDEN' using errcode = '42501'; end if;

  select count(*)::integer into removed_relations from public.crm_search_leads where search_id = target_search_id;
  select array_agg(sl.lead_id) into exclusive_lead_ids
  from public.crm_search_leads sl
  join public.crm_leads l on l.id = sl.lead_id
  where sl.search_id = target_search_id
    and l.lead_source = 'Google Prospection'
    and not exists (
      select 1 from public.crm_search_leads other
      where other.lead_id = sl.lead_id and other.search_id <> target_search_id
    );

  delete from public.crm_searches where id = target_search_id;
  get diagnostics removed_searches = row_count;

  if exclusive_lead_ids is not null then
    delete from public.crm_leads where id = any(exclusive_lead_ids);
    get diagnostics removed_leads = row_count;
  end if;

  return jsonb_build_object('deletedSearches', removed_searches, 'deletedLeads', removed_leads, 'deletedRelations', removed_relations);
end;
$$;

create or replace function public.close_crm_opportunity(target_opportunity_id uuid, target_status text, target_lost_reason text default null)
returns setof public.crm_opportunities
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  opportunity_row public.crm_opportunities%rowtype;
  previous_lead_status text;
begin
  if not public.is_atriumone_crm_admin() then raise exception 'CRM_FORBIDDEN' using errcode = '42501'; end if;
  if target_status not in ('Gagnée', 'Perdue') then raise exception 'INVALID_OPPORTUNITY_STATUS' using errcode = '22023'; end if;

  select * into opportunity_row from public.crm_opportunities where id = target_opportunity_id for update;
  if not found then raise exception 'OPPORTUNITY_NOT_FOUND' using errcode = 'P0002'; end if;

  update public.crm_opportunities
  set status = target_status,
      closed_at = now(),
      lost_at = case when target_status = 'Perdue' then now() else null end,
      lost_reason = case when target_status = 'Perdue' then nullif(target_lost_reason, '') else null end
  where id = target_opportunity_id
  returning * into opportunity_row;

  if target_status = 'Gagnée' then
    select commercial_status into previous_lead_status from public.crm_leads where id = opportunity_row.lead_id;
    update public.crm_leads
    set commercial_status = 'Client',
        signed_at = coalesce(signed_at, current_date),
        monthly_value = opportunity_row.mrr,
        mrr = opportunity_row.mrr
    where id = opportunity_row.lead_id;
    if previous_lead_status is distinct from 'Client' then
      insert into public.crm_activity (lead_id, type, metadata, created_by)
      values (opportunity_row.lead_id, 'prospect_became_client', jsonb_build_object('opportunity_id', opportunity_row.id), auth.uid());
    end if;
  end if;

  return next opportunity_row;
end;
$$;

alter table public.crm_search_leads enable row level security;
alter table public.crm_events enable row level security;
alter table public.crm_opportunities enable row level security;

drop policy if exists crm_admin_search_leads_all on public.crm_search_leads;
create policy crm_admin_search_leads_all on public.crm_search_leads for all to authenticated
using (public.is_atriumone_crm_admin()) with check (public.is_atriumone_crm_admin());
drop policy if exists crm_admin_events_all on public.crm_events;
create policy crm_admin_events_all on public.crm_events for all to authenticated
using (public.is_atriumone_crm_admin()) with check (public.is_atriumone_crm_admin());
drop policy if exists crm_admin_opportunities_all on public.crm_opportunities;
create policy crm_admin_opportunities_all on public.crm_opportunities for all to authenticated
using (public.is_atriumone_crm_admin()) with check (public.is_atriumone_crm_admin());

grant select, insert, update, delete on public.crm_search_leads, public.crm_events, public.crm_opportunities to authenticated, service_role;
revoke all on function public.delete_crm_search_with_exclusive_leads(uuid) from public;
revoke all on function public.close_crm_opportunity(uuid, text, text) from public;
grant execute on function public.delete_crm_search_with_exclusive_leads(uuid) to authenticated, service_role;
grant execute on function public.close_crm_opportunity(uuid, text, text) to authenticated, service_role;
revoke execute on function public.delete_crm_search_with_exclusive_leads(uuid) from anon;
revoke execute on function public.close_crm_opportunity(uuid, text, text) from anon;
