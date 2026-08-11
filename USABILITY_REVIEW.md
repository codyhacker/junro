# Junro — Usability Review: "It feels busy"

*Drafted 2026-08-11 in response to feedback that the app feels busy. Lens: fewer toggles, streamlined workflows. Grounded in the current code, not generalities.*

## The diagnosis, in numbers

A user planning a day is currently confronted with:

- **8 map layers** stacked at once (cluster-hull fill+outline, day-hull fill+outline, day-route line, place halo, place day-ring, place pin) — **11** when isochrones are on (3 bands).
- **3 different travel-mode controls** (trip Walk/Drive in settings, a per-day mode dropdown on every expanded day, and the mode implicitly baked into each route).
- **4 toggles** crammed into one settings drawer (dates-apply, show-all-routes, isochrone reachability, plus dark mode up top).
- **The "day" concept signaled 3 ways at once**: the pin's colored ring, the day-hull circle, and the route line — all the same color, all saying the same thing.

None of these is wrong on its own. Together they're the busyness. The fix is subtraction, and picking **one** way to say each thing.

Root cause: we added capability as **toggles and parallel systems** rather than folding it into a single default path. Every feature earned its own switch. The review below is mostly a list of switches to remove.

---

## 1. Toggle & control audit

Verdict codes: **CUT** (remove), **AUTO** (make it automatic, no control), **MERGE** (fold into an existing control), **DEMOTE** (keep but move out of the main flow), **KEEP**.

| Control | Where | Verdict | Why |
|---|---|---|---|
| **Show all day routes** toggle | Settings → "Map" | **CUT** | A power-user switch for a rare need. "Routes appear for the day you're looking at" is the whole clean idea of WS4 — a toggle to defeat it re-adds the clutter we just removed. Deleting it also deletes the entire "Map" settings group. |
| **Walk reach from hotel** (isochrone) | Settings → "Reachability" | **DEMOTE** | Genuinely useful but it's a toggle *and* 3 map fills. It's a "check reachability" glance, not a persistent layer. Move it off the settings pile — surface it as a one-tap action on the **hotel** (tap the lodging → shows its reach), auto-clearing when you look away. Removes a toggle + a settings group + 3 resting layers. |
| **Per-day travel mode** dropdown | Every expanded day | **AUTO + DEMOTE** | Redundant with the trip mode for ~90% of days. Auto-set excursion days to drive (we already detect excursions); for the rest, don't show a dropdown at all — expose an override only behind a small "walking ·" text you can tap. Removes a `<select>` from every open day. |
| **Trip travel mode** (Walk/Drive) | Settings → "Getting around" | **KEEP** | The single source of truth for mode. One control, sensible. |
| **Apply dates** button + shrink-confirm | Settings → "Dates" | **MERGE (live-apply)** | The common case (setting/extending dates) shouldn't need an explicit Apply. Apply on a valid change; keep the confirm **only** when a change strands stops. Removes a button and a step. |
| **Dark/light** mode | Top-right | **KEEP** | One expected control. Fine. |
| **Collapse plan** chevron | Panel header | **KEEP** | Just added; directly serves "give me the map." |
| **Suggest days** → diff → Apply | Panel | **KEEP (reframe)** | The preview-before-apply is good (trust). But it reads as a *separate mode*. Reframe it as the primary "plan for me" path, not an extra button competing with manual assignment. |
| **Per-stop ↑ ↓ ×** | Every stop, expanded | **DEMOTE** | Three buttons per stop is dense. Reorder is better as drag; keep ✕ but reveal ↑↓/drag on hover/long-press, not always-on. |
| **+day** dropdown | Every unassigned row | **KEEP (lighten)** | Needed, but a `<select>` per row is heavy. A single "＋" that opens a small day menu reads lighter than a native select on every row. |

**If we do just the CUT/AUTO/MERGE rows:** the settings drawer loses two whole groups ("Map", "Reachability") and shrinks to **Dates · Getting around · Lodging**; every expanded day loses its mode dropdown; and the dates step loses its button. That alone is most of the felt busyness gone.

---

## 2. The map is saying "day" three times

