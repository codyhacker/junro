# Junro — Platform Plan (Secondary Implementation)

*Companion to [PROJECT_PLAN.md](PROJECT_PLAN.md). That plan ships a local-first, single-user app on localStorage. This plan takes it multi-user: a lightweight database, accounts, sharing, and real-time collaboration — with security treated as a per-phase gate, not a final chore. Nothing here starts before the primary plan's Phase 5 is done; everything here assumes its decisions (trip document as source of truth, `TripStorage` adapter, schemaVersion migrations).*

---

## 1. Guiding principles

1. **Local-first survives the backend.** The database is a sync target, not a replacement. The app keeps working offline; localStorage remains the hot cache; sync reconciles. Users who never create an account lose nothing.
2. **The `TripStorage` seam holds.** The primary plan made all persistence flow through one async adapter (§5.6 there). The backend arrives as `RemoteTripStorage` + a sync layer — zero call-site changes in features.
3. **The Redux action stream is the collaboration protocol.** Trip edits are already serializable RTK actions. Sync and collaboration transmit *operations*, not whole documents — which gives history, undo, and conflict rebase from the same primitive.
4. **Authorization lives server-side only.** Client checks are UX; row-level security is the enforcement. No trust in the SPA, ever.

---

## 2. Backend selection

Requirements: lightweight (per our storage decision), hosted auth with OAuth + magic links, row-level authorization, realtime channels for collaboration, JSON-friendly storage, boring operations.

| Option | Auth | Row-level authz | Realtime | Ops burden | Notes |
|---|---|---|---|---|---|
| **Supabase (Postgres)** ✅ recommended | Built-in (OAuth, magic link, PKCE) | Native RLS policies | Built-in channels + Postgres changes | Zero (managed, free tier fits) | Heaviest engine, lightest *for us* — auth/RLS/realtime are exactly the S1–S3 feature list |
| PocketBase (SQLite) | Built-in | Collection rules | Built-in subscriptions | Self-host a single binary | Truest to "lightweight"; the fallback if we'd rather own the box |
| Turso/libSQL | none — BYO | none — BYO | none — BYO | Low | Minimal DB, but we'd hand-build auth + authz + realtime: rejected for scope, not quality |

**Recommendation: Supabase.** "Lightweight" should mean *our* effort, not the engine's binary size — and building auth or authorization by hand is the classic way security goes wrong. PocketBase is the documented plan B; the schema below ports to it directly. Everything below is written against Postgres/Supabase but names no Supabase-only concept except RLS.

---

## 3. Server data model

Trip documents stay JSON blobs (mirroring the client model, `schemaVersion` migrations still run client-side). Normalize later only if server-side queries demand it — sharing and collaboration don't.

```sql
profiles      (user_id PK → auth, display_name, avatar_url, created_at)

trips         (id UUID PK,             -- client-generated UUIDv7 (see §7 prerequisite)
               owner_id → profiles,
               doc JSONB,              -- the Trip document
               schema_version INT,
               revision BIGINT,        -- optimistic-concurrency counter
               updated_at, deleted_at) -- soft delete with 30-day window

trip_members  (trip_id, user_id, role ENUM(owner|editor|viewer),
               invited_by, created_at, PK (trip_id, user_id))

share_links   (id UUID PK, trip_id, role ENUM(editor|viewer),
               token_hash BYTEA,       -- store a hash, never the raw token
               expires_at NULLABLE, revoked_at NULLABLE, created_by)

trip_ops      (trip_id, seq BIGINT, actor_id, base_revision BIGINT,
               action JSONB,           -- the serialized RTK action
               created_at, PK (trip_id, seq))   -- S3 only; also the audit trail
```

**RLS sketch** (the actual security boundary — every table gets policies in this spirit):

```sql
-- trips: readable by members; writable by owner/editor; deletable by owner
USING  (EXISTS (SELECT 1 FROM trip_members m
                WHERE m.trip_id = id AND m.user_id = auth.uid()))
-- share-link access is resolved by an RPC that validates token hash + expiry
-- + revocation server-side and returns a scoped grant; the raw token never
-- appears in a queryable column.
```

---

## 4. Sync model (S1) → collaboration model (S3)

**S1 — explicit sync, compare-and-swap.** `RemoteTripStorage.save()` issues `UPDATE trips SET doc=?, revision=revision+1 WHERE id=? AND revision=?`. Zero rows updated ⇒ conflict ⇒ client rebases: reload server doc, replay local RTK actions recorded since the last synced revision (the op log we already keep for undo/redo), prompt only if replay produces a genuine collision (same stop moved two ways). Sync triggers: debounced-after-edit (piggybacking the existing 400 ms persist), on app focus, manual "sync now." Offline queues; nothing blocks on the network.

**S3 — live collaboration.** Same primitive, streamed: an editor's RTK actions append to `trip_ops` and broadcast on a realtime channel; peers apply them as remote dispatches (reducers are already pure — remote actions replay exactly like local ones). Server snapshots `doc` every N ops. Presence (who's here, which day they're viewing) rides the same channel. **Deliberately not CRDT:** trip planning is low-contention, sessions are short, and per-action apply + CAS rebase is explainable and debuggable. Yjs is the documented escalation path if simultaneous *offline* editing of the same trip ever becomes real; the op-log design doesn't preclude it.

---

## 5. Phases

Numbering continues the primary plan (which ends at Phase 6). Each phase's security requirements are **gates** — the phase isn't done until they hold.

