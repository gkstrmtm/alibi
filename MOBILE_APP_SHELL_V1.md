# Alibi — Mobile-First App Shell (V1)

This is a structural/navigation blueprint. No final branding, colors, gradients, or visual polish implied.

---

## A. Overall Shell Logic

### The product flow the shell must support
Capture → Digest → Extract → Organize → Conceptualize → Generate → Review/Export.

### Core structural decisions (V1)
- **Home is action-forward, not a feed.** It shows “what to do next” and your most recent work.
- **Vault is library-first.** It is where raw entries live, searchable, filterable, and project-assignable.
- **Create is a dedicated tab (not a modal).** It anchors fast capture + import + type entry and reduces “where do I start?” confusion.
- **Projects is the long-form/work hub.** Book projects live here; Vault is not where you do deep work.
- **Concept Studio is a mode inside a project**, entered from Home/Vault/Project/Extraction—never a main tab in V1.

### Content hierarchy (what matters most)
1) Capture reliability and speed
2) Clear “digestion/extraction reveal”
3) Easy movement into Projects
4) Output review/export that feels finished

---

## B. Bottom Navigation Structure (max 5)

### Tabs
1) **Home** — next actions + recent
2) **Vault** — all entries (raw → digested → extracted)
3) **Create** — capture/type/import (primary creation gateway)
4) **Projects** — projects index + book projects
5) **Profile** — settings, privacy, billing

### Navigation rules
- **Create tab always returns to a creation surface** (not a list).
- Deep screens (Recording, Digest/Extract, Output, Concept Studio) are **stack screens** pushed from the tab context.
- The user can always get back to the “current work object” (active entry/project) in 1 tap.

---

## C. Screen-by-Screen Placement Breakdown (wireframe in words)

Below: top area, primary content, secondary content, bottom actions, and why.

### 1) Home
- **Top area**
  - Compact header: “Alibi” + search icon (search opens global search sheet)
  - Small status slot: “Processing…” if any jobs running
- **Primary content (above the fold)**
  - One prominent card: **Continue** (shows the single most relevant next step)
    - Examples: “Review Digest,” “Finish Extraction,” “Continue Studio Session,” “Review Draft”
  - One prominent button row (2 actions max): **Record** (primary) + **Type** (secondary)
- **Secondary content (below fold)**
  - “Recent” list (3–5 items max): last entries/drafts/projects with status chips (Captured / Digested / Draft)
  - “Pinned Projects” (max 2) if any
- **Bottom actions**
  - None sticky (Home should scroll naturally)
- **Main CTA**
  - **Record**
- **Hidden in sheets/deeper flows**
  - Full recent history, filters, bulk actions
- **Why this structure**
  - Home should not become a library. It’s a “what now” surface and a fast start.

### 2) Create
- **Top area**
  - Header: “Create” + optional help icon
- **Primary content (above the fold)**
  - Three large actions (stacked, thumb-friendly):
    1) **Record voice** (primary)
    2) **Type a note**
    3) **Import audio / transcript**
- **Secondary content**
  - Small “Capture defaults” row (tappable): default project = Inbox, tag toggle
- **Bottom actions**
  - None sticky (actions are already at bottom reach)
- **Main CTA**
  - **Record voice**
- **Hidden in sheets**
  - Advanced import settings, file types, processing options
- **Why**
  - This tab removes ambiguity and keeps creation one tap away.

### 3) Active Recording (modal-like full screen)
- **Top area**
  - Minimal: back/close, recording indicator, elapsed time
- **Primary content**
  - Big waveform placeholder (not decorative; can be minimal)
  - Live “bookmark” button (adds a marker/highlight while recording)
- **Secondary content**
  - Optional: project picker (defaults to Inbox) via bottom sheet
- **Bottom actions (sticky)**
  - Sticky control bar: **Pause/Resume** + **Finish** (Finish is primary)
- **Main CTA**
  - **Finish**
- **Hidden in sheets**
  - Rename, tags, project assignment
- **Why**
  - Recording is a single-purpose state. Controls must be bottom-reachable and resilient.

### 4) Vault (library)
- **Top area**
  - Header: “Vault”
  - Search field (tapping opens full search view)
  - Filter chip row (single line): All / Captured / Digested / Drafted / Book Assets
- **Primary content (above the fold)**
  - List-first (not grid): entries with title, timestamp, status chip, duration (if audio)
  - Each row has a single affordance: tap to open Entry detail
- **Secondary content**
  - Multi-select mode (hidden behind “Select”)
- **Bottom actions**
  - Optional: floating “+” is NOT needed because Create is a tab
- **Main CTA**
  - Tap an entry to continue its lifecycle
- **Hidden in sheets**
  - Bulk move to project, bulk delete, export transcript
- **Why**
  - Vault’s job is retrieval and organization, not creative work.

### 5) Digest / Extraction View (Entry Detail)
This is the core “premium reveal.” It should feel like a transformation step.

- **Top area**
  - Entry title (editable), timestamp, status (Processing/Digested/Extracted)
  - Small “…” menu (delete, move, export)
- **Primary content (above the fold)**
  - If not processed: one big button **Digest & Extract**
  - If processed: a stacked set of sections (in this order):
    1) **Highlights** (5–10 lines; tap to expand)
    2) **Top Ideas** (3–5 ranked cards)
    3) **Themes** (3–7 chips)
- **Secondary content (below fold)**
  - Transcript (collapsed by default)
  - Quotes/Hooks section
- **Bottom actions (sticky)**
  - Sticky bar with 2 actions max:
    - **Add to Project** (secondary)
    - **Generate Draft** (primary)
- **Main CTA**
  - **Generate Draft** once extraction exists
- **Hidden in sheets**
  - Project picker, included/excluded toggles, “what to use” selection
