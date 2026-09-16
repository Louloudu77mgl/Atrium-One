create extension if not exists pgcrypto;

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null default '',
  content text not null default '',
  cover_image_url text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  author_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists articles_publication_idx on public.articles (status, published_at desc);
alter table public.articles enable row level security;

drop policy if exists "Public articles are readable" on public.articles;
create policy "Public articles are readable" on public.articles for select
using (status = 'published' or lower(coalesce(auth.jwt() ->> 'email', '')) = 'louisdacre@gmail.com');

drop policy if exists "Louis can create articles" on public.articles;
create policy "Louis can create articles" on public.articles for insert to authenticated
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'louisdacre@gmail.com' and author_id = auth.uid());

drop policy if exists "Louis can update articles" on public.articles;
create policy "Louis can update articles" on public.articles for update to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'louisdacre@gmail.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'louisdacre@gmail.com');

drop policy if exists "Louis can delete articles" on public.articles;
create policy "Louis can delete articles" on public.articles for delete to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'louisdacre@gmail.com');

create or replace function public.set_article_updated_at() returns trigger
language plpgsql security invoker set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists set_article_updated_at on public.articles;
create trigger set_article_updated_at before update on public.articles
for each row execute function public.set_article_updated_at();

do $$
begin
  if to_regclass('public.crm_releases') is not null and not exists (
    select 1 from public.crm_releases where title = 'Publiez les articles AtriumOne depuis votre espace'
  ) then
    insert into public.crm_releases (title, summary, description, highlights, category, status, email_subject)
    values (
      'Publiez les articles AtriumOne depuis votre espace',
      'Un nouvel espace de rédaction permet de préparer et publier les articles du site public.',
      'Créez un brouillon, rédigez votre contenu, prévisualisez-le et choisissez quand le rendre visible sur atrium-one.fr.',
      '["Espace Articles réservé au compte administrateur", "Brouillons et publication depuis AtriumOne", "Affichage automatique sur le site public"]'::jsonb,
      'Contenu',
      'draft',
      'Nouveau : publiez vos articles depuis AtriumOne'
    );
  end if;
end $$;
