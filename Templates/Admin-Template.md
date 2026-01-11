---
type: admin
name: "{{NAME}}"
status: todo
due_date: {{DUE_DATE}}
created: <% tp.date.now("YYYY-MM-DD") %>
last_touched: <% tp.date.now("YYYY-MM-DD") %>
source_note: "[[{{SOURCE}}]]"
confidence: {{CONFIDENCE}}
notes: |
  {{NOTES}}
---

tags:: {{TAGS}}

# {{NAME}}

- [ ] {{NAME}}

**Due:** {{DUE_DATE}}

## Notes
{{NOTES}}

---
*Source: [[{{SOURCE}}]] | Confidence: {{CONFIDENCE}}*
