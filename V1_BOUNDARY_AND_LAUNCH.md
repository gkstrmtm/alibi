# Alibi V1 Boundary + Compliance-Safe Launch Plan (Mobile-First)

## A. V1 Product Thesis

Alibi V1 is a private-first “capture → understand → build → draft → export” studio.

It is not a social platform, not a public publishing tool, and not a voice-cloning or impersonation product.

V1 must still be meaningfully useful for long-form creation (especially books), but in a disciplined way: long-form comes from accumulating structured project assets and running guided “studio sessions,” not from one giant “write my book” button.

---

## B. Core User Promise

### V1 promise (exact)
Turn any voice memo or text dump into: (1) clean understanding (transcript, highlights, themes), (2) ranked building blocks (idea cards + quotes/hooks), and (3) a source-linked draft in a chosen format—organized into a project and private by default.

### Long-form promise (without bloating V1)
Alibi helps you build a book project over time by asking the right questions, saving the answers as structured “canon” cards, and keeping your outline and drafts consistent as you add more material.

### Core user outcomes
- Capture without friction (voice or text) and never lose a thought.
- Get an accurate transcript + highlights + themes fast.
- See “what’s worth building” as ranked idea cards.
- Turn selected sources into a real draft (essay, segment, script, thread).
- For book projects: convert fragments into a coherent brief + outline + chapter drafts via guided studio sessions.
- Export cleanly via copy/share with sources visible.

### What must work flawlessly for “premium”
- Capture reliability: one tap, low latency, zero lost recordings, robust interruptions.
- Transcription quality and stability: consistent results, fast, readable, predictable.
- A beautiful “digestion moment”: chaos → a small set of obvious next actions.
- Project structure: inbox-to-project flow that prevents junk-drawer accumulation.
- Long-form continuity: project memory is structured and user-approved (not fuzzy “AI memory”).
- Output review: drafts are readable, versioned, and clearly tied to source.
- Trust defaults: privacy-by-default, tight permissions, clear data controls.

---

## C. Must-Have V1 Features

### Capture
- One-tap voice recording with pause/resume, background-safe handling, and interruption recovery.
- Typed quick entry with autosave.
- “Untitled quick-save” entry creation; rename later.
- Timestamped entries, lightweight optional tags.
- Optional project assignment at capture time (default: Inbox).

### Upload (keep tight)
- Import audio files (and optionally a transcript text file).
- Defer full video ingestion unless you can deliver it flawlessly.

### Digestion
- High-quality transcription for voice and imported audio.
- Text cleanup: paragraphing + punctuation normalization without rewriting meaning.
- Segmentation for long recordings.
- Highlight extraction: 5–15 best lines with timestamps.
- Theme detection: 3–7 themes per entry.
- Sensitivity flags (non-judgmental labels) to support privacy-first handling.

### Extraction
- Idea cards: core ideas + supporting points.
- Hooks/quotes list.
- Ranking: strongest 3–5 ideas per entry.
- Soft “project fit” suggestion (user-controlled).

### Organization
- Inbox + Projects.
- Project contains: entries, extracted cards, and drafts.
- Search across transcripts and extracted cards.
- Manual move + pin + archive.
- Included/excluded state for source material when generating.

### Book/Long-form (minimum viable foundation)
- A dedicated “Book Project” type (still private-first).
- Project assets (structured, editable, user-approved):
  - Project Brief (1-page): premise, audience, promise, tone, constraints.
  - Canon Cards: Characters, World, Themes, Claims/Truths, Timeline/Continuity notes.
  - Outline (acts/chapters) with a simple chapter list.
- A guided “Studio Session” mode for books:
  - The system asks targeted questions (missing motivations, stakes, setting logic, POV, timeline).
  - User answers are saved into Project Brief / Canon Cards.
  - A “Fold In” step updates outline/chapter notes using only selected canon.
- Basic deduplication: flag similar idea cards and let the user merge or keep both.

### Concept direction (minimal but real)
- One “Choose a direction” step:
  - Format: Essay, Commentary Segment, Podcast Outline, Script, Thread, Book Chapter Draft.
  - Tone: Neutral, Reflective, Funny, Serious.
  - Distance: Stay close / Expand / Invent further.
