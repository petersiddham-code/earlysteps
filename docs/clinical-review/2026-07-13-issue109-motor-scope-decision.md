# Issue #109 — motor domain scope decision

**Type:** Documentation only. No question wording, weight, threshold, or result copy
changed by this PR.

## Finding

The issue #66 coverage audit (`2026-07-12-issue66-coverage-audit.md`) found that `motor` —
`DomainProfile`'s ninth domain (`packages/shared-types/src/domains.ts`) — has zero
questions in any shipped age band. `packages/content/domain-resources/domain-resources.json`
(issue #71) already ships a curated motor support-resource entry, so the domain was clearly
meant to be reachable, but nothing in the intake can ever produce a motor `DomainFinding`.

Same shape as issue #83's `—` scope cells (attention teen/young_adult, learning
toddler/young_adult, daily_living toddler/preschool): before authoring anything, confirm
whether the gap is a real omission or an intentional scope exclusion.

## Decision

**Real gap, not intentional.** Confirmed 2026-07-13 by the product owner (Peter Siddham).

Unlike #83's cells — each a single band within a domain that's otherwise covered — motor is
missing in *every* band. This isn't a top-up, it's net-new domain coverage across the
board. The product plan itself settles the scope question: "motor skill development" is
explicitly listed as one of the nine screened domains (line 51), alongside communication,
social interaction, sensory, behaviour, learning, attention, emotional regulation, and
daily living. There is no plausible reading under which motor was meant to be excluded —
the domain-resources entry existing with nothing to feed it is the tell that this was an
oversight during initial content authoring, not a deliberate cut.

## What this PR does and does not do

This PR resolves the scope question only, mirroring how issue #83 was handled (advisor
input recorded, actual authoring deferred to dedicated follow-up issues — #91, #92). It:

- Records this decision in `content-gaps.md` §12 (updated) and its §10 matrix (motor row
  added, previously absent since the domain wasn't discovered until the #66 audit).
- Files the authoring work as issue **#113** — net-new motor coverage for all five bands
  (toddler, preschool, primary, teen, young_adult), 3 items each, 15 items total. That
  issue carries its own acceptance criteria and will need its own clinical-content PR and
  sign-off, same as #91/#92 did for #83's other confirmed gaps.

It does **not** author any motor questions, change `domain-resources.json`, or touch any
scoring/weight/red-flag code — that's #113's job, gated the same way every other content
batch in §10 has been.

## Sign-off

Advisor: Peter Siddham (product owner, acting as advisor for this scope call, same as the
#83 precedent). Status: scope decision confirmed 2026-07-13. No clinical content shipped
in this PR to sign off on — #113's authoring PR will need its own sign-off when it lands.
