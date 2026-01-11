# Tagging Rules Summary (include in every LLM run)

## Inputs
You will see:
1) a NOTE (content unchanged)
2) the current TAG INDEX (canonical tags + aliases)

## Your job
- Add ONE line of native Obsidian tags directly under frontmatter: a space-separated list of `#tag` tokens (no extra text).
- Tags must follow slug rules: lowercase, hyphens for multiword, `/` only for namespaces.
- Use these tag classes:
  - Subject: `#<subject>` (broad umbrella; usually 1 per note; 0–2 max)
  - Facet: `#f/<dimension>/<value>` (usually 1–3)
  - Experience: `#x/<experience>` (0–2)
  - Workflow cues: `#w/<cue>` (0–2 typical; use when clearly present)

## Selection policy
- Prefer existing canonical tags from the Tag Index.
- Only create new tags if no existing tag fits.
- If you create a new tag, you must also propose how to add it to the Tag Index:
  - tag + type (subject/facet/experience/workflow)
  - one-line definition ("use when…")
  - suggested aliases (variants that should map to it)

## Constraints
- Total tags per note: 2–10 (aim for 3–5).
- Tags should be topical + facets/experience/workflow only.
- Do NOT add wikilinks, do NOT rewrite the note, do NOT categorize into the 4 folders.
- Include `#f/context/personal` or `#f/context/business` only when clearly one or the other—default is that most notes are a combination.

## Output format (STRICT)
1) **TAGS_LINE:** `<one line of space-separated #tags only>`
2) **INDEX_UPDATES:** (only if needed) new tags + alias mappings
