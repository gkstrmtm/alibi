-- Alibi (initial) Supabase schema
-- Run this in Supabase SQL editor.
-- Assumptions:
-- - You will use Supabase Auth; every row is owned by a user.
-- - RLS is enabled so anon/client keys can be safe later.
-- - For now you can still operate server-side with the Service Role key.
--
-- Notes when re-running on an existing DB:
-- - This script is mostly idempotent. The main thing that can fail is enforcing
--   the V1 invariant “one entry belongs to at most one project” (unique entry_id
--   in project_entries). If you previously allowed multi-project membership,
--   resolve duplicates first:
--     select entry_id, count(*) from public.project_entries group by entry_id having count(*) > 1;

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

-- User profiles (identity + account metadata)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null default 'Unnamed user',
  handle text,
  testing_label text,
  output_visibility text default 'private',
  workflow_focus text default 'studio',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  constraint profiles_display_name_not_blank check (length(btrim(display_name)) > 0),
  constraint profiles_output_visibility_check check (output_visibility in ('private', 'public')),
  constraint profiles_workflow_focus_check check (workflow_focus in ('studio', 'vault', 'projects', 'mixed'))
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists handle text;
alter table public.profiles add column if not exists testing_label text;
alter table public.profiles add column if not exists output_visibility text default 'private';
alter table public.profiles add column if not exists workflow_focus text default 'studio';
alter table public.profiles add column if not exists last_seen_at timestamptz not null default now();

update public.profiles
set display_name = 'Unnamed user'
where display_name is null or length(btrim(display_name)) = 0;

alter table public.profiles alter column display_name set default 'Unnamed user';
alter table public.profiles alter column display_name set not null;
alter table public.profiles alter column output_visibility set default 'private';
alter table public.profiles alter column workflow_focus set default 'studio';

update public.profiles
set output_visibility = 'private'
where output_visibility is null or output_visibility not in ('private', 'public');

update public.profiles
set workflow_focus = 'studio'
where workflow_focus is null or workflow_focus not in ('studio', 'vault', 'projects', 'mixed');

do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and (
        conname = 'profiles_output_visibility_check'
        or conname = 'profiles_workflow_focus_check'
      )
  loop
    execute format('alter table public.profiles drop constraint if exists %I', c.conname);
  end loop;

  alter table public.profiles
    add constraint profiles_output_visibility_check
    check (output_visibility in ('private', 'public'));

  alter table public.profiles
    add constraint profiles_workflow_focus_check
    check (workflow_focus in ('studio', 'vault', 'projects', 'mixed'));
end;
$$;

create index if not exists profiles_handle_idx on public.profiles(handle);
create index if not exists profiles_updated_at_idx on public.profiles(updated_at desc);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, handle, last_seen_at)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(coalesce(new.email, ''), '@', 1), 'Unnamed user'),
    nullif(lower(trim(new.raw_user_meta_data->>'handle')), ''),
    now()
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(nullif(trim(excluded.display_name), ''), public.profiles.display_name),
        handle = coalesce(excluded.handle, public.profiles.handle),
        last_seen_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

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

-- Composite uniqueness to allow (id,user_id) foreign keys from join tables.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'projects_id_user_id_uniq'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects add constraint projects_id_user_id_uniq unique (id, user_id);
  end if;
end;
$$;

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
  kind text not null check (kind in ('voice', 'text', 'import', 'upload', 'video')),
  status text not null default 'captured' check (status in ('captured', 'processing', 'extracted')),

  intent text,
  intake_key text check (intake_key in ('make', 'forWho', 'rules')),
  target_format text check (target_format in ('essay', 'commentary', 'podcast-outline', 'script', 'thread', 'book-chapter')),

  duration_sec integer,

  -- Generic media reference (preferred for uploads; actual bytes live in Storage)
  media_bucket text,
  media_path text,
  media_filename text,
  media_size_bytes bigint,
  media_sha256 text,
  media_mime_type text,

  -- Optional audio metadata (actual audio should live in Storage)
  audio_uri text,
  audio_mime_type text,

  transcript text,
  highlights text[],
  themes text[],
  ideas jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- In case entries already existed before audio columns were added.
alter table public.entries add column if not exists audio_uri text;
alter table public.entries add column if not exists audio_mime_type text;
alter table public.entries add column if not exists intake_key text;

-- In case entries already existed before media reference columns were added.
alter table public.entries add column if not exists media_bucket text;
alter table public.entries add column if not exists media_path text;
alter table public.entries add column if not exists media_filename text;
alter table public.entries add column if not exists media_size_bytes bigint;
alter table public.entries add column if not exists media_sha256 text;
alter table public.entries add column if not exists media_mime_type text;

