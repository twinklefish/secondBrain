# Batch Processing Guide for Legacy Journals

This guide explains how to import and process 2 years of legacy journal entries into your Second Brain system.

---

## Overview

The batch processing workflow automatically:
1. ✅ Adds `---` delimiters between distinct ideas (AI-powered)
2. ✅ Structures entries into Daily Note format
3. ✅ Classifies entries to People/Projects/Ideas/Admin categories
4. ✅ Creates audit trail in Inbox-Log
5. ✅ Generates weekly reviews for all historical weeks

---

## Prerequisites

- [ ] Groq API key configured in `Scripts/groq-api-key.txt`
- [ ] Templater plugin installed and configured
- [ ] Dataview plugin installed
- [ ] All existing scripts tested and working
- [ ] Backup of your legacy journals (just in case!)

---

## Step-by-Step Process

### Step 1: Prepare Legacy Journals

1. **Create folder:** `Legacy-Import/` in your vault root
2. **Copy files:** Place all your legacy journal markdown files in `Legacy-Import/`
3. **File naming:** Files can be named:
   - `YYYY-MM-DD.md` (e.g., `2024-03-15.md`)
   - `YYYY-MM-DD Title.md` (e.g., `2024-03-15 Meeting Notes.md`)
   - Any markdown file with a date in the filename

**Expected structure:**
```
Legacy-Import/
├── 2024-01-01.md
├── 2024-01-02.md
├── 2024-01-03 Team Meeting.md
├── 2024-01-04.md
└── ... (hundreds more)
```

### Step 2: Run Batch Processor

1. Open command palette (Ctrl/Cmd + P)
2. Run: **"Templater: Run - Batch Process Legacy Journals"**
3. Wait for processing to complete

**What happens:**
- Script scans all files in `Legacy-Import/`
- Skips task files (files with "task" in name)
- Skips files that already have `---` delimiters
- For each file:
  - AI adds `---` delimiters between major topics
  - Moves file to `Inbox/`
  - Processes to `0-Daily/` (structured format)
  - Classifies entries to category folders
- Shows progress: `[243/500] Processing 2024-03-15...`
- Handles errors gracefully (skips failed files, logs errors)

**Estimated time:**
- ~3 seconds per file
- 500 files = ~25 minutes
- 2 years ≈ 730 files = ~40 minutes

**API cost estimate:**
- ~500 tokens per file (delimiter + structuring + classification)
- 730 files × 500 tokens = 365,000 tokens
- Cost: ~$0.55 for 2 years of journals

### Step 3: Review Batch Summary

After batch processing completes:

1. Check `Notifications/Batch-Processing-[timestamp].md`
2. Review summary:
   - Total processed
   - Failed files (if any)
   - Error details
3. Manually process any failed files if needed

### Step 4: Generate Historical Weekly Reviews

1. Open command palette (Ctrl/Cmd + P)
2. Run: **"Templater: Run - Generate Historical Reviews"**
3. Wait for processing to complete

**What happens:**
- Scans `Inbox-Log/` for all unique weeks with data
- Generates AI-powered weekly review for each week
- Creates files: `Notifications/Historical-Weekly-Review-[week-start].md`
- Shows progress: `[12/104] Week of 2024-03-04...`

**Estimated time:**
- ~2 seconds per week
- 2 years ≈ 104 weeks = ~3-4 minutes

**API cost estimate:**
- ~1,500 tokens per review
- 104 weeks × 1,500 tokens = 156,000 tokens
- Cost: ~$0.23 for 2 years of weekly reviews

### Step 5: Archive Old Logs

1. Open command palette (Ctrl/Cmd + P)
2. Run: **"Templater: Run - Archive Old Logs"**
3. Inbox logs older than 90 days moved to `Inbox-Log/Archive/`

---

## Total Cost & Time Estimates

**For 2 years of daily journals (730 files):**

