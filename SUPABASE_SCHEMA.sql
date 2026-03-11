-- Alibi (initial) Supabase schema
-- Run this in Supabase SQL editor.
-- Assumptions:
-- - You will use Supabase Auth; every row is owned by a user.
-- - RLS is enabled so anon/client keys can be safe later.
-- - For now you can still operate server-side with the Service Role key.

-- Extensions
create extension if not exists pgcrypto;

-- Helper trigger to maintain updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'standard' check (type in ('standard', 'book')),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Book-specific structured fields (optional, safe defaults)
  book_brief jsonb,
  book_settings jsonb
);

create index if not exists projects_user_id_idx on public.projects(user_id);
create index if not exists projects_updated_at_idx on public.projects(updated_at desc);

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

-- Entries (captures)
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  title text not null,
  kind text not null check (kind in ('voice', 'text', 'import')),
  status text not null default 'captured' check (status in ('captured', 'processing', 'extracted')),

  intent text,
  target_format text check (target_format in ('essay', 'commentary', 'podcast-outline', 'script', 'thread', 'book-chapter')),

  duration_sec integer,

  transcript text,
  highlights text[],
  themes text[],
  ideas jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists entries_user_id_idx on public.entries(user_id);
create index if not exists entries_created_at_idx on public.entries(created_at desc);
create index if not exists entries_status_idx on public.entries(status);

drop trigger if exists trg_entries_updated_at on public.entries;
create trigger trg_entries_updated_at
before update on public.entries
for each row execute function public.set_updated_at();

-- Project ↔ Entries (allows one entry to belong to multiple projects later)
create table if not exists public.project_entries (
  project_id uuid not null references public.projects(id) on delete cascade,
  entry_id uuid not null references public.entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, entry_id)
);

create index if not exists project_entries_user_id_idx on public.project_entries(user_id);
create index if not exists project_entries_project_id_idx on public.project_entries(project_id);

-- Drafts (outputs)
create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,

  title text not null,
  format text not null check (format in ('essay', 'commentary', 'podcast-outline', 'script', 'thread', 'book-chapter')),
  tone text not null default 'neutral' check (tone in ('neutral', 'reflective', 'funny', 'serious')),
  distance text not null default 'close' check (distance in ('close', 'expand', 'invent')),

  content text not null,
  version integer not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists drafts_user_id_idx on public.drafts(user_id);
create index if not exists drafts_project_id_idx on public.drafts(project_id);
create index if not exists drafts_updated_at_idx on public.drafts(updated_at desc);

drop trigger if exists trg_drafts_updated_at on public.drafts;
create trigger trg_drafts_updated_at
before update on public.drafts
for each row execute function public.set_updated_at();

-- Draft ↔ Entries (provenance)
create table if not exists public.draft_entries (
  draft_id uuid not null references public.drafts(id) on delete cascade,
  entry_id uuid not null references public.entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (draft_id, entry_id)
);

create index if not exists draft_entries_user_id_idx on public.draft_entries(user_id);
create index if not exists draft_entries_draft_id_idx on public.draft_entries(draft_id);

-- Canon cards (project-scoped structured truth)
create table if not exists public.canon_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,

  kind text not null check (kind in ('character', 'world', 'theme', 'claim', 'timeline')),
  title text not null,
  detail text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists canon_cards_user_id_idx on public.canon_cards(user_id);
create index if not exists canon_cards_project_id_idx on public.canon_cards(project_id);

drop trigger if exists trg_canon_cards_updated_at on public.canon_cards;
create trigger trg_canon_cards_updated_at
before update on public.canon_cards
for each row execute function public.set_updated_at();

-- Outline items (project-scoped)
create table if not exists public.outline_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,

  title text not null,
  note text,
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists outline_items_user_id_idx on public.outline_items(user_id);
create index if not exists outline_items_project_id_idx on public.outline_items(project_id);

drop trigger if exists trg_outline_items_updated_at on public.outline_items;
create trigger trg_outline_items_updated_at
before update on public.outline_items
for each row execute function public.set_updated_at();