**Phase 7 — Backend foundation & accounts**
Supabase project; schema + RLS for `profiles`/`trips`; auth (magic link + Google/Apple OAuth, PKCE); `RemoteTripStorage`; sync engine with CAS + rebase; **local-trip adoption** (first sign-in offers to upload local trips — ids are already UUIDs, so adoption is an insert, no remapping); account management screen (profile, email change w/ re-verification, **export-all-trips JSON + delete account** — the export already exists from primary Phase 5).
✓ *Verify:* two browsers, one account — edit in A, focus B, B converges; airplane-mode edits in both, reconnect, rebase merges without data loss; RLS test suite proves a second account can read/write nothing; delete account leaves zero rows (after soft-delete window) and a downloaded export.
🔒 *Gates:* all tables deny-by-default with RLS; sessions via the provider's PKCE flow with refresh rotation — no tokens hand-rolled, none in URLs or non-httpOnly storage where avoidable; server-side zod validation of `doc` (schema + size cap ~1 MB) on every write; auth endpoints rate-limited.

**Phase 8 — Sharing**
Share links: role-scoped (view/edit), revocable, **expiring by default** (trip end + 30 days; keeping one alive is the explicit opt-out). Invite-by-email → `trip_members` row on acceptance. **Future-trip safety:** a shared future itinerary discloses which nights you're away and where you sleep — so viewer links get a **hide-lodging toggle**, and the share dialog states plainly what's included (dates, places, hotel locations). **Public itinerary page**: the primary plan's printable itinerary view served read-only to viewer-link holders (same SPA, viewer mode, no auth required). Member management UI (owner can change roles, remove members, transfer ownership).
✓ *Verify:* viewer link renders the trip read-only and every mutation path is absent *and* server-rejected; revoking a link kills access on next request; expired link 404s; editor link edits sync; non-member with a guessed trip UUID gets nothing; a hide-lodging viewer link contains no lodging coordinates anywhere in the response payload.
🔒 *Gates:* tokens ≥128-bit random, stored hashed, compared server-side; link resolution rate-limited (tokens are bearer capabilities — revocation + default expiry are the mitigations, and the UI says "anyone with this link"); role checks in RLS, not in the client; hide-lodging enforced server-side (lodging stripped from the doc served to that grant, never hidden client-side); no share tokens in referrer-leaking contexts (fragment or POST body, not query where avoidable).

**Phase 9 — Collaboration**
Realtime channel per open trip; op broadcast + remote-dispatch apply; presence avatars + "viewing Day 3" indicators; soft edit signals ("Alex is reordering Day 2") in place of hard locks; op log doubles as trip history ("restore to yesterday").
✓ *Verify:* two accounts drag stops on different days concurrently — both converge, no flicker; same-stop conflict resolves via CAS + rebase with a visible, correct outcome; presence appears/disappears within seconds of join/leave; history restore round-trips.
🔒 *Gates:* channel subscription authorized against `trip_members` server-side; broadcast payloads validated (zod on action shape — a malicious client must not inject arbitrary actions, only whitelisted trip-edit action types with size caps); op log immutable to clients (insert via RPC only).

**Phase 10 — Hardening & operations**
The audit pass on top of the per-phase gates: dependency audit + update policy; CSP for the SPA; CORS pinned to known origins; Mapbox token URL-restricted; backup verification (restore drill, not just backups); monitoring/alerting on auth failures and rate-limit trips; abuse controls (per-user trip/size quotas); a written incident-response note (what to rotate, in what order); privacy review — **trip data is location data**: retention policy, soft-delete purge job actually runs, analytics (if any) exclude coordinates.
✓ *Verify:* restore drill from backup succeeds into staging; `npm audit`/OSV clean or triaged; CSP report-only period shows no violations before enforce; a written data-inventory doc exists (what we store, where, why, how deleted).

---

## 6. Security model (cross-cutting summary)

- **Authentication:** delegated to the provider (OAuth + magic links, PKCE). We store no passwords, ever.
- **Authorization:** RLS on every table, deny-by-default; share links resolved via hashed-token RPC; roles = owner/editor/viewer with owner-only destructive ops.
- **Transport & sessions:** TLS only; provider-managed session tokens with refresh rotation; no tokens in URLs.
- **Input:** every write server-validated (shape + size); realtime ops whitelisted by action type.
- **Data privacy:** location data treated as sensitive — export + true deletion, minimal analytics, no coordinates in logs; future-trip dates + lodging are the most sensitive fields of all (default link expiry, hide-lodging toggle).
- **Operational:** backups with restore drills, soft-delete windows, rate limits, quotas, dependency hygiene.
- **Client:** CSP, no secrets in the bundle (Mapbox public token is URL-restricted), viewer mode strips mutation UI *and* the server enforces it anyway.

---

## 7. Prerequisites to honor in the primary plan (cheap now, painful later)

1. **UUIDs from Phase 1** — all client-generated ids (trips, places, days, lodgings) are UUIDv7, so server adoption never remaps ids. *(Noted in PROJECT_PLAN.md §4.)*
2. **Record the op log** — primary Phase 5's undo/redo should keep the serialized-action history keyed by revision, since it becomes the sync rebase source here.
3. **Viewer-mode discipline** — build the printable itinerary view (primary Phase 5) as a read-only render of the trip doc with no reducer access, so Phase 8's public page is a routing change, not a refactor.