| Task | Time | API Cost |
|------|------|----------|
| Batch process journals | ~40 min | ~$0.55 |
| Generate weekly reviews | ~4 min | ~$0.23 |
| **Total** | **~44 min** | **~$0.78** |

*Note: Costs based on Groq pricing for moonshotai/kimi-k2-instruct-0905 model*

---

## Troubleshooting

### Issue: "Legacy-Import/ folder not found"
**Solution:** Create the folder in your vault root and add files

### Issue: "No markdown files found in Legacy-Import/"
**Solution:** Ensure you copied `.md` files (not .txt or other formats)

### Issue: Batch processing fails on specific file
**Solution:**
1. Check error log in batch summary notification
2. Open the specific file and review format
3. Process manually using "Process Legacy Journal" if needed
4. Files with unusual formatting may need manual attention

### Issue: Some entries not classified correctly
**Solution:**
1. Check `Notifications/Needs-Review.md` for low-confidence items
2. Use "Re-classify Pending Entries" to fix misclassifications
3. Adjust confidence threshold if needed

### Issue: API rate limits
**Solution:**
- Groq free tier: 6K tokens/minute, 100K tokens/day
- Batch processor includes rate limiting (500ms delay between files)
- If hitting limits, process in smaller batches (move 100 files at a time to Legacy-Import/)

---

## After Import: What's Next?

Once batch processing is complete:

1. **Explore Your Data:**
   - Browse `People/` - all contacts extracted from 2 years
   - Browse `Projects/` - all projects identified
   - Browse `Ideas/` - all ideas captured
   - Browse `Admin/` - all tasks/admin items

2. **Review Weekly Insights:**
   - Read `Notifications/Historical-Weekly-Review-*.md` files
   - Identify patterns across weeks/months
   - Note recurring themes or stalled projects

3. **Clean Up:**
   - Delete `Legacy-Import/` folder (files are now in Inbox-Archive/)
   - Delete `Test-Legacy/` folder (sample test files)
   - Run "Archive Old Logs" if needed

4. **Start Using System:**
   - Create new entries in `Inbox/` or `0-Daily/`
   - Run "Process Daily Note" as normal
   - Generate current week's review weekly

---

## Folder Structure After Import

```
Your-Vault/
├── 0-Daily/           # 730 structured daily notes
├── People/            # 50-200+ person notes (depends on your network)
├── Projects/          # 20-50+ project notes
├── Ideas/             # 100-300+ idea notes
├── Admin/             # 50-100+ admin/task notes
├── Inbox-Log/         # Audit trail of all classifications
│   └── Archive/       # Old logs (>90 days)
├── Notifications/     # Processing summaries + weekly reviews
│   ├── Batch-Processing-*.md
│   ├── Historical-Weekly-Review-*.md (104 files for 2 years)
│   └── Historical-Reviews-Summary-*.md
└── Inbox-Archive/     # Original legacy journals (730 files)
```

---

## Tips for Success

1. **Start Small:** Test with 10-20 files first before processing all 2 years
2. **Monitor Console:** Open Developer Console (Ctrl+Shift+I) to see detailed logs
3. **Backup First:** Keep originals somewhere safe outside Obsidian
4. **Check Categorization:** Review a few random entries to ensure AI is classifying correctly
5. **Adjust Prompts:** If misclassifications are common, tweak prompts in scripts

---

## Script Files Reference

- **`Scripts/process-legacy-batch.js`** - Master batch processor
- **`Scripts/generate-historical-reviews.js`** - Historical weekly review generator
- **`Scripts/process-legacy-journal.js`** - Single-file delimiter adder
- **`Templates/Runners/Run - Batch Process Legacy Journals.md`** - Batch runner
- **`Templates/Runners/Run - Generate Historical Reviews.md`** - Review runner

---

## Support

If you encounter issues:
1. Check error logs in Notifications folder
2. Review console logs for detailed error messages
3. Process failed files individually to isolate issues
4. Adjust prompts if AI categorization needs improvement

---

*Last updated: 2026-01-10*
