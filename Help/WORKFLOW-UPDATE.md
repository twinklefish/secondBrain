# Workflow Update - Process Daily Note with Auto-Inbox

## What Changed

### 1. Auto-Run Process Inbox
**Process Daily Note** now automatically detects if you're running it on an Inbox file and will:
1. First run **Process Inbox** to structure the content
2. Move the file from `Inbox/` → `Inbox-Archive/`
3. Create structured file in `0-Daily/`
4. Then automatically continue with classification

**New workflow:**
- Open any file in `Inbox/`
- Run **"Process Daily Note"** (one command!)
- It handles both steps automatically

**Old workflow (still works):**
- Run "Process Inbox" first (manual)
- Then run "Process Daily Note" (manual)

---

### 2. Task Section Skipped
The `## Tasks` section is now **completely ignored** during classification.

**What gets processed:**
- ✅ `## Journal` section
- ✅ `## Scratch Pad` section
- ❌ `## Tasks` section (skipped)

**Why:** Tasks are meant for manual completion tracking, not AI classification. They stay as clickable checkboxes for you to manage.

---

### 3. Delimiter Strategy
We continue using `---` as the entry delimiter, but now it only applies **within processable sections**.

**Example 0-Daily file:**
```markdown
## Journal

First journal entry about meeting with Sarah.

---

Second journal entry about project ideas.

---

## Tasks

- [ ] wash the dog
- [ ] buy eggs

---

## Scratch Pad

Random thought about a book I read.

---

Another scratch pad note.
```

**What happens:**
- Process Daily Note extracts 3 entries:
  1. "First journal entry about meeting with Sarah."
  2. "Second journal entry about project ideas."
  3. "Random thought about a book I read."
  4. "Another scratch pad note."
- Tasks section is completely skipped
- Section header `---` lines are ignored (only `---` within sections count)

---

## Quick Reference

### Single Command Workflow (Recommended)
1. Drop raw journal in `Inbox/2026-01-10.md`
2. Open the file
3. Run **"Process Daily Note"** (one command)
4. Done! Check `Notifications/` for results

### Two-Step Workflow (Still Supported)
1. Drop raw journal in `Inbox/2026-01-10.md`
2. Run **"Process Inbox"** → Creates `0-Daily/2026-01-10.md`
3. Run **"Process Daily Note"** → Classifies entries

---

## Technical Details

### Files Modified
- [Scripts/process-daily-note.js](../Scripts/process-daily-note.js)
  - Added `extractProcessableSections()` function to skip Tasks
  - Added auto-detection for Inbox files
  - Split main function into `processDailyNote()` and `processDailyNoteContent()`

### New Functions
```javascript
// Extracts only Journal and Scratch Pad sections
function extractProcessableSections(content)

// Handles both Inbox and 0-Daily files
async function processDailyNote(tp)

// Core processing logic (separated)
async function processDailyNoteContent(tp, activeFile, content)
```

---

## Testing Checklist

- [ ] Test auto-run: Open Inbox file → Run Process Daily Note → Should structure + classify
- [ ] Test Tasks skip: Add entry in Tasks section → Should not be classified
- [ ] Test Journal processing: Add entry in Journal with `---` delimiter → Should be classified
- [ ] Test Scratch Pad processing: Add entry in Scratch Pad → Should be classified
- [ ] Test manual workflow: Run Process Inbox first, then Process Daily Note → Should still work

---

*Updated: 2026-01-10*
