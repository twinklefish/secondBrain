# Second Brain Dashboard

Last updated: <% tp.date.now("YYYY-MM-DD HH:mm:ss") %>

---

## 📊 Quick Stats

```dataview
TABLE length(rows) as "Count"
FROM "Inbox-Log"
WHERE created >= date(today) - dur(7 days)
GROUP BY filed_to
SORT filed_to ASC
```

---

## 🎯 Active Projects

```dataview
TABLE
  status as "Status",
  next_action as "Next Action",
  last_touched as "Last Updated"
FROM "Projects"
WHERE status = "active"
SORT last_touched DESC
LIMIT 15
```

---

## 👥 People with Follow-ups

```dataview
TABLE
  follow_ups as "Follow-up",
  last_touched as "Last Contact"
FROM "People"
WHERE follow_ups != null AND follow_ups != ""
SORT last_touched ASC
LIMIT 10
```

---

## ⚠️ Tasks Due Soon

```dataview
TABLE
  due_date as "Due",
  status as "Status"
FROM "Admin"
WHERE status = "todo" AND due_date >= date(today)
SORT due_date ASC
LIMIT 10
```

---

## 🔧 Items Needing Review

```dataview
TABLE
  original_text as "Original Text",
  confidence as "Confidence",
  created as "When"
FROM "Inbox-Log"
WHERE status = "needs_review"
SORT created DESC
LIMIT 10
```

---

## 💡 Recent Ideas

```dataview
TABLE
  one_liner as "One-Liner",
  created as "When"
FROM "Ideas"
SORT created DESC
LIMIT 10
```

---

## 🗃️ Processing History (Last 7 Days)

```dataview
TABLE
  filed_to as "Category",
  destination_name as "Filed As",
  confidence as "Confidence",
  status as "Status"
FROM "Inbox-Log"
WHERE created >= date(today) - dur(7 days)
SORT created DESC
LIMIT 20
```

---

## Commands Reference

**Processing:**
- `Process Daily Note` - Classify new entries from today's note
- `Re-classify Pending Entries` - Process checked items from Needs-Review.md

**Digests:**
- `Generate Daily Digest` - Create morning action plan
- `Generate Weekly Review` - Create weekly summary and insights

**Maintenance:**
- `Archive Old Logs` - Move Inbox-Log entries >90 days to Archive/
