# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This repository contains **documentation and implementation guides** for building a "Second Brain" personal knowledge management system in two variants:

1. **Original Architecture** ([Second Brain Build Guide.md](Second Brain Build Guide.md))
   - No-code system using Slack + Notion + Zapier
   - Documented for reference and inspiration

2. **Obsidian Implementation** ([Obsidian Second Brain Build Guide - CORRECTED.md](Obsidian Second Brain Build Guide - CORRECTED.md))
   - Pure Obsidian workflow with Templater + Dataview + Groq API
   - Production-ready with architectural improvements
   - **This is the active, maintained version**

---

## System Architecture (Obsidian Implementation)

### Core Components

**1. AI-Powered Classification**
- **Provider:** Groq API with Kimi-k2 (`moonshotai/kimi-k2-instruct-0905`)
- **Cost:** ~$0.22/month (free tier compatible)
- **Privacy:** Zero Data Retention (ZDR) enabled
- **Output:** Structured JSON with category + confidence + extracted fields

**2. Processing Pipeline**
```
Daily Note → Extract Entries → Hash Check → Classify → Create/Merge → Log → Notify
```

**3. Folder Structure (Notion-style Databases)**
```
People/      - Person notes with context & follow-ups
Projects/    - Project notes with status & next actions
Ideas/       - Idea notes with one-liners
Admin/       - Admin tasks with due dates
Inbox-Log/   - Audit trail of all classifications
Notifications/ - AI responses, digests, clarifications
```

---

## Pre-Flight Checklist (Before First Real Use)

Before using the system with real data, verify these critical items:

### ✅ 1. API Key Security
- [ ] `Scripts/.env` file exists with format: `GROQ_API_KEY=gsk_...` (no quotes, no spaces)
- [ ] `.gitignore` includes `Scripts/.env` (if using git)
- [ ] Groq Zero Data Retention enabled at https://console.groq.com/settings/data-controls
- [ ] Test API key loads: Run "Process Daily Note" → Should NOT see "YOUR_GROQ_API_KEY_HERE" error

### ✅ 2. Script Exports (Critical for Re-classifier)
The `process-daily-note.js` script must export `createOrUpdateRecord` for the re-classifier:

```javascript
// At end of process-daily-note.js
module.exports = processDailyNote;
module.exports.createOrUpdateRecord = createOrUpdateRecord;  // CRITICAL: Add this line
```

Without this export, re-classification will fail with "undefined function" error.

### ✅ 3. Frontmatter Format (Critical for Dataview)
Verify `Admin-Template.md` has **unquoted** `due_date`:

```markdown
---
due_date: {{DUE_DATE}}   ← CORRECT (no quotes)
---
```

NOT:
```markdown
---
due_date: "{{DUE_DATE}}"   ← WRONG (Dataview can't compare quoted dates)
---
```

Test with this query - should work without errors:
```dataview
TABLE due_date FROM "Admin" WHERE due_date >= date(today) SORT due_date ASC
```

### ✅ 4. Smoke Tests Completed
Run all 9 smoke tests from Part 10 of the build guide:
- [ ] Test 1: Basic processing (4 entries → 4 files)
- [ ] Test 2: Idempotency (re-run creates no duplicates)
- [ ] Test 3: File collision merge
- [ ] Test 4: Category override (`@people:`)
- [ ] Test 5: Needs review workflow
- [ ] Test 6: Dataview queries work
- [ ] Test 7: Daily digest generates
- [ ] Test 8: Weekly review generates
- [ ] Test 9: Archive command works

### ✅ 5. Folder Structure Exists
```
0-Daily/
People/
Projects/
Ideas/
Admin/
Inbox-Log/
  └── Archive/  (will be created automatically)
Notifications/
Templates/
Scripts/
```

### Quick Verification Commands

Run these in Dashboard.md to verify everything works:

```dataview
# Should return EMPTY (no duplicate hashes)
TABLE length(rows) as "Count"
FROM "Inbox-Log"
WHERE created >= date(today)
GROUP BY entry_hash
HAVING length(rows) > 1
```

```dataview
# Should show people with follow-ups (tests frontmatter fields)
TABLE follow_ups, last_touched
FROM "People"
WHERE follow_ups != null AND follow_ups != ""
```

```dataview
# Should show tasks due soon (tests unquoted date comparison)
TABLE due_date
FROM "Admin"
WHERE due_date >= date(today)
SORT due_date ASC
```

