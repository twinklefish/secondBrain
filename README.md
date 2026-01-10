# Obsidian Second Brain - Quick Start

This vault contains a complete, production-ready implementation of an AI-powered Second Brain system.

## 🚀 Quick Setup (5 minutes)

### 1. Install Required Plugins

In Obsidian, go to Settings → Community Plugins:

- **Templater** (for scripting)
- **Dataview** (for queries)
- **Daily Notes** or **Periodic Notes** (for daily note creation)

Enable all three plugins.

### 2. Configure Templater

Settings → Templater:
- **Template folder location:** `Templates`
- **Script files folder location:** `Scripts`
- **Enable "Trigger Templater on new file creation"**

### 3. Configure Daily Notes

Settings → Daily Notes:
- **New file location:** `0-Daily`
- **Date format:** `YYYY-MM-DD`
- **Template file location:** `Templates/Daily-Note-Template`

### 4. Add Your Groq API Key

1. Get a free API key from: https://console.groq.com/keys
2. Create `Scripts/groq-api-key.txt` with this content:
   ```
   # Groq API Key Configuration
   GROQ_API_KEY=gsk_your_actual_key_here
   ```
3. Save the file

**Note:** This file is git-ignored for security.

### 5. Create Your Dashboard

Your personal dashboard will show Dataview query results with your data.

1. Copy `Templates/Dashboard-Template.md`
2. Paste contents into a new file: `Dashboard.md` (in vault root)
3. The dashboard will auto-populate with your data as you use the system

**Important:** `Dashboard.md` is git-ignored because it will contain your personal data. The template is version-controlled for reference.

### 6. Enable Zero Data Retention (Privacy)

Visit: https://console.groq.com/settings/data-controls
Enable "Zero Data Retention"

---

## ✅ You're Ready!

### Daily Workflow

1. **Write in daily note** (Cmd/Ctrl + T creates today's note)
   - Separate thoughts with `---`
   - Use `@people:`, `@projects:`, `@ideas:`, or `@admin:` to force categorization

2. **Process when ready**
   - Open command palette (Cmd/Ctrl + P)
   - Run "Templater: Process Daily Note"
   - Check `Notifications/` folder for results

3. **Check your dashboard**
   - Open `Dashboard.md` to see your structured knowledge base

---

## 📚 Documentation

- **[Obsidian Second Brain Build Guide - CORRECTED.md](Obsidian Second Brain Build Guide - CORRECTED.md)** - Complete implementation guide with all scripts
- **[CLAUDE.md](CLAUDE.md)** - Technical reference for Claude Code instances
- **[FINISHING-TOUCHES-SUMMARY.md](FINISHING-TOUCHES-SUMMARY.md)** - Summary of recent improvements

---

## 🧪 Recommended: Run Smoke Tests

Before using with real data, run the 9 smoke tests in Part 10 of the build guide to verify everything works correctly.

---

## 📁 Vault Structure

```
SecondBrain/
├── 0-Daily/           # Your daily notes
├── People/            # Person records (auto-created)
├── Projects/          # Project records (auto-created)
├── Ideas/             # Idea records (auto-created)
├── Admin/             # Task records (auto-created)
├── Inbox-Log/         # Processing audit trail
├── Notifications/     # AI responses and digests
├── Templates/         # Note templates
├── Scripts/           # Processing scripts
│   └── .env          # API key (git-ignored)
└── Dashboard.md      # Your command center
```

---

## 🔒 Security Notes

- `Scripts/.env` contains your API key - NEVER commit to git
- `.gitignore` and `.claudeignore` are pre-configured for safety
- Enable Groq Zero Data Retention for maximum privacy

---

## 💰 Cost

- **Obsidian:** Free
- **Groq API:** ~$0.22/month (free tier covers typical personal use)
- **Total:** Free to $0.22/month

---

## 🆘 Troubleshooting

### "Groq API call failed"
- Check your API key in `Scripts/.env`
- Verify key is valid at https://console.groq.com/keys

### "No new entries to process"
- Make sure entries are separated by `---`
- Check `last_processed_offset` in daily note frontmatter

### "Dataview plugin not loaded"
- Enable Dataview in Community Plugins
- Restart Obsidian

### Dataview queries return empty
- Run smoke tests from Part 10 of build guide
- Check that frontmatter fields exist in created notes

---

## 🎯 What This System Does

1. **Captures everything** - Write freely in daily notes
2. **AI classifies** - Groq API categorizes each thought
3. **Creates structure** - Notes automatically filed to correct folders
4. **Merges duplicates** - Related info stays together
5. **Surfaces insights** - Daily digests and weekly reviews
6. **Handles clarifications** - Clean workflow for low-confidence items

**All while costing ~$0.22/month and protecting your privacy.**

---

## 🚦 Status

✅ All finishing touches complete
✅ Production-ready
✅ Smoke tests documented
✅ Security configured

**Next step:** Add your API key to `Scripts/.env` and start using!
