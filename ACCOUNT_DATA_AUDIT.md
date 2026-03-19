# Alibi account + data audit

## Current truth

Alibi is **local-first right now**.

That means:

- The app always keeps working data on-device in local storage.
- If Supabase is configured **and** the user signs in, that local state is then synced into Supabase.
- If Supabase is not configured or the user is signed out, the app is effectively single-device local storage only.

## Where data is stored right now

### 1. On-device app state

Primary runtime state lives in AsyncStorage through the app store provider.

- Local state key: `alibi.appState.v1`
- File: [src/store/store.tsx](src/store/store.tsx)

This includes:

- entries
- projects
- drafts
- settings
- auth snapshot
- sync status

### 2. Account/session state

Account/session state comes from Supabase Auth and is persisted through the Supabase client using AsyncStorage.

- File: [src/supabase/client.ts](src/supabase/client.ts)

Current auth behavior:

- Supabase session is restored on app launch
- auth changes are listened to with `onAuthStateChange`
- signed-in user info is copied into app state

### 3. Cloud database

Cloud data sync uses Supabase Postgres tables.

- Schema file: [SUPABASE_SCHEMA.sql](SUPABASE_SCHEMA.sql)
- Sync file: [src/supabase/sync.ts](src/supabase/sync.ts)

Current tables include:

- `projects`
- `entries`
- `project_entries`
- `drafts`
- `draft_entries`
- `canon_cards`
- `outline_items`

All core tables are designed to be owned by `auth.users.id` through `user_id` columns and RLS.

## Account ownership model

The intended ownership model is:

- one authenticated Supabase user owns their rows
- RLS restricts read/write to `auth.uid() = user_id`
- media storage is intended to be private per-user in the `alibi-media` bucket

This part is conceptually correct.

## What happens on sign-in right now

Bootstrapping behavior in [src/store/store.tsx](src/store/store.tsx):

1. App hydrates local AsyncStorage first
2. Auth session is restored from Supabase if present
3. If signed in:
   - app checks whether remote Supabase data exists
   - if remote has no data, local data is pushed up
   - if remote has data, remote replaces local state

## Production blockers still present

These are the important ones.

### 1. The schema exists as a SQL file, not as a managed migration system

Current state:

- schema is defined in [SUPABASE_SCHEMA.sql](SUPABASE_SCHEMA.sql)
- there is no tracked migration workflow in-repo

Impact:

- hard to guarantee prod/staging/dev are identical
- hard to audit schema drift
- hard to safely evolve columns and policies

### 2. Voice recordings are not yet production-solid in storage

Important distinction:

- uploads can go to Supabase Storage
- many local recordings still originate as device-local files

The `entries.audio_uri` field can hold a local device path, which is not a durable cross-device production reference.

Impact:

- another device cannot use that local path
- cloud state may reference media that only exists on one phone/computer

### 3. Sync is full-state push/pull, not conflict-safe operational sync

Current sync is simple and pragmatic, not production-grade collaborative syncing.

Impact:

- weak conflict handling
- weak multi-device reconciliation
- bootstrapping can be surprising if local/remote differ

### 4. There is no explicit onboarding/account boundary in the product yet

The technical account exists, but the product language does not yet clearly communicate:

- whether you are local-only or cloud-backed
- which account is active
- whether your current device data has synced yet

### 5. The live AI routes are not user-owned data pipelines yet

The AI routes in `api/ai/*` are app-server endpoints using OpenAI, but they are not acting as a complete authenticated persistence layer.

That is okay for V1 iteration, but it is not the same thing as a hardened production data backend.

## What is already good

There is a real base here already:

- Supabase Auth integration exists
- per-user row ownership exists in schema design
- RLS policies exist in schema
- sync plumbing exists
- storage bucket policy design exists

So the foundation is not fake. It is just not fully production-hardened yet.

## What must happen before calling this production-ready

1. Move schema to real migrations
2. Verify the live Supabase project actually matches the intended schema and RLS
3. Make recording media upload durable, not device-path dependent
4. Add clear in-app account/data-mode messaging
5. Add safer sync semantics and clearer bootstrap rules
6. Add environment separation for dev/staging/prod Supabase projects

## Practical current summary

Right now, the app is:

- **local-first by behavior**
- **cloud-capable when signed in**
- **not yet fully production-solid for account/data guarantees**

That is the honest state.