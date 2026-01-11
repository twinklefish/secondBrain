# Operating Procedure (How you'll run this project)

## Setup (once)
1) Create the Tag Index note with:
   - the namespace rules
   - a starter set of `#w/` workflow cues (your chosen list)
   - a starter set of `#x/` experience tags (small but reusable)
   - a few initial facet dimensions you expect to use often (`activity`, `place`, `with`, `context`)

2) Decide which header template you'll use (Option A recommended).

## Per note (repeat for all notes)
1) Provide the LLM:
   - the note text
   - current Tag Index
   - tagging rules summary
2) Paste the returned `TAGS_LINE` under frontmatter in the note.
3) Apply the `INDEX_UPDATES` to the Tag Index immediately (so the next note benefits).
4) Do not revisit the note (maintains single-pass constraint).

## Lightweight maintenance (occasionally)
- When you notice near-duplicates, add a synonym/redirect entry rather than proliferating tags.
- If a facet dimension starts fragmenting (e.g., `#f/place/` vs `#f/location/`), pick one and deprecate the other.
