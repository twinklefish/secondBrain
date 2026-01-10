# Templates Folder

This folder contains all template files for your Second Brain system.

---

## 📋 Note Templates

These templates are used when creating new notes in each category:

- **Person-Template.md** - Template for People/ notes
- **Project-Template.md** - Template for Projects/ notes
- **Idea-Template.md** - Template for Ideas/ notes
- **Admin-Template.md** - Template for Admin/ tasks
- **Daily-Note-Template.md** - Template for 0-Daily/ notes

**Usage:** Configured in Templater plugin settings to auto-apply to new files.

---

## 🚀 Dashboard Template

**Dashboard-Template.md** - Clean template for creating/resetting your dashboard

**Purpose:**
- **Version controlled** - Safe to commit to git (contains no personal data)
- **Reference** - Shows default dashboard structure
- **Reset tool** - Use to recreate Dashboard.md if needed

**How to use:**
1. Delete or rename your current `Dashboard.md`
2. Run Templater on this template (or copy contents)
3. Save as `Dashboard.md` in vault root

**Important:**
- `Dashboard.md` (in vault root) is **git-ignored** because it contains personal data from Dataview queries
- `Templates/Dashboard-Template.md` is **committed to git** as a clean template
- Never commit the active `Dashboard.md`!

---

## 🏃 Runner Templates

See [Runners/README.md](Runners/README.md) for script execution templates.

---

## 🔧 Template Variables

All templates use Templater syntax:

- `<% tp.date.now("YYYY-MM-DD") %>` - Current date
- `<% tp.file.title %>` - Note title
- `{{PLACEHOLDER}}` - Replaced by script processing

---

## 📁 Template Structure

```
Templates/
├── README.md                  # This file
├── Person-Template.md         # People notes
├── Project-Template.md        # Project notes
├── Idea-Template.md           # Idea notes
├── Admin-Template.md          # Admin tasks
├── Daily-Note-Template.md     # Daily notes
├── Dashboard-Template.md      # Dashboard (version controlled)
└── Runners/                   # Script runners
    ├── README.md
    ├── Run - Process Daily Note.md
    ├── Run - Generate Daily Digest.md
    ├── Run - Generate Weekly Review.md
    ├── Run - Reclassify Entry.md
    └── Run - Archive Old Logs.md
```

---

## ⚠️ Git Safety

**Committed to git:**
- ✅ All template files (contain no personal data)
- ✅ Dashboard-Template.md (clean template)
- ✅ Runner templates (script execution only)

**NOT committed to git:**
- ❌ Dashboard.md (contains personal Dataview query results)
- ❌ Any files in 0-Daily/, People/, Projects/, Ideas/, Admin/
- ❌ Scripts/groq-api-key.txt

**Why:**
Templates are structural/code. Active notes and dashboard contain your personal data.

---

**Last Updated:** 2026-01-10
