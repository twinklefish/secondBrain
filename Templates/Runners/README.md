# Templater Runner Templates

These templates execute Templater user scripts without inserting content into the current note.

## Available Runners

### 📝 Run - Process Daily Note
**Purpose:** Process all new entries in the current daily note
**When to use:** After capturing thoughts in your daily note
**Required:** Must have an active daily note open
**Output:** Creates records in People/Projects/Ideas/Admin + Inbox-Log entries

---

### ☀️ Run - Generate Daily Digest
**Purpose:** Generate morning action plan
**When to use:** Start of each day
**Required:** Active projects, people, and admin tasks in vault
**Output:** Creates notification in Notifications/Daily-Digest-[timestamp].md

---

### 📅 Run - Generate Weekly Review
**Purpose:** Generate weekly insights and patterns
**When to use:** End of week (Sunday evening or Monday morning)
**Required:** Inbox-Log entries from past 7 days
**Output:** Creates notification in Notifications/Weekly-Review-[date].md

---

### 🔄 Run - Reclassify Entry
**Purpose:** Re-process entries that needed clarification
**When to use:** After editing Notifications/Needs-Review.md and checking boxes
**Required:** Checked tasks in Needs-Review.md
**Output:** Creates/updates records based on manual category selection

---

### 🗃️ Run - Archive Old Logs
**Purpose:** Move Inbox-Log entries older than 90 days to archive
**When to use:** Monthly maintenance (or when Inbox-Log gets large)
**Required:** Inbox-Log entries with created dates
**Output:** Moves old logs to Inbox-Log/Archive/ + creates summary notification

---

## How to Use

1. Open **Command Palette** (Ctrl/Cmd + P)
2. Type "**Templater: Insert**" or "**Templater: Open Insert**"
3. Select one of the "Run - ..." templates
4. The script executes without inserting anything into your note
5. Check Notifications/ folder for results

**Tip:** You can also assign hotkeys to these templates in Obsidian Settings → Hotkeys

---

## Technical Details

These templates use the `<%* ... %>` execution block syntax, which:
- Runs the code immediately
- Does not insert any output into the current note
- Uses bracket notation `tp.user["script-name"]` for hyphenated filenames

**Script Location:** All scripts are in the `Scripts/` folder and loaded as Templater user scripts.

---

## Troubleshooting

**"tp.user[...] is not a function" error:**
1. Check that Templater's Script folder location is set to `Scripts`
2. Restart Obsidian
3. Verify the script file exists in Scripts/

**"Dataview plugin not loaded" error:**
- Enable the Dataview plugin in Settings → Community Plugins

**No output/notification created:**
- Check the Obsidian developer console (Ctrl/Cmd + Shift + I) for errors
- Verify your Groq API key is set in Scripts/.env