Right now an assigned place wears a **day-colored pin ring**, sits inside a **day-colored hull circle**, and (when selected) is on a **day-colored route**. Same information, three marks.

Recommendation — one resting signal, one selection signal:
- **Resting state:** category pin **inside its day-colored circle**. Drop the per-pin day ring (`places-day-ring`) — the circle already colors the group. Pins stay legible as *what* (category); the circle carries *which day*.
- **Selected state:** the route line appears (already WS4). That's the second, earned signal — it only shows for the day you're focused on.

Net: remove one always-on layer (the ring), and the day-color story becomes "circle = day, route = the day you're looking at." Cleaner and still complete.

Also worth deciding: **cluster hulls (unassigned) vs day hulls (assigned)** are two near-identical circle systems. They mean different things (to-plan vs planned), so keep both, but **differentiate by style** — unassigned clusters get a dashed/lighter ring, planned days a solid fill — so they don't read as one noisy field of circles.

---

## 3. Workflow friction (core path)

The happy path today: **create trip → add places → open gear → set dates → add hotel → close gear → Suggest days → Apply → refine.** The friction points:

1. **Essential setup hides behind the gear.** Dates and a hotel are *required* to plan, but they live behind a settings icon a new user must discover (the empty-state nudge patches this, but it's a patch). Consider promoting "When are you going?" and "Where are you staying?" as inline first-run steps in the panel, not settings.
2. **Two ways to plan, side by side.** "Suggest days" and manual "+day" assignment compete for attention with no clear primary. Make **Suggest** the obvious default ("Plan my days ✨"), with manual assignment as the quiet fallback.
3. **The Apply-dates button** is an avoidable step (see audit).
4. **Settings is a junk drawer.** Dates, mode, two display toggles, and lodging in one scroll. Splitting *setup* (dates, hotel — done once) from *the day-to-day* would make each lighter; cutting the toggles (§1) does most of this for free.

---

## 4. Streamlining plan (prioritized by busyness-removed ÷ effort)

1. **Cut the two display toggles** — remove "Show all day routes" and demote isochrone to a hotel-tap action. Deletes 2 settings groups + up to 4 resting layers. *Small.*
2. **Drop the redundant pin day-ring** — one resting day-signal (the circle). Removes a layer + the ring/hull double-coding. *Small.*
3. **Live-apply dates** — remove the Apply button; confirm only on shrink. *Small.*
4. **Auto/hide per-day mode** — excursions default to drive; override behind a subtle affordance, not a dropdown per day. *Medium.*
5. **Make "Plan my days" the primary action** and quiet the manual per-row assignment. *Medium.*
6. **Differentiate cluster vs day circles** (dashed vs solid) so the map doesn't read as one circle soup. *Small.*
7. **Promote dates + hotel to first-run inline steps** (later) — the bigger IA change; do after the quick cuts land. *Large.*

Items 1–3 and 6 are an afternoon and remove most of the reported busyness. 4–5 streamline the core loop. 7 is the deeper IA rework.

---

## Decisions (resolved 2026-08-11)

- **Isochrone:** ✅ demote from a settings toggle to a hotel-contextual action.
- **Per-pin day ring:** ✅ **keep** (user preference) — the pin keeps its day ring alongside the circle.
- **Proceed:** ✅ build the quick wins now (cut show-all-routes, demote isochrone, live-apply dates, differentiate cluster vs day circles).

## 5. Decisions to make before building

1. **Isochrone:** demote to a hotel-tap action, or cut entirely for v1? (Recommend demote — it's a nice glance, just not a persistent toggle.)
2. **Per-pin day ring:** OK to remove it and let the day-circle be the only per-day pin signal? (Recommend yes.)
3. **Manual assignment prominence:** make "Suggest/Plan" clearly primary and manual the fallback — agreed direction?
4. **Per-day mode override:** auto-drive excursions + hide the dropdown — acceptable, or do some users really set walk/drive per ordinary day?

---

*The through-line: we streamlined the map's **information** in the last UX pass (grouping over routing); this pass streamlines the **controls**. Fewer switches, one signal per idea, one obvious path.*
