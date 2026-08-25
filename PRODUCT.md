# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML/CSS/vanilla JS, no build step, no framework, no dependencies. Deployed as a
PWA on GitHub Pages (`jeremyl861225.github.io/surgery-notes`). Constraint inherited from the
existing implementation and confirmed by the 2026-08-25 rework brief: all state lives on the
device (IndexedDB); the only transport is a JSON file the user moves through Google Drive by hand.

## Users

台大醫院一般外科住院醫師。Primary user is the repo owner; secondary users are the co-authors of
the shared note the data came from. The job: before scrubbing in on a case with a particular
attending, check how *that* attending does *that* operation — positioning, trocar placement,
instrument preference, step order, closure. Checked on a phone, one-handed, standing up, in the
minutes before a case. Occasionally consulted on night shift in a dim corridor.

## Product Purpose

Answer "how does Dr. X do operation Y" in seconds, and let the answer be corrected on the spot
by the person who just scrubbed that case. Success is a resident opening it in the changing room,
finding the card, and not needing to ask.

## Positioning

Neither a guideline nor a textbook: it records *individual attendings' personal habits*, which no
published source contains and no institution publishes. Its authority comes from residents who
were in the room. That also fixes its liability: it is explicitly not clinical guidance.

## Operating Context

- Data originated in an iPhone shared Notes folder「學長痛經還是要寫擺位共筆啊！」(59 notes).
- Content now lives only in the app; the extraction pipeline is retired.
- The user transports data as a single `.json` file through Google Drive, opened with the iOS
  Files picker. No account, no login, no server.
- 20 doctors across wards 9A / 9B / 9C, 33 procedures, 37 cards, 51 hand-drawn diagrams.

## Capabilities and Constraints

- Ten fixed fields per card: 擺位／切口 trocar／器械偏好／重要步驟／吻合方式／引流放置／傷口關法／
  傷口包紮／健保申報碼／備註. The field set itself is not user-editable (2026-08-25 decision).
- Two layers of general notes above the card: **術式通則** (applies to everyone doing that
  operation) and **醫師通則** (applies to that attending on every operation). Both manually
  maintained from now on; the automatic "repeated line" derivation is retired.
- A card may belong to more than one doctor (4 of 37 currently do).
- Doctors, procedures and card text are editable in-app; edits are immediate, with no edit-mode gate.
- Images are stored as base64 inside the data file and in IndexedDB. Text references them as
  `[[img:<id>]]`.
- Import offers replace-or-merge after showing a diff summary.
- First launch auto-loads `data/seed.json`; "reset to default" restores it.
- Removed 2026-08-25: draft submission, Supabase backend, doctor-vs-doctor comparison table.
- Offline-capable PWA; must keep working with no network.

## Brand Commitments

Name 外科手術筆記. Traditional Chinese (Taiwan) interface. Clinical shorthand is bilingual by
nature and must not be "translated" — `Harmonic`, `CWV`, `SLNB`, `3-0 monocryl`, `ICG` are the
words residents actually use and appear verbatim in the content.

## Evidence on Hand

- `js/data.js` — 20 doctors, 33 procedures, 37 cards, real verbatim content.
- `img/*.webp` — 51 diagrams drawn by residents in Apple Notes (1.4 MB).
- **27 photographs from the source are deliberately absent.** They are iPhone photos taken in the
  OR containing identifiable patients (faces, perineum, breast, genitals). They are not in the
  repo and must never be added. Their positions show as `[[photo]]` placeholders.
- No usage analytics, no user research, no testimonials. Do not fabricate any.

## Product Principles

1. **The card is the product.** Every navigation decision is judged by how fast it puts a resident
   on the right card.
2. **Say "共筆沒寫", never leave a blank.** An empty field must be visibly empty, not ambiguous.
3. **Verbatim beats tidy.** Content is quoted from the people who were there; never paraphrase,
   normalize, or infer clinical attribution.
4. **The device is the server.** No account, no network dependency, no data leaving the phone
   except as a file the user hands over deliberately.
5. **Not a guideline.** The disclaimer is part of the product, not a footer afterthought.

## Accessibility & Inclusion

One-handed phone use is the primary case: touch targets ≥44px, reachable primary navigation.
Must be legible in bright daylight and in a dark corridor — follows the system colour scheme with
a manual override. Content contains no colour-only encoding.