- **Why**
  - Keeps the user moving forward: reveal → choose → generate.

### 6) Projects Index
- **Top area**
  - Header: “Projects” + “New”
  - Search icon (optional)
- **Primary content (above the fold)**
  - List of projects with 1-line metadata: last updated, #entries, #drafts
  - Show “Book” badge for book-type projects
- **Secondary content**
  - “Pinned” section (optional) above list
- **Bottom actions**
  - None sticky
- **Main CTA**
  - **New Project**
- **Hidden in sheets**
  - Project type picker (Standard vs Book), archive/delete
- **Why**
  - Projects is where long-form lives. Keep the index clean and scannable.

### 7) Single Project View
Avoid internal tabs in V1; use sections with a single primary action.

- **Top area**
  - Project title, type badge (Book/Standard), “…” menu
  - Optional: compact progress strip (Captured → Drafted)
- **Primary content (above the fold)**
  - **Project Next Step** card (one): “Continue Studio Session” / “Draft Chapter 2” / “Review Outline”
  - For Book projects: three pinned assets as rows:
    1) Brief
    2) Canon
    3) Outline
- **Secondary content (below fold)**
  - Sections (collapsible):
    - Entries
    - Extracted Ideas
    - Drafts
- **Bottom actions (sticky)**
  - Sticky bar with 2 actions max:
    - **Add Sources** (secondary)
    - **Open Studio** (primary)
- **Main CTA**
  - **Open Studio**
- **Hidden in sheets**
  - Select sources to include/exclude, reorder outline, merge duplicates
- **Why**
  - Projects are workspaces. The user needs one clear forward motion.

### 8) Concept Studio entry point / shell (inside a Project)
This is not a chat app; it’s a session room.

- **Top area**
  - Session header: “Studio” + project name + session status (Drafting / Interview / Outline)
- **Primary content (above the fold)**
  - A single “mode strip” (not tabs):
    - **Interview** (ask questions)
    - **Build** (brief/canon)
    - **Outline**
    - **Draft**
  - Default to the mode that matches “next step.”
- **Secondary content**
  - “Session Notes” panel (auto-captures decisions)
- **Bottom actions (sticky)**
  - Interview mode: **Answer** (voice/type) + **Skip**
  - Draft mode: **Generate** + **Refine**
- **Main CTA**
  - Depends on mode; always one primary
- **Hidden in sheets**
  - Source selection, canon selection, tone/distance controls
- **Why**
  - Long-form feels premium when decisions are captured as assets, not lost in chat.

### 9) Output View (Draft Review)
- **Top area**
  - Draft title (editable), version selector, “…” menu
- **Primary content (above the fold)**
  - Draft text with clear sectioning
  - “Sources used” summary line (tap to view details)
- **Secondary content**
  - Version history list (collapsed)
  - “Regenerate settings” summary (format/tone/distance)
- **Bottom actions (sticky)**
  - Sticky bar with 2 actions max:
    - **Regenerate** (secondary)
    - **Export** (primary)
- **Main CTA**
  - **Export**
- **Hidden in sheets**
  - Export options, copy formats, regenerate controls, included/excluded sources
- **Why**
  - This is where “premium” is judged. It must be calm, readable, and decisive.

### 10) Profile / Settings
- **Top area**
  - Header: “Profile”
- **Primary content (above the fold)**
  - Account status (Free/Pro)
  - Privacy controls (what’s stored, delete actions)
- **Secondary content**
  - Subscription/billing
  - Notifications toggles
  - Help/support
- **Bottom actions**
  - None sticky
- **Main CTA**
  - Contextual: upgrade or manage privacy
- **Hidden in sheets**
  - Confirmations for delete, export data
- **Why**
  - Keep trust and billing clear; don’t bury privacy.

---

## D. CTA Strategy

### Global rules
- **One primary CTA per screen.** Two maximum actions in sticky bars.
- The primary CTA must be **thumb-reachable** and consistent in placement.

### Screen-level primaries
- Home: Record
- Create: Record
- Recording: Finish
- Vault: Open entry (tap row)
- Entry (Digest/Extract): Digest & Extract (pre) → Generate Draft (post)
- Projects Index: New Project
- Single Project: Open Studio
- Studio: Answer/Generate (mode-dependent)
- Output: Export

---

## E. What Lives in Sheets / Secondary Flows

Use bottom sheets for anything that is real but not primary.

- Project picker (assign/move)
- Included/excluded source selection
- Regenerate controls (format/tone/distance)
- Export options (copy, markdown, share)
- Bulk actions (select → move/archive/delete)
- Rename, tags
- “Sources used” details
- Continuity/dedup warnings and merge actions

Avoid: stacking multiple full screens for settings-like choices.

---

## F. Mobile UX Rules

- **Thumb-first:** primary actions at bottom; secondary actions in sheets.
- **Progressive reveal:** keep above-the-fold minimal; expand transcript/versions on demand.
- **List-first library:** Vault and Projects are lists, not card grids.
- **Never show empty states without an action.** Empty Vault = “Record / Type / Import.”
- **No fake complexity:** no nested tabs inside tabs; no “analytics dashboard.”
- **Clear object model:** Entry → Digest/Extract → Draft; Project → Assets → Studio → Draft.
- **Always show status:** Captured / Processing / Ready / Drafted.

---

## G. Recommended First Build Order

1) Bottom nav shell + routing (5 tabs)
2) Create + Active Recording (capture must be real)
3) Vault list + Entry detail shell
4) Digest/Extract view layout + processing states
5) Draft Output view layout + export sheet
6) Projects index + single project view sections
7) Concept Studio shell (modes + session scaffolding)
8) Profile/settings (privacy, delete, billing placeholders)
