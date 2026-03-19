# Database production hardening

## What is now aligned

The database foundation now explicitly matches the current app model in these areas:

- per-user row ownership through `user_id`
- row-level security on core tables
- single-project membership for entries
- draft provenance tables
- private storage bucket policy design
- intake prompt answers persisted as `entries.intake_key`
- draft target outline integrity through a same-project foreign key

## What to verify in the live Supabase project

Run or confirm all of this before calling the backend production-ready.

### 1. Schema is applied

Apply [SUPABASE_SCHEMA.sql](SUPABASE_SCHEMA.sql) to the actual Supabase project.

Specifically verify that these objects exist:

- `public.projects`
- `public.entries`
- `public.project_entries`
- `public.drafts`
- `public.draft_entries`
- `public.canon_cards`
- `public.outline_items`

### 2. RLS is actually enabled

Do not assume the SQL file means the live DB matches it.

Confirm RLS is enabled on:

- `projects`
- `entries`
- `project_entries`
- `drafts`
- `draft_entries`
- `canon_cards`
- `outline_items`

### 3. Storage bucket exists and is private

Confirm bucket:

- `alibi-media`

And confirm:

- bucket is private
- object policies are restricted to authenticated owners
- uploads work with the authenticated client

### 4. App env is pointed at the real project

Verify these are set correctly in the running app environment:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

And verify Vercel/server env separately for AI routes.

## Current important limitation

The app is still **local-first** in practice.

That means some recordings can originate as local device files before becoming durable cloud media. If durable cross-device media is required for production, recordings must be uploaded into private storage as part of the canonical save path rather than relying on device-local `audio_uri`.

## Recommended next infrastructure steps

### Critical

1. Move schema changes into real migrations
2. Create separate Supabase projects for dev and production
3. Verify all auth + storage policies in the live project
4. Make recording media upload part of the default durable path
5. Add backup/export and recovery assumptions

### Strongly recommended

1. Add server-side audit logging for AI jobs and failures
2. Add retry-safe job handling for transcription/extraction
3. Add explicit sync conflict strategy for multi-device use
4. Add a lightweight `profiles` table if account metadata is needed beyond auth identity

## Bottom line

The schema design is now in better shape than before, but the actual production state still depends on applying and verifying it in the live Supabase project.