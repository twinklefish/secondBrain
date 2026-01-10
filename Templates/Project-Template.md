---
type: project
name: "{{NAME}}"
status: {{STATUS}}
created: <% tp.date.now("YYYY-MM-DD") %>
last_touched: <% tp.date.now("YYYY-MM-DD") %>
tags: [{{TAGS}}]
source_note: "[[{{SOURCE}}]]"
confidence: {{CONFIDENCE}}
next_action: |
  {{NEXT_ACTION}}
notes: |
  {{NOTES}}
---

# {{NAME}}

**Status:** {{STATUS}}

## Next Action
{{NEXT_ACTION}}

## Notes
{{NOTES}}

## History
- <% tp.date.now("YYYY-MM-DD") %>: Created

---
*Source: [[{{SOURCE}}]] | Confidence: {{CONFIDENCE}}*