-- Normalize the entries.kind check constraint for existing DBs.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.entries'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%kind%in%'
  loop
    execute format('alter table public.entries drop constraint if exists %I', c.conname);
  end loop;

  if not exists (
    select 1 from pg_constraint
    where conname = 'entries_kind_check'
      and conrelid = 'public.entries'::regclass
  ) then
    alter table public.entries
      add constraint entries_kind_check
      check (kind in ('voice', 'text', 'import', 'upload', 'video'));
  end if;
end;
$$;

-- Composite uniqueness to allow (id,user_id) foreign keys from join tables.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'entries_id_user_id_uniq'
      and conrelid = 'public.entries'::regclass
  ) then
    alter table public.entries add constraint entries_id_user_id_uniq unique (id, user_id);
  end if;
end;
$$;

create index if not exists entries_user_id_idx on public.entries(user_id);
create index if not exists entries_created_at_idx on public.entries(created_at desc);
create index if not exists entries_status_idx on public.entries(status);
create index if not exists entries_intake_key_idx on public.entries(intake_key);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'entries_intake_key_check'
      and conrelid = 'public.entries'::regclass
  ) then
    alter table public.entries
      add constraint entries_intake_key_check
      check (intake_key is null or intake_key in ('make', 'forWho', 'rules'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'entries_ideas_json_array_check'
      and conrelid = 'public.entries'::regclass
  ) then
    alter table public.entries
      add constraint entries_ideas_json_array_check
      check (ideas is null or jsonb_typeof(ideas) = 'array');
  end if;
end;
$$;

drop trigger if exists trg_entries_updated_at on public.entries;
create trigger trg_entries_updated_at
before update on public.entries
for each row execute function public.set_updated_at();

-- Project ↔ Entries
-- V1 invariant: one entry belongs to at most one project (enforced via unique(entry_id)).
create table if not exists public.project_entries (
  project_id uuid not null references public.projects(id) on delete cascade,
  entry_id uuid not null references public.entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, entry_id)
);

create index if not exists project_entries_user_id_idx on public.project_entries(user_id);
create index if not exists project_entries_project_id_idx on public.project_entries(project_id);

-- Enforce the app's single-project membership invariant (one entry → one project).
create unique index if not exists project_entries_entry_id_unique_idx on public.project_entries(entry_id);

-- Enforce ownership alignment: the (project_id,user_id) and (entry_id,user_id)
-- pairs must exist, which prevents cross-user linking even if an ID is guessed.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'project_entries_project_user_fk'
      and conrelid = 'public.project_entries'::regclass
  ) then
    alter table public.project_entries
      add constraint project_entries_project_user_fk
      foreign key (project_id, user_id)
      references public.projects(id, user_id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'project_entries_entry_user_fk'
      and conrelid = 'public.project_entries'::regclass
  ) then
    alter table public.project_entries
      add constraint project_entries_entry_user_fk
      foreign key (entry_id, user_id)
      references public.entries(id, user_id)
      on delete cascade;
  end if;
end;
$$;

-- Drafts (outputs)
create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,

  -- Optional linkage: which outline item (chapter/segment) this draft targets.
  target_outline_item_id uuid,

  title text not null,
  format text not null check (format in ('essay', 'commentary', 'podcast-outline', 'script', 'thread', 'book-chapter')),
  tone text not null default 'neutral' check (tone in ('neutral', 'reflective', 'funny', 'serious')),
  distance text not null default 'close' check (distance in ('close', 'expand', 'invent')),

  content text not null,
  version integer not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- In case drafts already existed before target_outline_item_id was added.
alter table public.drafts add column if not exists target_outline_item_id uuid;

-- Composite uniqueness to allow (id,user_id) foreign keys from join tables.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'drafts_id_user_id_uniq'
      and conrelid = 'public.drafts'::regclass
  ) then
    alter table public.drafts add constraint drafts_id_user_id_uniq unique (id, user_id);
  end if;
end;
$$;

-- If a draft references a project, ensure it's owned by the same user.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'drafts_project_user_fk'
      and conrelid = 'public.drafts'::regclass
  ) then
    alter table public.drafts
      add constraint drafts_project_user_fk
      foreign key (project_id, user_id)
      references public.projects(id, user_id)
      on delete set null;
  end if;
end;
$$;

create index if not exists drafts_user_id_idx on public.drafts(user_id);
create index if not exists drafts_project_id_idx on public.drafts(project_id);
create index if not exists drafts_updated_at_idx on public.drafts(updated_at desc);
create index if not exists drafts_target_outline_item_id_idx on public.drafts(target_outline_item_id);

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

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'draft_entries_draft_user_fk'
      and conrelid = 'public.draft_entries'::regclass
  ) then
    alter table public.draft_entries
      add constraint draft_entries_draft_user_fk
      foreign key (draft_id, user_id)
      references public.drafts(id, user_id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'draft_entries_entry_user_fk'
      and conrelid = 'public.draft_entries'::regclass
  ) then
    alter table public.draft_entries
      add constraint draft_entries_entry_user_fk
      foreign key (entry_id, user_id)
      references public.entries(id, user_id)
      on delete cascade;
  end if;
