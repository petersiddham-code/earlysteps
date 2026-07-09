# 2026-07-08 — One-tap crisis resources for urgent red flags (issue #50)

**Content version:** red-flag-copy 1.1.0
**Status:** ⛔ awaiting advisor sign-off

## What changed and why

Issue #50 (S1) found that a self-injury or safety red flag produced only generic prose —
no tappable crisis resource — folded into the same banner as the general escalation
message, despite product plan §10 rule 10 requiring "a visible, one-tap path to
crisis/urgent-care resources … wherever a self-injury or safety red flag is shown".

1. **New `urgent_resources` array in `red-flag-copy.json`** — structured, tappable crisis
   resources (kind `tel` or `url` + label + description). Shipped default is a single
   entry: `https://findahelpline.com` ("Find a free crisis helpline near you"), a global
   directory of free, confidential helplines by country. Chosen because the app's locale
   is not yet regionalized (hardcoded `en`, no country), so no single phone number is
   safe to ship globally.
2. **New `<CrisisSupportCard />` component** renders the existing (unchanged)
   `urgent_resource_heading` / `urgent_resource_message` copy plus the tappable
   resources, at the TOP of the results screen (directly under the disclaimer), only when
   an urgent flag (`self_injury_risk`, `safety_risk`) is present. Styling is calm and
   supportive per §4.8 tone guidance — no alarm/error treatment.
3. **`RedFlagBanner` now carries only the general `base_message`** (unchanged wording) for
   all red flags — urgent and non-urgent flags are now visually distinct, as the issue
   requested.
4. **Removed `next_steps_heading`** ("Here's what to do next") from red-flag-copy — it had
   become a heading with nothing under it once the urgent block moved to the crisis card.
   No caregiver-visible information is lost; the crisis card's own heading does this job.

## Newly authored copy needing review

- Resource label: "Find a free crisis helpline near you"
- Resource description: "Opens a directory of free, confidential helplines by country —
  you can call, text, or chat."

All other user-facing wording is unchanged from red-flag-copy 1.0.0.

## Open items for the advisor

- Confirm findahelpline.com is an acceptable default global directory.
- Each localized/regional deployment must add regional crisis + emergency numbers
  (kind `tel`) to `urgent_resources` with sign-off before launch in that region — the
  schema supports this today.
- Confirm placement (crisis card above the strengths card) — safety visibility was
  prioritized; strengths still render before support needs (CLAUDE.md §2 rule 6 intact).