- Direction cards are generic vibes and structures, not show/celebrity references.

### Output generation
- Generate drafts from selected sources + selected idea cards (and for books: selected canon + selected chapters).
- Versioned drafts with a simple history list.
- Source-linked view: show what material was included.
- Regenerate with changed format/tone/distance.

### Export
- Copy as clean text.
- Share sheet export (plain text + Markdown).
- Optional: “Title + description” generator (no publishing assumptions).

### Privacy, permissions, notifications
- Private by default: nothing public, nothing discoverable.
- Permissions requested only in context:
  - Microphone permission only when the user taps record.
  - File/media access only when the user taps import.
- Clear data controls:
  - Delete entry (and derived transcript/extracts/drafts).
  - Delete project (and its derived assets).
  - Delete account (if accounts exist).
- Notifications off by default; optional “processing ready.”

---

## D. Long-Form Creation Foundation

V1 long-form quality comes from three choices:
1) store project knowledge as structured assets,
2) interview the user to fill missing nuance,
3) synthesize only from selected canon to prevent drift and filler.

### The long-form loop (V1)
- **Accumulate inputs:** entries flow into a book project.
- **Digest + extract:** each entry yields themes, highlights, and idea cards.
- **Curate canon:** the user promotes items into Canon Cards (facts, characters, rules, tone).
- **Interview (Studio Session):** the app asks 8–15 probing questions aimed at missing structure.
- **Fold in:** update Project Brief and outline using those answers; show diffs/what changed.
- **Draft chapters:** generate a chapter draft from selected canon + selected sources.
- **Continuity check (lightweight):** warn if the new draft contradicts canon.

### What “project-aware memory” should mean in V1
- Not a mysterious, always-on memory.
- A small set of user-visible, user-editable, user-approved assets:
  - Project Brief
  - Canon Cards
  - Outline + chapter notes
- Generation always declares which assets were used.

### How guided interviewing stays premium (and not annoying)
- Questions are scoped and purposeful (“choose 1 of 3 stakes,” “name the setting rule,” “what is the lie the protagonist believes”).
- The user can skip, answer by voice, or type.
- Every answer lands somewhere tangible (brief, canon, outline), not lost in chat.

### Idea deduplication and drift prevention (realistic in V1)
- Similarity detection on idea cards and canon cards.
- Merge/keep controls.
- “Canon wins” rule: if a new draft conflicts, prompt the user to either update canon or regenerate.

### What’s realistic for V1 vs what to tier/limit
- Realistic in V1:
  - One book project can become coherent through brief + canon + outline + studio sessions.
  - Chapter drafts can be good if scope is constrained (single chapter, defined canon).
- Tier/limit in V1:
  - Project-wide synthesis across huge libraries (cap project size or run less frequently).
  - Very long context ingestion (cap minutes or number of entries per “deep dive”).
- Save for later:
  - Deep continuity engines, multi-POV tracking, large-scale world bibles, advanced plot graphing.

---

## E. V1 Features to Exclude

### Nice to have (not required)
- Video upload and full video transcription.
- Multi-speaker diarization beyond “best effort.”
- Advanced editing tools (waveform, timestamp-level transcript editing).
- Smart collections beyond search/pins.
- Heavy template libraries.

### Explicitly defer to V2
- Any public feed, discovery, or “publish to community.”
- Creator profiles, followers, likes, comments.
- Collaboration/shared workspaces.
- Public sharing links with hosted players.
- Monetization beyond a simple subscription (marketplace, boosts).
- Voice cloning, voice conversion, impersonation, celebrity/brand imitation.
- Templates that reference real shows, hosts, celebrities, or brands.

---

## F. Mobile Premium Experience Rules

### One dominant action per screen
- Home: Capture (voice) is primary; Type is secondary.
- Entry: Digest/Extract → Generate Draft.
- Book Project: Studio Session → Update Outline → Draft Chapter.

### Capture must be bulletproof
- Recording state is always visible.
- Automatic recovery from phone calls, Bluetooth changes, app backgrounding.
- No silent failures; always show saved/not-saved state.

### The digestion/extraction reveal must feel expensive
- After processing: title suggestion, themes, highlights, ranked ideas.
- Everything is tappable and actionable.

