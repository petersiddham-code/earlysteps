# Domain resource links on Results (issue #71)

**Date:** 2026-07-09
**Content changed:** new file `domain-resources/domain-resources.json` (version 1.0.0), new schema `domainResourceSchema` / `domainResourcesFileSchema` in `packages/content/src/schema.ts`.

## What changed

The issue asked for the Results page to include "links to valid, trusted and authenticated
resources/videos" next to a child's support needs, and explicitly deferred any LLM-personalized
version of this to a future paid tier.

This PR adds a static, versioned content file with one curated external link per developmental
domain (communication, social, repetitive_behaviour, sensory, learning, attention, motor,
emotional_regulation, daily_living). A new `<DomainResourcesCard>` on the Results screen shows
the resources for whichever domains the caregiver's child currently has support needs in, the
same domain set already shown in the "Support needs" list, directly beneath that list. Nothing is
LLM-selected or personalized. This is content data like every other result-copy file (CLAUDE.md
§5).

## Source selection

Each link is a free page from an established public-health body, professional association, or
nonprofit publishing general developmental guidance for families: CDC, ASHA, Zero to Three,
Understood.org, CHADD, HealthyChildren.org/AAP, STAR Institute. No single clinician, blog, or
product vendor, and nothing branded around one specific diagnosis, matching CLAUDE.md §2 rule 1's
"never states or implies a diagnosis" (each link fits its domain generally rather than one
condition).

Every URL was live-checked at authoring time (2026-07-09) via search, but source appropriateness
for this audience still needs an advisor's judgment: reading level, cultural fit, regional
relevance. App users are explicitly on low-end devices, low bandwidth, and sometimes low literacy
(CLAUDE.md §1), and a US-centric professional-association page won't always serve that well. Link
rot is also a standing risk with any external URL list, so this needs a periodic live-link check
going forward, not just a check at ship time.

## What's still open

- Locale/regional variants: all 9 links are English-language, US-centric orgs. Non-US or
  non-English deployments will need their own vetted set, same caveat already on file for
  `red-flag-copy.json`'s crisis resources (`2026-07-08-crisis-resources.md`).
- Video resources specifically aren't split out (the issue mentioned "resources/videos"); the
  shipped set is reading material. A caregiver on very low bandwidth may prefer text over video
  anyway, but that's a call for the advisor/PM, not made unilaterally here.
- No age-band-specific matching yet: one link per domain regardless of the child's age band
  (toddler through young_adult). Age-appropriate resource matching is a reasonable follow-up, out
  of scope for this PR.

**Status: PLACEHOLDER, needs advisor sign-off before a release branch**, same as every other
first-pass content file in this repo.
