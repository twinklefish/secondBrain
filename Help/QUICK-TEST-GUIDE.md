# Quick Test Guide

## Ready to Test! ✅

All scripts have been fixed with inlined Groq API functions. The module loading error should now be resolved.

---

## Test 1: Daily Digest (Easiest)

This test doesn't require any daily note content, just existing vault data.

### Steps:
1. **Restart Obsidian** (if you haven't already)
2. Open **Command Palette** (Ctrl/Cmd + P)
3. Type "**Templater**" and select "**Templater: Insert**" or "**Templater: Open Insert Template**"
4. Navigate to **Runners/** folder
5. Select **"Run - Generate Daily Digest"**

### Expected Result:
- Notice appears: "Generating daily digest..."
- New file created: `Notifications/Daily-Digest-[timestamp].md`
- Content shows your active projects, people, and tasks

### If It Works:
✅ Groq API integration is working
✅ Dataview queries are working
✅ File creation is working

### If You Get an Error:
Check the error message and:
- Verify API key in `Scripts/.env`
- Check Obsidian console (Ctrl/Cmd + Shift + I) for details
- Verify Dataview plugin is enabled

---

## Test 2: Process Daily Note (Full Workflow)

This tests the complete entry processing pipeline.

### Steps:
1. Create or open today's daily note in `0-Daily/`
2. Add some test content:
   ```
   ---

   Quick meeting with Sarah about the new project. She'll send specs by Friday.

   ---

   @projects: Build customer dashboard with analytics

   ---

   Remember to follow up with the vendor about the quote
   ```

3. Open **Command Palette**
4. Select **Templates/Runners/Run - Process Daily Note**

### Expected Result:
- Notice: "Found 3 potential entries..."
- Notice: "Processing 3 new entries..."
- Three new files created:
  - `People/Sarah.md` (from first entry)
  - `Projects/Build customer dashboard with analytics.md` (from @projects override)
  - `Admin/Follow up with the vendor about the quote.md` (from third entry)
- Three log entries created in `Inbox-Log/`
- Summary notification created in `Notifications/`

### If It Works:
✅ Entry parsing is working
✅ Hash-based deduplication is working
✅ Category override is working
✅ AI classification is working
✅ File creation is working

---

## Test 3: Idempotency Check

**Important:** This verifies you won't get duplicates.

### Steps:
1. **Without adding any new content** to your daily note
2. Run **"Run - Process Daily Note"** again

### Expected Result:
- Notice: "All entries already processed"
- No new files created
- No duplicate records

### If It Works:
✅ Hash-based deduplication is working correctly

---

## Test 4: Weekly Review (Optional)

Only works if you have Inbox-Log entries from the past 7 days.

### Steps:
1. Open **Command Palette**
2. Select **Templates/Runners/Run - Generate Weekly Review**

### Expected Result:
- New file: `Notifications/Weekly-Review-[date].md`
- Contains insights about captured items and project status

---

## Troubleshooting

### Error: "Dataview plugin not loaded"
**Fix:** Enable Dataview in Settings → Community Plugins

### Error: "Cannot find module"
**Fix:** The scripts should now have inlined Groq API - if you still see this, check that you restarted Obsidian after the fix

### Error: "Failed to generate digest: 401"
**Fix:** Check your API key in `Scripts/.env` - make sure it starts with `gsk_`

### Error: "No active daily note found"
**Fix:** Make sure you're processing a file in the `0-Daily/` folder with the correct frontmatter format

### No errors but no output
**Fix:** Check the Obsidian developer console (Ctrl/Cmd + Shift + I) for hidden errors

---

## Success Criteria

If **Test 1** (Daily Digest) works:
- ✅ Core system is functional
- ✅ Ready for daily use

If **Tests 1-3** all work:
- ✅ Full system verified
- ✅ Ready for production use
- ✅ Proceed to enable Groq ZDR and update SETUP-STATUS.md

---

## After Successful Testing

1. **Enable Groq Zero Data Retention**:
   - Visit: https://console.groq.com/settings/data-controls
   - Enable ZDR

2. **Update SETUP-STATUS.md**:
   - Mark Step 6 complete
   - Mark Step 7 complete

3. **Start using the system!**

---

**Ready? Restart Obsidian and run Test 1!** 🚀
