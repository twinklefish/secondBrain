---
type: person
name: "{{NAME}}"
created: <% tp.date.now("YYYY-MM-DD") %>
last_touched: <% tp.date.now("YYYY-MM-DD") %>
tags: [{{TAGS}}]
source_note: "[[{{SOURCE}}]]"
confidence: {{CONFIDENCE}}
context: |
  {{CONTEXT}}
follow_ups: |
  {{FOLLOWUPS}}
---

# {{NAME}}

## Quick Reference
- **Context:** {{CONTEXT}}
- **Follow-ups:** {{FOLLOWUPS}}

## History
- <% tp.date.now("YYYY-MM-DD") %>: Created via AI classification

---
*Source: [[{{SOURCE}}]] | Confidence: {{CONFIDENCE}}*