-- =====================
-- RLS (Row Level Security)
-- =====================
alter table public.projects enable row level security;
alter table public.entries enable row level security;
alter table public.project_entries enable row level security;
alter table public.drafts enable row level security;
alter table public.draft_entries enable row level security;
alter table public.canon_cards enable row level security;
alter table public.outline_items enable row level security;

-- Projects policies
drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own" on public.projects
for select using (auth.uid() = user_id);

drop policy if exists "projects_write_own" on public.projects;
create policy "projects_write_own" on public.projects
for insert with check (auth.uid() = user_id);

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own" on public.projects
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own" on public.projects
for delete using (auth.uid() = user_id);

-- Entries policies
drop policy if exists "entries_select_own" on public.entries;
create policy "entries_select_own" on public.entries
for select using (auth.uid() = user_id);

drop policy if exists "entries_write_own" on public.entries;
create policy "entries_write_own" on public.entries
for insert with check (auth.uid() = user_id);

drop policy if exists "entries_update_own" on public.entries;
create policy "entries_update_own" on public.entries
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "entries_delete_own" on public.entries;
create policy "entries_delete_own" on public.entries
for delete using (auth.uid() = user_id);

-- Join tables policies (keep user_id aligned)
drop policy if exists "project_entries_select_own" on public.project_entries;
create policy "project_entries_select_own" on public.project_entries
for select using (auth.uid() = user_id);

drop policy if exists "project_entries_write_own" on public.project_entries;
create policy "project_entries_write_own" on public.project_entries
for insert with check (auth.uid() = user_id);

drop policy if exists "project_entries_delete_own" on public.project_entries;
create policy "project_entries_delete_own" on public.project_entries
for delete using (auth.uid() = user_id);

-- Drafts policies
drop policy if exists "drafts_select_own" on public.drafts;
create policy "drafts_select_own" on public.drafts
for select using (auth.uid() = user_id);

drop policy if exists "drafts_write_own" on public.drafts;
create policy "drafts_write_own" on public.drafts
for insert with check (auth.uid() = user_id);

drop policy if exists "drafts_update_own" on public.drafts;
create policy "drafts_update_own" on public.drafts
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "drafts_delete_own" on public.drafts;
create policy "drafts_delete_own" on public.drafts
for delete using (auth.uid() = user_id);

-- Draft entries join policies
drop policy if exists "draft_entries_select_own" on public.draft_entries;
create policy "draft_entries_select_own" on public.draft_entries
for select using (auth.uid() = user_id);

drop policy if exists "draft_entries_write_own" on public.draft_entries;
create policy "draft_entries_write_own" on public.draft_entries
for insert with check (auth.uid() = user_id);

drop policy if exists "draft_entries_delete_own" on public.draft_entries;
create policy "draft_entries_delete_own" on public.draft_entries
for delete using (auth.uid() = user_id);

-- Canon cards policies
drop policy if exists "canon_cards_select_own" on public.canon_cards;
create policy "canon_cards_select_own" on public.canon_cards
for select using (auth.uid() = user_id);

drop policy if exists "canon_cards_write_own" on public.canon_cards;
create policy "canon_cards_write_own" on public.canon_cards
for insert with check (auth.uid() = user_id);

drop policy if exists "canon_cards_update_own" on public.canon_cards;
create policy "canon_cards_update_own" on public.canon_cards
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "canon_cards_delete_own" on public.canon_cards;
create policy "canon_cards_delete_own" on public.canon_cards
for delete using (auth.uid() = user_id);

-- Outline items policies
drop policy if exists "outline_items_select_own" on public.outline_items;
create policy "outline_items_select_own" on public.outline_items
for select using (auth.uid() = user_id);

drop policy if exists "outline_items_write_own" on public.outline_items;
create policy "outline_items_write_own" on public.outline_items
for insert with check (auth.uid() = user_id);

drop policy if exists "outline_items_update_own" on public.outline_items;
create policy "outline_items_update_own" on public.outline_items
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "outline_items_delete_own" on public.outline_items;
create policy "outline_items_delete_own" on public.outline_items
for delete using (auth.uid() = user_id);
