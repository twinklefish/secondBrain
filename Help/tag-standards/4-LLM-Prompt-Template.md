# LLM Prompt Template (Single-Pass Tagging + Index Updates)

## Inputs you provide to the LLM each time
- The full note content (unchanged)
- The current Tag Index (or a curated excerpt if it grows large)
- The Tagging Standard (or a short "rules summary" version of it)

## Required behavior (instructions to the LLM)
- Do **not** rewrite the note content.
- Do **not** add wikilinks or restructure text.
- Produce tags using the namespaces: subject (none), `#f/`, `#x/`, `#w/`.
- Prefer existing canonical tags from the Tag Index.
- Create new tags only when necessary, and propose how to add them to the Tag Index.
- Output **only** what's needed for insertion + index maintenance.

## Output format (strict)
1) **TAGS_LINE** (exactly one line, ready to paste under frontmatter)
2) **INDEX_UPDATES**
   - New canonical tags to add (with definition + namespace + suggested synonyms)
   - Synonym/redirect suggestions (e.g., "treat `X` as alias of `Y` going forward")

(Optionally) **NOTES**: 1–2 bullets only if there's ambiguity.