If any query fails, see **Section 5: Debugging** below.

---

## Critical Implementation Patterns

### 1. Hash-Based Deduplication

**Purpose:** Prevent duplicate processing of the same entry.

**Implementation:**
```javascript
function hashEntry(text) {
    // FNV-1a hash algorithm
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return `h${(hash >>> 0).toString(36)}`;
}

async function getProcessedHashes() {
    const dv = app.plugins.plugins.dataview.api;
    const logs = dv.pages('"Inbox-Log"')
        .where(p => p.entry_hash)
        .map(p => p.entry_hash);
    return new Set(logs.array());
}
```

**Usage:**
- Every entry gets a unique hash based on its content
- Hashes stored in Inbox-Log frontmatter (`entry_hash` field)
- Before processing, check if hash exists in Inbox-Log
- Skip entries with seen hashes (idempotent processing)

**File Location:** [Obsidian Second Brain Build Guide - CORRECTED.md:513-532](Obsidian Second Brain Build Guide - CORRECTED.md#L513-L532)

---

### 2. File Collision Merge Strategy

**Purpose:** When two entries classify to the same person/project, merge instead of overwriting.

**Key Functions:**
```javascript
async function createOrUpdateRecord(tp, classification, originalText, entryHash, sourceNote) {
    const existingFile = app.vault.getAbstractFileByPath(filePath);

    if (!existingFile) {
        // Create new file
        await app.vault.create(filePath, content);
        return { status: "filed" };
    } else {
        // Merge into existing file
        await mergeIntoExisting(existingFile, classification, originalText, sourceNote);
        return { status: "merged" };
    }
}

async function mergeIntoExisting(file, classification, originalText, sourceNote) {
    // 1. Parse existing frontmatter
    // 2. Update fields: last_touched, confidence, follow_ups, next_action, etc.
    // 3. Append history entry to body
    // 4. Write merged content back
}
```

**Merge Rules:**
- `last_touched` → Always update to current date
- `confidence` → Take maximum of existing and new
- `follow_ups`, `notes` → Append with bullet points (avoid duplicates)
- `status`, `next_action` → Use new value
- Body → Append "Merged from [[source]]" with timestamp

**File Location:** [Obsidian Second Brain Build Guide - CORRECTED.md:792-846](Obsidian Second Brain Build Guide - CORRECTED.md#L792-L846)

---

### 3. Category Override Syntax

**Purpose:** Bypass AI classification for explicit categorization.

**Syntax:**
```markdown
@people: Sarah mentioned she's looking for a new job
@projects: Build onboarding flow for new users
@ideas: What if we added a dark mode to the app?
@admin: Renew car registration by Jan 15th
```

**Detection:**
```javascript
function detectCategoryOverride(text) {
    const overrideMatch = text.match(/^@(people|projects|ideas|admin):\s*(.+)/si);
    if (!overrideMatch) return null;

    const [_, category, content] = overrideMatch;
    return {
        category,
        text: content.trim(),
        confidence: 1.0,
        isOverride: true
    };
}
```

**Benefits:**
- Skips AI API call (faster, no cost)
- Confidence set to 1.0 (manual override)
- Still extracts structured data from content
- Useful for obvious categorizations

**File Location:** [Obsidian Second Brain Build Guide - CORRECTED.md:566-580](Obsidian Second Brain Build Guide - CORRECTED.md#L566-L580)

---

### 4. Frontmatter for Dataview Compatibility

**Problem:** Original guide put key fields in note body, breaking Dataview queries.

**Solution:** Move all queryable fields to YAML frontmatter.

**Example (Person Template):**
```markdown
---
type: person
name: "Jane Doe"
created: 2026-01-09
last_touched: 2026-01-09
tags: [work, friend]
source_note: "[[2026-01-09]]"
confidence: 0.85
context: |
  Met at conference, works in product management
follow_ups: |
  - Ask about job search status
  - Share contact for hiring manager
---

# Jane Doe

## Quick Reference
- **Context:** Met at conference, works in product management
- **Follow-ups:** Ask about job search status...
```

**Dataview Query:**
```dataview
TABLE
  follow_ups as "Follow-up",
  last_touched as "Last Contact"
FROM "People"
WHERE follow_ups != null AND follow_ups != ""
SORT last_touched ASC
```

**Critical Detail:** Use `|` for multi-line fields in YAML:
```yaml
follow_ups: |
  - Line 1
  - Line 2
```

**File Location:** [Obsidian Second Brain Build Guide - CORRECTED.md:128-234](Obsidian Second Brain Build Guide - CORRECTED.md#L128-L234)

---

### 5. Rolling Task List for Clarifications

**Purpose:** Clean UX for handling low-confidence classifications.

**Workflow:**
1. Entry with confidence <0.6 creates clarification notification
2. Task appended to `Notifications/Needs-Review.md`:
   ```markdown
   - [ ] **2026-01-09-142305** | Hash: `h3a2b1c` | [[2026-01-09]]
     - Category: [people/projects/ideas/admin]
     - Original: Met John at the park...
     - Reason: Unclear classification
   ```
3. User edits "Category: [...]" line to specify correct category
4. User checks the box `[x]`
5. User runs "Re-classify Pending Entries" command
6. Script reads checked tasks, re-classifies with forced category, creates notes
7. Task removed from Needs-Review.md

**Key Function:**
```javascript
async function reclassifyPendingEntries(tp) {
    // 1. Read Needs-Review.md
    // 2. Parse checked tasks (match /^- \[x\]/i)
    // 3. Extract hash and category override
    // 4. Find original text in Inbox-Log by hash
    // 5. Re-classify with forced category
    // 6. Create/merge record
    // 7. Remove completed tasks from file
}
```

**File Location:** [Obsidian Second Brain Build Guide - CORRECTED.md:856-918](Obsidian Second Brain Build Guide - CORRECTED.md#L856-L918)

---

## Groq API Integration

### API Key Loading (Updated Implementation)

**CRITICAL:** The API key loading mechanism has been updated for security and reliability.

**Current Implementation:**
```javascript
// In groq-api.js
async function loadAPIKey() {
    try {
        const envFile = app.vault.getAbstractFileByPath("Scripts/.env");
        if (envFile) {
            const content = await app.vault.read(envFile);
            const match = content.match(/GROQ_API_KEY=(.+)/);
            if (match) return match[1].trim();
        }
    } catch (e) {
        console.error("Failed to load API key from .env:", e);
    }
    // Fallback: hardcoded (for testing only)
    return "YOUR_GROQ_API_KEY_HERE";
}

let API_KEY;
async function ensureAPIKey() {
    if (!API_KEY) {
        API_KEY = await loadAPIKey();
    }
    return API_KEY;
}

// In callGroqAPI()
const key = await ensureAPIKey(); // Called at start of each API request
```

**Setup Steps:**
1. Create `Scripts/.env` with format: `GROQ_API_KEY=gsk_your_key_here`
2. Add to `.gitignore`: `Scripts/.env`
3. The script will automatically load the key on first API call

**Why This Works:**
- Uses Obsidian's native `app.vault.read()` (reliable, no file:// protocol issues)
- Loads key lazily (only when needed)
- Caches key after first load (performance)
- Graceful fallback for testing (warns if key not found)

**File Location:** [Obsidian Second Brain Build Guide - CORRECTED.md:345-365](Obsidian Second Brain Build Guide - CORRECTED.md#L345-L365)

### Configuration

**Model:** `moonshotai/kimi-k2-instruct-0905`
- Context: 256K tokens
- Speed: 200+ tokens/second
- Cost: $1.50/M tokens blended

**API Wrapper Features:**
- Automatic retry with exponential backoff
- Rate limit handling (429 errors)
- JSON mode enforcement (`response_format: {type: "json_object"}`)
- Validation of response structure
- Temperature=0 for deterministic results

**Code:**
```javascript
async function callGroqAPI(prompt, options = {}) {
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
            const response = await fetch(`${config.baseURL}/chat/completions`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "moonshotai/kimi-k2-instruct-0905",
                    messages: [{ role: "user", content: prompt }],
                    max_tokens: config.maxTokens,
                    temperature: 0,
                    response_format: { type: "json_object" }
                })
            });

            // Parse, clean markdown, validate, return
        } catch (error) {
            // Retry with backoff if retryable error
        }
    }
}
```

**File Location:** [Obsidian Second Brain Build Guide - CORRECTED.md:249-311](Obsidian Second Brain Build Guide - CORRECTED.md#L249-L311)

---

### Security Best Practices

**API Key Storage:**

**Option 1 (Recommended): External file**
```javascript
const API_KEY = await fetch("file:///home/user/.config/obsidian/groq-api-key")
    .then(r => r.text())
    .then(t => t.trim());
```

Create `~/.config/obsidian/groq-api-key`:
```
gsk_your_actual_key_here
```

Set permissions:
```bash
chmod 600 ~/.config/obsidian/groq-api-key
```

**Option 2: Git-ignored file in vault**
```
Scripts/.env
```

Add to `.gitignore`:
```
Scripts/.env
Scripts/groq-api-key.txt
```

**Zero Data Retention:**
1. Visit https://console.groq.com/settings/data-controls
2. Enable "Zero Data Retention"
3. Confirm no inference data is stored

**File Location:** [Obsidian Second Brain Build Guide - CORRECTED.md:1525-1568](Obsidian Second Brain Build Guide - CORRECTED.md#L1525-L1568)

---

## Common Workflows

### Daily Workflow

1. **Throughout the day:** Write in daily note
   - Separate thoughts with `---`
   - Use `@category: text` for explicit categorization
   - Write naturally

2. **When ready (manual trigger):**
   - Open command palette (Ctrl/Cmd + P)
   - Run "Templater: Process Daily Note"
   - Wait ~5-30 seconds

3. **Check results:**
   - Open `Notifications/Processing-Summary-*.md`
   - Review what was filed/merged
   - Check for clarifications

4. **Handle clarifications (if any):**
   - Open `Notifications/Needs-Review.md`
   - Edit category for each entry
   - Check boxes
   - Run "Templater: Re-classify Pending Entries"

### Weekly Workflow

1. **Generate review:**
   - Run "Templater: Generate Weekly Review"
   - Read `Notifications/Weekly-Review-*.md`
   - Note patterns and suggested focus

### Monthly Workflow

1. **Archive old logs:**
   - Run "Templater: Archive Old Logs"
   - Moves Inbox-Log entries >90 days to Archive/

---

## Debugging & Troubleshooting

### Check Inbox-Log for Processing History

Every processed entry creates a log file:
```markdown
---
entry_hash: "h3a2b1c"
original_text: |
  Sarah mentioned she's looking for a new job
filed_to: "people"
confidence: 0.85
status: "filed"
---
```

**Common statuses:**
- `filed` - New note created
- `merged` - Added to existing note
- `needs_review` - Low confidence, needs clarification
- `error` - Processing failed

### Verify Entry Hashes Aren't Duplicated

```dataview
TABLE entry_hash, count(rows) as "Count"
FROM "Inbox-Log"
WHERE entry_hash
GROUP BY entry_hash
HAVING count(rows) > 1
```

If duplicates exist, deduplication failed. Check `getProcessedHashes()` logic.

### Test Frontmatter Fields Match Dataview Queries

Open a People note → View source mode → Verify:
```yaml
follow_ups: |
  - Ask about job search
```

**NOT:**
```markdown
## Follow-ups
- Ask about job search
```

### Test Groq API Key

```bash
curl https://api.groq.com/openai/v1/chat/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model":"moonshotai/kimi-k2-instruct-0905",
    "messages":[{"role":"user","content":"Test"}],
    "response_format":{"type":"json_object"}
  }'
```

Expected response:
```json
{
  "choices": [{
    "message": {
      "content": "{...}"
    }
  }]
}
```

---

## File Structure Reference

```
SecondBrain/
├── 0-Daily/
│   └── 2026-01-09.md              # Daily notes with entries
├── People/
│   ├── Sarah.md                   # Person notes
│   └── John.md
├── Projects/
│   ├── Onboarding Flow.md         # Project notes
│   └── Q1 Report.md
├── Ideas/
│   └── Dark Mode Feature.md       # Idea notes
├── Admin/
│   └── Renew Car Registration.md  # Admin tasks
├── Inbox-Log/
│   ├── Log-2026-01-09-142305.md   # Processing logs
│   ├── Log-2026-01-09-143012.md
│   └── Archive/                   # Old logs (>90 days)
│       └── Log-2025-09-15-*.md
├── Notifications/
│   ├── Processing-Summary-*.md    # Daily processing results
│   ├── Clarification-*.md         # Low-confidence entries
│   ├── Needs-Review.md            # Rolling task list
│   ├── Daily-Digest-*.md          # Morning action plans
│   ├── Weekly-Review-*.md         # Weekly insights
│   └── Reclassification-*.md      # Re-classification results
├── Templates/
│   ├── Daily-Note-Template.md
│   ├── Person-Template.md
│   ├── Project-Template.md
│   ├── Idea-Template.md
│   ├── Admin-Template.md
│   ├── Inbox-Log-Template.md
│   └── Notification-Template.md
├── Scripts/
│   ├── groq-api.js                # Groq API wrapper
│   ├── process-daily-note.js      # Main processing script
│   ├── reclassify-entry.js        # Re-classification handler
│   ├── archive-old-logs.js        # Archive old Inbox-Log entries
│   ├── generate-daily-digest.js   # Daily digest generator
│   └── generate-weekly-review.js  # Weekly review generator
└── Dashboard.md                   # Dataview queries dashboard
```

---

## Key Differences from Original Guide

| Issue | Original (Slack/Notion/Zapier) | This Implementation (Obsidian) |
|-------|-------------------------------|--------------------------------|
| **Duplicate processing** | Reprocesses all entries every run | Hash-based deduplication via Inbox-Log |
| **File collisions** | Overwrites existing Notion pages | Merge strategy with history append |
| **last_processed tracking** | Parameter accepted but ignored | Offset-based incremental parsing |
| **Clarification workflow** | Manual quote-in-next-note (Slack) | Rolling task list with re-classify command |
| **Frontmatter/Dataview gap** | Key fields in body only | All queryable fields in YAML frontmatter |
| **API provider** | OpenAI/Anthropic (~$5-15/mo) | Groq with Kimi-k2 (~$0.22/month) |
| **Scheduling** | Cron trigger (always-on computer) | Manual command palette (no dependencies) |
| **Archive automation** | No automation | Manual "Archive Old Logs" command |
| **Category override** | Not supported | `@category: text` syntax |
| **Error handling** | Basic try/catch in Zapier | Retry with exponential backoff, validation, logging |
| **Data retention** | Stored in Notion permanently | Groq ZDR enabled (no retention) |

---

## Performance Characteristics

**Processing Speed:**
- 10 entries: ~5-10 seconds
- 50 entries: ~30-60 seconds
- Bottleneck: Groq API calls (sequential)

**Token Usage (Typical Day):**
- 10 entries × 350 tokens each = 3,500 tokens
- Daily digest: ~1,000 tokens
- Weekly review: ~3,000 tokens
- **Monthly total:** ~125,000 tokens = ~$0.19

**Free Tier Limits:**
- 6K TPM (tokens per minute) - plenty for personal use
- 100K TPD (tokens per day) - won't hit with typical usage
- Should stay free indefinitely

---

## Cost Breakdown

**Groq Pricing:** $1.50/M tokens blended ($1.00/M input, $3.00/M output)

**Typical Personal Use:**
- Processing: 10 entries/day × 30 days × 350 tokens = 105K tokens = **$0.16/month**
- Daily digest: 30 digests × 1K tokens = 30K tokens = **$0.045/month**
- Weekly review: 4 reviews × 3K tokens = 12K tokens = **$0.018/month**
- **Total: ~$0.22/month**

**Compare to Original:**
- OpenAI GPT-4o-mini: ~$0.15/M → ~$0.02/month (cheaper but less capable)
- OpenAI GPT-4o: ~$5/M → ~$0.60/month
- Anthropic Claude 3.5 Haiku: ~$1/M → ~$0.12/month
- Anthropic Claude 3.5 Sonnet: ~$3/M → ~$0.36/month

**Groq Advantages:**
- Fast inference (200+ tokens/sec)
- Large context (256K tokens for Kimi-k2)
- Zero Data Retention option
- Free tier sufficient for personal use

---

## Testing & Verification

### Test Case 1: Idempotency
1. Create daily note with 3 entries
2. Run "Process Daily Note"
3. **Run command again**
4. Expected: Notification says "All entries already processed"
5. Verify: No duplicate files in People/Projects/Ideas/Admin

### Test Case 2: File Collision Merge
1. Create entry: "Sarah mentioned she's looking for a new job"
2. Process → Creates `People/Sarah.md`
3. Create second entry: "Sarah sent me her resume, follow up next week"
4. Process
5. Expected: Merges into existing `People/Sarah.md`
6. Verify:
   - `follow_ups` field updated in frontmatter
   - History section shows "Merged from [[date]]"
   - `last_touched` updated to today

### Test Case 3: Category Override
1. Create entry: `@projects: Build onboarding flow for new users`
2. Process
3. Expected:
   - Classified as "projects" (not AI-determined)
   - `confidence: 1.0` in frontmatter
   - Processing faster (skipped AI call)

### Test Case 4: Clarification Workflow
1. Create vague entry: "John"
2. Process → Routes to needs_review
3. Verify: Task added to Needs-Review.md
4. Edit: "Category: people"
5. Check box: `[x]`
6. Run "Re-classify Pending Entries"
7. Expected: `People/John.md` created, task removed

---

## Common Modification Patterns

### Adding a New Category

**Required Changes:**
1. Create new folder (e.g., `Events/`)
2. Create template (e.g., `Templates/Event-Template.md`)
3. Update classification prompt in `process-daily-note.js`:
   ```javascript
   // Add to CATEGORIES section
   - "events" - a calendar event, meeting, appointment
   ```
4. Add schema to JSON examples:
   ```javascript
   For EVENTS:
   {
     "destination": "events",
     "confidence": 0.85,
     "data": {
       "name": "Event Name",
       "date": "2026-01-15",
       "location": "...",
       "notes": "..."
     }
   }
   ```
5. Update folder mapping:
   ```javascript
   function getFolderForCategory(dest) {
       const mapping = {
           // ... existing
           events: "Events"
       };
       return mapping[dest];
   }
   ```
6. Update template mapping:
   ```javascript
   function getTemplateForCategory(dest) {
       const mapping = {
           // ... existing
           events: "Event-Template"
       };
       return mapping[dest];
   }
   ```
7. Add to `detectCategoryOverride()` regex:
   ```javascript
   const overrideMatch = text.match(/^@(people|projects|ideas|admin|events):\s*(.+)/si);
   ```

### Changing Confidence Threshold

Current: 0.6 (entries below this go to needs_review)

To change:
```javascript
// In createOrUpdateRecord()
if (dest === "needs_review" || classification.confidence < 0.7) {  // Changed from 0.6
    return await createNeedsReviewRecord(...);
}
```

**Also update prompt:**
```javascript
// In buildClassificationPrompt()
- If confidence < 0.7, destination MUST be "needs_review"
```

### Customizing Merge Behavior

**Current:** Appends to multi-line fields with bullet points.

**To replace instead of append:**
```javascript
function mergeMultilineField(existing, incoming) {
    // Original (append):
    // return `${existing}\n- ${incoming}`;

    // Replace:
    return incoming;
}
```

**To keep only most recent:**
```javascript
function mergeMultilineField(existing, incoming) {
    if (!incoming) return existing;
    return incoming; // Always use new value
}
```

---

## Architecture Principles

1. **Idempotency First:** Every operation can be safely re-run without side effects
2. **Merge Over Create:** Related information stays together in one note
3. **Manual Control:** User triggers processing, not automated schedules
4. **Dataview Native:** Frontmatter fields power all queries and dashboards
5. **Privacy Conscious:** Groq ZDR enabled, no data retention beyond session
6. **Cost Efficient:** ~$0.22/month, compatible with free tier
7. **Error Resilient:** Retry logic, validation, detailed error logging
8. **Offline Compatible:** Works without constant connectivity (manual sync)

---

## Support & Resources

**Groq Documentation:**
- API Reference: https://console.groq.com/docs/api-reference
- Kimi-k2 Model: https://console.groq.com/docs/model/moonshotai/kimi-k2-instruct-0905
- Rate Limits: https://console.groq.com/docs/rate-limits
- Data Controls (ZDR): https://console.groq.com/settings/data-controls

**Obsidian Plugins:**
- Templater: https://github.com/SilentVoid13/Templater
- Dataview: https://github.com/blacksmithgu/obsidian-dataview

**Original Inspiration:**
- Slack/Notion/Zapier guide: [Second Brain Build Guide.md](Second Brain Build Guide.md)

---

## Version History

- **v2.0 (2026-01-09):** Corrected implementation with idempotency, merge strategy, Groq integration
- **v1.0 (original):** Slack/Notion/Zapier architecture (reference only)

---

**This CLAUDE.md provides comprehensive context for working with the Obsidian Second Brain system. All critical implementation patterns, debugging procedures, and architectural decisions are documented here.**