end;
$$;

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

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'canon_cards_project_user_fk'
      and conrelid = 'public.canon_cards'::regclass
  ) then
    alter table public.canon_cards
      add constraint canon_cards_project_user_fk
      foreign key (project_id, user_id)
      references public.projects(id, user_id)
      on delete cascade;
  end if;
end;
$$;

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

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'outline_items_id_project_user_uniq'
      and conrelid = 'public.outline_items'::regclass
  ) then
    alter table public.outline_items
      add constraint outline_items_id_project_user_uniq unique (id, project_id, user_id);
  end if;
end;
$$;

drop trigger if exists trg_outline_items_updated_at on public.outline_items;
create trigger trg_outline_items_updated_at
before update on public.outline_items
for each row execute function public.set_updated_at();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'outline_items_project_user_fk'
      and conrelid = 'public.outline_items'::regclass
  ) then
    alter table public.outline_items
      add constraint outline_items_project_user_fk
      foreign key (project_id, user_id)
      references public.projects(id, user_id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'drafts_target_outline_item_project_user_fk'
      and conrelid = 'public.drafts'::regclass
  ) then
    alter table public.drafts
      add constraint drafts_target_outline_item_project_user_fk
      foreign key (target_outline_item_id, project_id, user_id)
      references public.outline_items(id, project_id, user_id)
      on delete set null;
  end if;
end;
$$;

-- Public waitlist leads (prelaunch capture)
create table if not exists public.waitlist_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text,
  use_case text,
  beta_opt_in boolean not null default true,
  source text not null default 'prelaunch-app',
  metadata jsonb,
  created_at timestamptz not null default now(),

  constraint waitlist_leads_email_not_blank check (length(btrim(email)) > 4),
  constraint waitlist_leads_email_basic_check check (position('@' in email) > 1),
  constraint waitlist_leads_role_check check (role is null or role in ('creator', 'writer', 'founder', 'thinker', 'other')),
  constraint waitlist_leads_use_case_length check (use_case is null or length(btrim(use_case)) <= 800)
);

alter table public.waitlist_leads add column if not exists role text;
alter table public.waitlist_leads add column if not exists use_case text;
alter table public.waitlist_leads add column if not exists beta_opt_in boolean not null default true;
alter table public.waitlist_leads add column if not exists source text not null default 'prelaunch-app';
alter table public.waitlist_leads add column if not exists metadata jsonb;
alter table public.waitlist_leads add column if not exists created_at timestamptz not null default now();

update public.waitlist_leads
set email = lower(btrim(email))
where email is not null and email <> lower(btrim(email));

create unique index if not exists waitlist_leads_email_unique_idx on public.waitlist_leads(email);
create index if not exists waitlist_leads_created_at_idx on public.waitlist_leads(created_at desc);

do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.waitlist_leads'::regclass
      and contype = 'c'
  loop
    if c.conname in (
      'waitlist_leads_email_not_blank',
      'waitlist_leads_email_basic_check',
      'waitlist_leads_role_check',
      'waitlist_leads_use_case_length'
    ) then
      execute format('alter table public.waitlist_leads drop constraint if exists %I', c.conname);
    end if;
  end loop;

  alter table public.waitlist_leads
    add constraint waitlist_leads_email_not_blank
    check (length(btrim(email)) > 4);

  alter table public.waitlist_leads
    add constraint waitlist_leads_email_basic_check
    check (position('@' in email) > 1);

  alter table public.waitlist_leads
    add constraint waitlist_leads_role_check
    check (role is null or role in ('creator', 'writer', 'founder', 'thinker', 'other'));

  alter table public.waitlist_leads
    add constraint waitlist_leads_use_case_length
    check (use_case is null or length(btrim(use_case)) <= 800);
end;
$$;

-- =====================
-- RLS (Row Level Security)
-- =====================
alter table public.projects enable row level security;
alter table public.profiles enable row level security;
alter table public.entries enable row level security;
alter table public.project_entries enable row level security;
alter table public.drafts enable row level security;
alter table public.draft_entries enable row level security;
alter table public.canon_cards enable row level security;
alter table public.outline_items enable row level security;
alter table public.waitlist_leads enable row level security;

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

-- Profiles policies
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

