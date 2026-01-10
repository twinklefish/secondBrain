---
type: inbox-log
created: <% tp.date.now("YYYY-MM-DD HH:mm:ss") %>
entry_hash: "{{ENTRY_HASH}}"
original_text: |
  {{ORIGINAL_TEXT}}
filed_to: "{{FILED_TO}}"
destination_name: "{{DEST_NAME}}"
destination_link: "[[{{DEST_LINK}}]]"
confidence: {{CONFIDENCE}}
status: {{STATUS}}
source_note: "[[{{SOURCE}}]]"
---

# Inbox Log - <% tp.date.now("YYYY-MM-DD HH:mm") %>

**Original Text:**
> {{ORIGINAL_TEXT}}

**Filed To:** {{FILED_TO}}
**Destination:** [[{{DEST_LINK}}]]
**Confidence:** {{CONFIDENCE}}
**Status:** {{STATUS}}
**Hash:** `{{ENTRY_HASH}}`

---
*Processed on <% tp.date.now("YYYY-MM-DD HH:mm:ss") %>*
