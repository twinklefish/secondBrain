# Weekly Review Script - Bug Fixes

## Issues Fixed

### 1. ✅ Time Range - Now Uses Source Note Date
**Problem:** Script was counting entries by when the inbox log was created, not when the original daily note was written.

**Solution:** Updated `queryWeeklyInboxLog()` to extract the date from `source_note` field (e.g., `[[2026-01-09]]`) and filter by that date instead of log creation date.

**Result:** Now correctly counts all entries from daily notes created within the last 7 days, regardless of when they were processed.

---

### 2. ✅ Category Counts - Cross-References with Folders
**Problem:** Weekly review showed "0 people" even though George Friedman existed in the People folder. Some items were created without inbox logs or logs were missing.

**Solution:** Added `getCategoryCountsFromFolders()` function that directly queries the category folders (People, Projects, Ideas, Admin) for files created in the last 7 days.

**Result:** Accurate counts even if inbox logs are missing, corrupted, or items were created manually.

---

### 3. ✅ Category Display - Always Shows All 4 Categories
**Problem:** Weekly review showed inconsistent category breakdowns like "0 people, 1 project, 2 ideas, 1 undefined" with mysterious "undefined" category.

**Solution:**
- Force display of all 4 standard categories: people, projects, ideas, admin
- Always show counts (including 0) for consistency
- Put `needs_review` in a separate section with clear explanation

**Result:** Clean, consistent format:
```
- Breakdown: 1 people, 1 projects, 3 ideas, 0 admin
```

---

### 4. ✅ "Needs Review" Clarification
**Problem:** Section called "Items Needing Review" was vague - unclear what kind of review was needed.

**Solution:** Renamed to **"Items Needing Manual Classification"** with explicit explanation:
```
X items routed to clarification due to low AI confidence - review in Notifications/Needs-Review.md
```

**Result:** Users understand this refers to entries with `status: needs_review` waiting for manual categorization.

---

## Technical Changes

### Modified Functions

**`generateWeeklyReview()`**
- Added call to `getCategoryCountsFromFolders()`
- Passes `categoryCounts` to context builder and review generator

**`queryWeeklyInboxLog()`**
- Changed from Dataview query to manual filtering
- Extracts date from `source_note` field using regex: `/\[\[(\d{4}-\d{2}-\d{2})\]\]/`
- Filters by `sourceDate >= sevenDaysAgo`

**`getCategoryCountsFromFolders()` (NEW)**
- Queries each category folder directly
- Counts files created in last 7 days
- Returns object: `{ people: X, projects: Y, ideas: Z, admin: W, needs_review: N }`

**`buildWeeklyContext()`**
- Now accepts `categoryCounts` parameter
- Replaces dynamic category counting with folder-based counts
- Shows all 4 categories explicitly

**`generateReview()`**
- Now accepts `categoryCounts` parameter
- Pre-fills the breakdown numbers in the prompt (AI doesn't recalculate)
- Updated "Needs Review" section with clearer explanation
- Added rule: "Use the EXACT numbers provided - do not recalculate"

---

## Example Output (Corrected)

```markdown
📅 **Week in Review**

**📊 Quick Stats:**
- Items captured: 5
- Breakdown: 1 people, 1 projects, 3 ideas, 0 admin

**🎯 What Moved Forward:**
- George Friedman added to People for Latin America tracking
- Front-office hiring project activated with clear next steps

**🔴 Open Loops (needs attention):**
1. Two AI-related ideas lack detail or connection to current work
2. One entry still needs manual classification (see below)

**💡 Patterns I Notice:**
Focus on 2026 strategic planning with AI and hiring themes. Light admin/task capture suggests possible capture friction.

**📌 Suggested Focus for Next Week:**
1. Expand AI ideas with concrete applications to current projects
2. Define hiring criteria for front-office roles
3. Resolve pending classification in Needs-Review.md

**🔧 Items Needing Manual Classification:**
1 items routed to clarification due to low AI confidence - review in Notifications/Needs-Review.md
```

---

## Testing Checklist

- [x] Fix source note date filtering
- [x] Add folder-based category counting
- [x] Force display of all 4 categories
- [x] Clarify "needs review" meaning
- [ ] Test with real weekly data
- [ ] Verify George Friedman (and other People) now shows in count
- [ ] Verify no more "undefined" categories

---

*Updated: 2026-01-10*