### Long-form must have a clear path
- A book project always shows three assets at the top:
  - Brief
  - Canon
  - Outline
- The user always knows where to put new details (and what the system used).

### Output review is a product
- Clean typography, sectioned drafts, obvious versions.
- Source visibility and “what changed” after regen.

### Trust is UX
- “Private by default” is stated early and consistently.
- Permissions are requested in context.
- Deletion is real and understandable.

---

## G. Compliance-Safe Launch Strategy

This is practical guidance to reduce App Store / Play review friction, not legal advice.

### Permissions strategy
- Microphone permission only when recording.
- Avoid Contacts/Location/Bluetooth/Motion.
- Imports via document picker; avoid broad photo library permission in V1.
- Notifications opt-in only after value is experienced.

### Privacy-by-default posture
- Default all content to private.
- No public URLs, no in-app publishing, no discovery.
- If using cloud transcription/LLMs: clear disclosure at the moment of processing.

### Handling audio, text, uploaded media
- Explicitly state:
  - on-device vs cloud processing,
  - what is stored (raw audio, transcript, extracts, drafts),
  - retention and deletion behavior.
- Provide “Delete source + derived data.”

### Policy-sensitive areas
- AI disclosure: outputs can be wrong; show what sources/canon were used.
- Avoid “therapy/diagnosis” positioning.
- Avoid “impersonate a celebrity/show” language and features.

### Avoiding UGC moderation burden
- Keep content private-only in V1.
- Export is device-level share (user-controlled), not hosted publishing.

### “Inspired by” templates without infringement
- Use generic vibe/structure names (no show/host/network/brand naming).
- No “in the voice of [person]” prompts.
- Don’t ship visual branding that resembles real properties.

---

## H. Pricing / Capability Gating Logic

The goal is to keep V1 premium and economically sane without introducing a complex credit economy on day one.

### Free (proves the magic)
- Limited monthly transcription minutes.
- Limited number of Studio Sessions per month.
- Limited number of draft generations per day.
- Full access to view, export, and delete the user’s own content.

### Pro subscription (primary monetization)
- Higher transcription minutes.
- More Studio Sessions (book interviews) and larger per-session context.
- Higher draft generation limits.
- Larger project limits (more entries per book project, more canon cards).

### What to cap (even for Pro) to protect quality and cost
- Project-wide “deep dive synthesis” frequency (e.g., 1–2 times/day) instead of unlimited.
- Max sources per generation (forces curation; improves output quality).
- Max canon cards included per chapter draft (forces structure).

### Optional later (V2+) if economics demand it
- Consumable add-on for extra deep-dive runs or extra long-form synthesis.
- Template packs as non-consumable purchases.

---

## I. V2 Expansion Map

### Public sharing + creator layer (only after private is perfect)
- Shareable links for specific drafts with audience controls.
- Optional publishing.
- Moderation/reporting if any content becomes public.

### Collaboration
- Shared projects with role-based access.
- Comments/annotations.

### Deeper long-form intelligence
- Higher-context project synthesis.
- Richer continuity checks (timeline, POV, character arc tracking).
- Stronger world/character systems.

### Multi-voice/co-host structures
- Improved diarization.
- Speaker profiles and recurring segment frameworks.

### Higher-risk features (delay)
- Voice cloning/voice conversion.
- Identity-linked synthetic media.

---

## J. Final Recommendation

Launch Alibi as a private-first mobile studio that reliably converts voice/text into:
1) transcript + highlights + themes,
2) ranked idea cards,
3) a source-linked draft in a chosen format,
4) a book workflow anchored by Brief + Canon + Outline + Studio Sessions,
5) clean export.

Do not launch as a social platform, publishing network, or impersonation/voice product.

Minimum long-form capability required at launch to feel real:
- Book Project type.
- Canon cards + outline.
- Studio Sessions that ask probing questions and fold answers into canon/outline.
- Chapter drafting using selected canon + selected sources.

Fastest path to premium:
- bulletproof capture,
- a gorgeous digestion/extraction reveal,
- structured project memory,
- draft review that feels finished.

Fastest path to fewer store headaches:
- minimal permissions,
- privacy-by-default,
- no public UGC surfaces,
- no celebrity/show imitation and no voice cloning.
