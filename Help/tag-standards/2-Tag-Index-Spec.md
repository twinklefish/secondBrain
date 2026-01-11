# Tag Index (Canonical Vocabulary) Spec

## What this is
A single "source of truth" note that the LLM will be shown on every pass, containing:
- canonical tags you want used
- definitions + usage rules
- known synonyms/redirects to prevent duplicate tags
- preferred facet dimensions

## Suggested structure (human-editable)
- **Section A: Subject tags**
- **Section B: Facet dimensions + common values**
- **Section C: Experience tags**
- **Section D: Workflow cue tags**
- **Section E: Synonyms / redirects**
- **Section F: Deprecated tags (do-not-use)**

## Entry fields (what every canonical tag should have)
- **Tag:** `#x/stress`
- **Type:** subject / facet / experience / workflow
- **Definition:** short
- **Use when:** 1–3 bullets
- **Avoid when:** 1–2 bullets (prevents overlap)
- **Related tags:** optional
- **Synonyms/aliases:** list of "do not use" variants that map here

## Governance rules (to keep the index clean)
- Prefer adding facet values under an existing facet dimension over inventing new dimensions.
- If a facet starts acting like an umbrella used across many contexts, consider promoting it to a subject tag (rare; do deliberately).
- Never "rename" a canonical tag silently—add a deprecated mapping instead.
