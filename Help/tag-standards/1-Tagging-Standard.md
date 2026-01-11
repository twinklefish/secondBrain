# Tagging Standard (v1.0)

## Purpose
Create consistent, cross-cutting tags for a year of notes (business + personal) so you can later generate combined reports (across the four folders: admin/ideas/people/projects) by querying **topics + facets + experience + workflow cues**.

## Non-goals
- No wikilinks in the body for this step.
- Folder/category assignment is separate and happens later.
- Tags should not encode the four categories.

## Where tags go (note header convention)
Directly under frontmatter/properties, a plain line of `#tag` tokens.

Pick one and use it for every note to keep insertion uniform.

## Tag types (namespaces)
You'll use **four tag "classes"**:

### 1) Subject tags (high-level, no namespace prefix)
Examples: `#vacation`, `#finance`, `#health`, `#sales`, `#relationships`

Rules:
- 1 per note is typical; 0–2 max.
- Must be broad umbrellas (e.g., `#vacation` covers beach/roadtrip/Disneyland).

### 2) Facet tags (attributes you combine in reports)
Format: `#f/<dimension>/<value>`

Examples:
- `#f/activity/beach`
- `#f/place/disneyland`
- `#f/with/family` (use roles/groups, not individual names)
- `#f/context/business` vs `#f/context/personal`

Rules:
- Prefer facets over creating overly-specific subject tags.
- Avoid individuals; use roles or groups.

### 3) Experience tags (how it felt / how it went)
Format: `#x/<experience>`

Examples: `#x/joy`, `#x/stress`, `#x/connection`, `#x/fatigue`, `#x/frustration`

Rules:
- 0–2 per note typically.
- Keep them reusable across both business and personal notes.

### 4) Workflow cue tags (high fidelity; for action/review pipelines)
Format: `#w/<cue>`

Examples: `#w/decision`, `#w/follow-up`, `#w/open-loop`, `#w/lesson-learned`, `#w/idea-to-try`

Rules:
- Use liberally when present; these are intentionally "high precision."
- 0–2 per note typically (sometimes more if the note is explicitly a planning/review note).

## Slug rules (canonical formatting)
- Lowercase only.
- Use hyphens for multiword: `lesson-learned` not `lesson_learned`.
- Nested tags use `/` only for namespaces & facet dimensions: `#f/place/new-york`.
- Avoid near-duplicates: prefer one canonical form (`#vacation`), and treat variants as synonyms/aliases in the Tag Index (not as tags applied to notes).

## Tag count guideline (to prevent drift)
- Hard bounds: **2–10 total tags**
- Typical target: **3–5 tags**
- Suggested composition:
  - 1 subject
  - 1–3 facets
  - 0–2 experience
  - 0–2 workflow

## New tag creation policy (single-pass compatible)
The LLM may create new tags, but should:
1) Check the current Tag Index for an existing canonical tag first.
2) Only create a new tag if nothing fits.
3) When creating a new tag, it must:
   - Follow namespace + slug rules
   - Come with a one-line definition
   - Include suggested synonyms/aliases to prevent duplicates (e.g., map `summer-vacation` → `vacation`)

## Context facet clarification
Include an explicit context facet (`#f/context/personal` or `#f/context/business`) only when it's clearly one or the other—the default is that most notes are a combination.