drop policy if exists "profiles_write_own" on public.profiles;
create policy "profiles_write_own" on public.profiles
for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles
for delete using (auth.uid() = id);

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
for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  and exists (select 1 from public.entries e where e.id = entry_id and e.user_id = auth.uid())
);

drop policy if exists "project_entries_delete_own" on public.project_entries;
create policy "project_entries_delete_own" on public.project_entries
for delete using (auth.uid() = user_id);

drop policy if exists "project_entries_update_own" on public.project_entries;
create policy "project_entries_update_own" on public.project_entries
for update using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  and exists (select 1 from public.entries e where e.id = entry_id and e.user_id = auth.uid())
);

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
for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.drafts d where d.id = draft_id and d.user_id = auth.uid())
  and exists (select 1 from public.entries e where e.id = entry_id and e.user_id = auth.uid())
);

drop policy if exists "draft_entries_delete_own" on public.draft_entries;
create policy "draft_entries_delete_own" on public.draft_entries
for delete using (auth.uid() = user_id);

drop policy if exists "draft_entries_update_own" on public.draft_entries;
create policy "draft_entries_update_own" on public.draft_entries
for update using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (select 1 from public.drafts d where d.id = draft_id and d.user_id = auth.uid())
  and exists (select 1 from public.entries e where e.id = entry_id and e.user_id = auth.uid())
);

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

-- Public waitlist policies
drop policy if exists "waitlist_insert_public" on public.waitlist_leads;
create policy "waitlist_insert_public" on public.waitlist_leads
for insert
to anon, authenticated
with check (
  email = lower(btrim(email))
  and length(btrim(email)) > 4
  and position('@' in email) > 1
  and (role is null or role in ('creator', 'writer', 'founder', 'thinker', 'other'))
  and (use_case is null or length(btrim(use_case)) <= 800)
);

-- =====================
-- Optional: Storage for media uploads
-- =====================
-- This enables secure per-user uploads (audio/video/files) in a private bucket.
-- If you don't plan to use Supabase Storage yet, you can skip this section.
--
-- Bucket settings (Supabase Dashboard → Storage → Buckets → alibi-media → Settings):
-- - Keep it PRIVATE (not public).
-- - File size limit: set to something sane for your workflow (e.g. 100MB to start).
-- - Allowed MIME types: set to the minimum you need. A practical starting list:
--   audio/m4a,audio/mp4,audio/mpeg,audio/wav,audio/webm,video/mp4,video/quicktime,text/plain,text/markdown

do $$
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise notice 'Skipping Storage setup: storage schema tables not found. Enable Storage in Supabase (or skip this section).';
    return;
  end if;

  begin
    execute $bucket$
      insert into storage.buckets (id, name, public)
      values ('alibi-media', 'alibi-media', false)
      on conflict (id) do nothing
    $bucket$;
  exception when insufficient_privilege then
    raise notice 'Skipping Storage bucket creation: insufficient privilege. Create bucket alibi-media in Dashboard → Storage → Buckets.';
  end;

  -- NOTE: On Supabase-hosted projects, storage.objects is often owned by a managed role.
  -- If you see "must be owner of table objects", run this section as the DB owner (SQL editor "Run as" postgres)
  -- or create these policies via the Dashboard UI.
  begin
    execute $rls$alter table storage.objects enable row level security$rls$;

    execute $pdrop$drop policy if exists "alibi_media_read_own" on storage.objects$pdrop$;
    execute $pread$
      create policy "alibi_media_read_own" on storage.objects
      for select
      to authenticated
      using (bucket_id = 'alibi-media' and owner = auth.uid())
    $pread$;

    execute $pdrop$drop policy if exists "alibi_media_insert_own" on storage.objects$pdrop$;
    execute $pinsert$
      create policy "alibi_media_insert_own" on storage.objects
      for insert
      to authenticated
      with check (bucket_id = 'alibi-media' and owner = auth.uid())
    $pinsert$;

    execute $pdrop$drop policy if exists "alibi_media_update_own" on storage.objects$pdrop$;
    execute $pupdate$
      create policy "alibi_media_update_own" on storage.objects
      for update
      to authenticated
      using (bucket_id = 'alibi-media' and owner = auth.uid())
      with check (bucket_id = 'alibi-media' and owner = auth.uid())
    $pupdate$;

    execute $pdrop$drop policy if exists "alibi_media_delete_own" on storage.objects$pdrop$;
    execute $pdelete$
      create policy "alibi_media_delete_own" on storage.objects
      for delete
      to authenticated
      using (bucket_id = 'alibi-media' and owner = auth.uid())
    $pdelete$;
  exception when insufficient_privilege then
    raise notice 'Skipping Storage RLS/policies: insufficient privilege (must be owner of storage.objects). Configure these policies in Dashboard → Storage → Policies or run as postgres.';
  end;
end;
$$;
