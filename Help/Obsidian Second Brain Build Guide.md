# **Obsidian Second Brain Build Guide**

**A Complete Implementation with Obsidian, Templater, Dataview, and Claude/ChatGPT**

Adapted from the original Slack/Notion/Zapier architecture for a pure Obsidian workflow.

---

## **Overview**

This system processes your daily journaling into a structured knowledge base automatically. Total build time is 2-3 hours.

### **The Core Loop**

1. You write in your daily note throughout the day (thoughts, tasks, people notes)
2. At 10 PM, Templater script extracts entries separated by `---`
3. AI classifies each entry and returns structured JSON
4. Script creates notes in the correct folder (People/, Projects/, Ideas/, Admin/)
5. AI creates notification in Notifications/ folder confirming what it did
6. Daily/weekly digests surface what matters

### **The Four Automations**

* **Daily Processing:** Cron trigger (10 PM) → Parse daily note → AI classification → Create notes → Generate notifications
* **Clarification Handler:** Detects quoted clarifications in daily notes → Updates existing records
* **Daily Digest:** Cron trigger (7 AM) → Query vault → AI summarization → Create notification
* **Weekly Review:** Cron trigger (Sunday 4 PM) → Query vault → AI analysis → Create notification

---

## **Prerequisites**

### **Required Tools**

* Obsidian (free)
* Obsidian plugins (all free):
  * Templater (for scripting)
  * Dataview (for querying)
  * Cron (for scheduling)
  * Periodic Notes or Daily Notes (for daily note creation)
* Kimi-k2 on Groq
* Always-on computer (optional but recommended for reliable scheduling)

### **Estimated Costs**

| Service | Cost |
| ----- | ----- |
| Obsidian | Free |
| Obsidian Sync (Activated) | $4/month |
| Groq API | ~$1/month (moonshotai/kimi-k2-instruct-0905 is best) |

---

## **Part 1: Vault Setup**

### **Step 1.1: Create the Folder Structure**

Create these folders in your vault:

```
SecondBrain/
├── 0-Daily/           # Your daily notes
├── People/            # Database equivalent for people
├── Projects/          # Database equivalent for projects
├── Ideas/             # Database equivalent for ideas
├── Admin/             # Database equivalent for admin tasks
├── Inbox-Log/         # Audit trail of all classifications
├── Notifications/     # AI responses and digests
├── Templates/         # Templater templates
└── Scripts/           # Templater scripts
```

### **Step 1.2: Configure Daily Notes**

In Obsidian settings:
1. Enable Daily Notes or Periodic Notes plugin
2. Set note location: `0-Daily`
3. Set date format: `YYYY-MM-DD` (e.g., `2026-01-09`)
4. Create daily note template (see Step 1.3)

### **Step 1.3: Create Daily Note Template**

Create `Templates/Daily-Note-Template.md`:

```markdown
---
date: <% tp.file.title %>
last_processed: null
---

# <% tp.date.now("dddd, MMMM DD, YYYY") %>

## Journal

## Tasks

## Scratch Pad

---

<!-- New entries below this line -->
```

**Key elements:**
- `last_processed` frontmatter tracks when AI last processed this note
- `---` delimiter separates thoughts for classification
- Structure is just a suggestion - write however you want

---

## **Part 2: Note Templates**

### **Step 2.1: People Note Template**

Create `Templates/Person-Template.md`:

```markdown
---
type: person
name: "{{NAME}}"
created: <% tp.date.now("YYYY-MM-DD") %>
last_touched: <% tp.date.now("YYYY-MM-DD") %>
tags: [{{TAGS}}]
source_note: "[[{{SOURCE}}]]"
confidence: {{CONFIDENCE}}
---

# {{NAME}}

## Context
{{CONTEXT}}

## Follow-ups
{{FOLLOWUPS}}

## Notes
-

---
*Created by AI classification on <% tp.date.now("YYYY-MM-DD") %>*
```

### **Step 2.2: Projects Note Template**

Create `Templates/Project-Template.md`:

```markdown
---
type: project
name: "{{NAME}}"
status: {{STATUS}}
created: <% tp.date.now("YYYY-MM-DD") %>
last_touched: <% tp.date.now("YYYY-MM-DD") %>
tags: [{{TAGS}}]
source_note: "[[{{SOURCE}}]]"
confidence: {{CONFIDENCE}}
---

# {{NAME}}

## Status
{{STATUS}}

## Next Action
{{NEXT_ACTION}}

## Notes
{{NOTES}}

## History
- <% tp.date.now("YYYY-MM-DD") %>: Created

---
*Created by AI classification on <% tp.date.now("YYYY-MM-DD") %>*
```

### **Step 2.3: Ideas Note Template**

Create `Templates/Idea-Template.md`:

```markdown
---
type: idea
name: "{{NAME}}"
created: <% tp.date.now("YYYY-MM-DD") %>
last_touched: <% tp.date.now("YYYY-MM-DD") %>
tags: [{{TAGS}}]
source_note: "[[{{SOURCE}}]]"
confidence: {{CONFIDENCE}}
---

# {{NAME}}

## One-Liner
{{ONE_LINER}}

## Notes
{{NOTES}}

## Related
-

---
*Created by AI classification on <% tp.date.now("YYYY-MM-DD") %>*
```

### **Step 2.4: Admin Note Template**

Create `Templates/Admin-Template.md`:

```markdown
---
type: admin
name: "{{NAME}}"
status: todo
due_date: {{DUE_DATE}}
created: <% tp.date.now("YYYY-MM-DD") %>
tags: [{{TAGS}}]
source_note: "[[{{SOURCE}}]]"
confidence: {{CONFIDENCE}}
---

# {{NAME}}

## Due Date
{{DUE_DATE}}

## Status
- [ ] {{NAME}}

## Notes
{{NOTES}}

---
*Created by AI classification on <% tp.date.now("YYYY-MM-DD") %>*
```

### **Step 2.5: Inbox Log Template**

Create `Templates/Inbox-Log-Template.md`:

```markdown
---
type: inbox-log
created: <% tp.date.now("YYYY-MM-DD HH:mm:ss") %>
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

---
*Processed on <% tp.date.now("YYYY-MM-DD") %> at <% tp.date.now("HH:mm:ss") %>*
```

### **Step 2.6: Notification Template**

Create `Templates/Notification-Template.md`:

```markdown
---
type: notification
created: <% tp.date.now("YYYY-MM-DD HH:mm:ss") %>
notification_type: "{{TYPE}}"
---

# {{TITLE}}

{{CONTENT}}

---
*Generated on <% tp.date.now("YYYY-MM-DD") %> at <% tp.date.now("HH:mm:ss") %>*
```

---

## **Part 3: The Classification Script**

### **Step 3.1: Create the Main Processing Script**

Create `Scripts/process-daily-note.js`:

```javascript
// Configuration
const API_PROVIDER = "anthropic"; // or "openai"
const API_KEY = "YOUR_API_KEY_HERE"; // Store securely - see security note below
const MODEL = "claude-3-5-haiku-20241022"; // or "gpt-4o-mini"

// Paths
const PEOPLE_FOLDER = "People";
const PROJECTS_FOLDER = "Projects";
const IDEAS_FOLDER = "Ideas";
const ADMIN_FOLDER = "Admin";
const INBOX_LOG_FOLDER = "Inbox-Log";
const NOTIFICATIONS_FOLDER = "Notifications";

async function processDailyNote(tp) {
    const activeFile = tp.file.find_tfile(tp.file.title);
    const content = await app.vault.read(activeFile);
    const frontmatter = tp.frontmatter;

    // Parse entries separated by ---
    const entries = extractEntries(content, frontmatter.last_processed);

    if (entries.length === 0) {
        await createNotification(tp, "No new entries to process", "daily-processing");
        return;
    }

    // Process each entry
    const results = [];
    for (const entry of entries) {
        const classification = await classifyEntry(entry.text);
        const result = await createRecord(tp, classification, entry.text, tp.file.title);
        results.push(result);
    }

    // Update frontmatter timestamp
    await updateLastProcessed(tp, activeFile);

    // Create summary notification
    await createSummaryNotification(tp, results);
}

function extractEntries(content, lastProcessed) {
    // Remove frontmatter
    const bodyStart = content.indexOf('---', 1);
    if (bodyStart === -1) return [];

    const body = content.substring(content.indexOf('\n', bodyStart + 3));

    // Split by --- delimiter
    const rawEntries = body.split(/\n---\n/);

    // Filter out empty entries and template sections
    const entries = rawEntries
        .map(text => text.trim())
        .filter(text => text.length > 10)
        .filter(text => !text.startsWith('<!--'))
        .filter(text => !text.includes('New entries below this line'))
        .map((text, index) => ({
            text: text,
            index: index
        }));

    return entries;
}

async function classifyEntry(text) {
    const prompt = buildClassificationPrompt(text);

    let response;
    if (API_PROVIDER === "anthropic") {
        response = await callClaudeAPI(prompt);
    } else {
        response = await callOpenAIAPI(prompt);
    }

    // Parse JSON from response (handle markdown wrapping)
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
}

function buildClassificationPrompt(text) {
    return `You are a classification system for a personal knowledge management system. Your job is to analyze the user's captured thought and return structured JSON.

INPUT:
${text}

INSTRUCTIONS:
1. Determine which category this belongs to:
   - "people" - information about a person, relationship update, something someone said
   - "projects" - a project, task with multiple steps, ongoing work
   - "ideas" - a thought, insight, concept, something to explore later
   - "admin" - a simple errand, one-off task, something with a due date

2. Extract the relevant fields based on category

3. Assign a confidence score (0.0 to 1.0):
   - 0.9-1.0: Very clear category, obvious classification
   - 0.7-0.89: Fairly confident, good match
   - 0.5-0.69: Uncertain, could be multiple categories
   - Below 0.5: Very unclear, needs human review

4. If confidence is below 0.6, set destination to "needs_review"

OUTPUT FORMAT (return ONLY this JSON, no other text):

For PEOPLE:
{
  "destination": "people",
  "confidence": 0.85,
  "data": {
    "name": "Person's Name",
    "context": "How you know them or their role",
    "follow_ups": "Things to remember for next time",
    "tags": ["work", "friend"]
  }
}

For PROJECTS:
{
  "destination": "projects",
  "confidence": 0.85,
  "data": {
    "name": "Project Name",
    "status": "active",
    "next_action": "Specific next action to take",
    "notes": "Additional context",
    "tags": ["work"]
  }
}

For IDEAS:
{
  "destination": "ideas",
  "confidence": 0.85,
  "data": {
    "name": "Idea Title",
    "one_liner": "Core insight in one sentence",
    "notes": "Elaboration if provided",
    "tags": ["product"]
  }
}

For ADMIN:
{
  "destination": "admin",
  "confidence": 0.85,
  "data": {
    "name": "Task name",
    "due_date": "2024-01-15 or null if not specified",
    "notes": "Additional context"
  }
}

For UNCLEAR (confidence below 0.6):
{
  "destination": "needs_review",
  "confidence": 0.45,
  "data": {
    "original_text": "The original message",
    "possible_categories": ["projects", "admin"],
    "reason": "Could be a project or a simple task"
  }
}

RULES:
- "next_action" must be specific and executable
- If a person's name is mentioned, consider if this is really about that person or about a project/task involving them
- Status options for projects: "active", "waiting", "blocked", "someday"
- Extract dates when mentioned and format as YYYY-MM-DD
- If no clear tags apply, use an empty array []
- Always return valid JSON with no markdown formatting`;
}

async function callClaudeAPI(prompt) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "x-api-key": API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        },
        body: JSON.stringify({
            model: MODEL,
            max_tokens: 1024,
            messages: [{
                role: "user",
                content: prompt
            }]
        })
    });

    const data = await response.json();
    return data.content[0].text;
}

async function callOpenAIAPI(prompt) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: MODEL,
            messages: [{
                role: "user",
                content: prompt
            }],
            response_format: { type: "json_object" }
        })
    });

    const data = await response.json();
    return data.choices[0].message.content;
}

async function createRecord(tp, classification, originalText, sourceNote) {
    const dest = classification.destination;
    const conf = classification.confidence;

    if (dest === "needs_review" || conf < 0.6) {
        return await createNeedsReviewRecord(tp, classification, originalText, sourceNote);
    }

    let folder, template;
    switch (dest) {
        case "people":
            folder = PEOPLE_FOLDER;
            template = "Person-Template";
            break;
        case "projects":
            folder = PROJECTS_FOLDER;
            template = "Project-Template";
            break;
        case "ideas":
            folder = IDEAS_FOLDER;
            template = "Idea-Template";
            break;
        case "admin":
            folder = ADMIN_FOLDER;
            template = "Admin-Template";
            break;
    }

    // Create the note
    const fileName = sanitizeFileName(classification.data.name);
    const filePath = `${folder}/${fileName}.md`;

    // Load template and replace placeholders
    const templateContent = await loadTemplate(template);
    const content = replacePlaceholders(templateContent, classification.data, sourceNote, conf);

    await app.vault.create(filePath, content);

    // Create inbox log entry
    await createInboxLog(tp, originalText, dest, fileName, filePath, conf, "filed", sourceNote);

    return {
        destination: dest,
        name: fileName,
        confidence: conf,
        status: "filed"
    };
}

async function createNeedsReviewRecord(tp, classification, originalText, sourceNote) {
    // Create notification asking for clarification
    const timestamp = tp.date.now("YYYY-MM-DD-HHmmss");
    const notifPath = `${NOTIFICATIONS_FOLDER}/Clarification-${timestamp}.md`;

    const content = `---
type: notification
created: ${tp.date.now("YYYY-MM-DD HH:mm:ss")}
notification_type: "clarification_needed"
source_note: "[[${sourceNote}]]"
---

# 🤔 Clarification Needed

**Original Text:**
> ${originalText}

**Confidence:** ${classification.confidence}

**Possible Categories:** ${classification.data.possible_categories?.join(", ") || "Unknown"}

**Reason:** ${classification.data.reason || "Unclear classification"}

---

## How to Fix

Add one of these to tomorrow's daily note, then quote the original text:

\`\`\`
> ${originalText.substring(0, 50)}...

This should be filed as: [people/projects/ideas/admin]
\`\`\`

---
*Generated on ${tp.date.now("YYYY-MM-DD")} at ${tp.date.now("HH:mm:ss")}*`;

    await app.vault.create(notifPath, content);

    // Create inbox log entry
    await createInboxLog(tp, originalText, "needs_review", "Pending", notifPath, classification.confidence, "needs_review", sourceNote);

    return {
        destination: "needs_review",
        name: "Clarification requested",
        confidence: classification.confidence,
        status: "needs_review"
    };
}

function replacePlaceholders(template, data, sourceNote, confidence) {
    let result = template;

    // Common replacements
    result = result.replace(/{{NAME}}/g, data.name || "Untitled");
    result = result.replace(/{{SOURCE}}/g, sourceNote);
    result = result.replace(/{{CONFIDENCE}}/g, confidence);
    result = result.replace(/{{TAGS}}/g, data.tags?.join(", ") || "");

    // People-specific
    result = result.replace(/{{CONTEXT}}/g, data.context || "");
    result = result.replace(/{{FOLLOWUPS}}/g, data.follow_ups || "");

    // Projects-specific
    result = result.replace(/{{STATUS}}/g, data.status || "active");
    result = result.replace(/{{NEXT_ACTION}}/g, data.next_action || "");
    result = result.replace(/{{NOTES}}/g, data.notes || "");

    // Ideas-specific
    result = result.replace(/{{ONE_LINER}}/g, data.one_liner || "");

    // Admin-specific
    result = result.replace(/{{DUE_DATE}}/g, data.due_date || "null");

    return result;
}

async function createInboxLog(tp, originalText, filedTo, destName, destLink, confidence, status, sourceNote) {
    const timestamp = tp.date.now("YYYY-MM-DD-HHmmss");
    const logPath = `${INBOX_LOG_FOLDER}/Log-${timestamp}.md`;

    const templateContent = await loadTemplate("Inbox-Log-Template");
    let content = templateContent;

    content = content.replace(/{{ORIGINAL_TEXT}}/g, originalText);
    content = content.replace(/{{FILED_TO}}/g, filedTo);
    content = content.replace(/{{DEST_NAME}}/g, destName);
    content = content.replace(/{{DEST_LINK}}/g, destLink);
    content = content.replace(/{{CONFIDENCE}}/g, confidence);
    content = content.replace(/{{STATUS}}/g, status);
    content = content.replace(/{{SOURCE}}/g, sourceNote);

    await app.vault.create(logPath, content);
}

async function createSummaryNotification(tp, results) {
    const timestamp = tp.date.now("YYYY-MM-DD-HHmmss");
    const notifPath = `${NOTIFICATIONS_FOLDER}/Processing-Summary-${timestamp}.md`;

    let summary = "# ✅ Daily Processing Complete\n\n";
    summary += `**Processed:** ${results.length} entries\n\n`;

    const byDestination = {};
    results.forEach(r => {
        if (!byDestination[r.destination]) {
            byDestination[r.destination] = [];
        }
        byDestination[r.destination].push(r);
    });

    for (const [dest, items] of Object.entries(byDestination)) {
        summary += `\n## ${dest.charAt(0).toUpperCase() + dest.slice(1)} (${items.length})\n`;
        items.forEach(item => {
            summary += `- **${item.name}** (confidence: ${item.confidence})\n`;
        });
    }

    const needsReview = results.filter(r => r.status === "needs_review");
    if (needsReview.length > 0) {
        summary += `\n⚠️ **${needsReview.length} items need clarification** - see Notifications/ folder\n`;
    }

    summary += `\n---\n*Generated on ${tp.date.now("YYYY-MM-DD")} at ${tp.date.now("HH:mm:ss")}*`;

    await app.vault.create(notifPath, summary);
}

async function updateLastProcessed(tp, file) {
    await app.fileManager.processFrontMatter(file, (fm) => {
        fm.last_processed = tp.date.now("YYYY-MM-DD HH:mm:ss");
    });
}

function sanitizeFileName(name) {
    return name.replace(/[\\/:*?"<>|]/g, '-').substring(0, 100);
}

async function loadTemplate(templateName) {
    const templateFile = app.vault.getAbstractFileByPath(`Templates/${templateName}.md`);
    return await app.vault.read(templateFile);
}

// Execute
module.exports = processDailyNote;
```

**SECURITY NOTE:** Never commit your API key to git. Better approach:
1. Store API key in a separate file outside your vault (e.g., `~/.obsidian-api-key`)
2. Read it in the script: `const API_KEY = await tp.file.include("[[path-to-key-file]]");`
3. Or use environment variables if running on always-on computer

### **Step 3.2: Create the Templater Command**

Create `Templates/Process-Daily-Note.md`:

```javascript
<%*
const processor = await tp.user.process-daily-note(tp);
%>
```

---

## **Part 4: Daily Digest Script**

### **Step 4.1: Create the Digest Generator**

Create `Scripts/generate-daily-digest.js`:

```javascript
// Configuration
const API_PROVIDER = "anthropic";
const API_KEY = "YOUR_API_KEY_HERE";
const MODEL = "claude-3-5-haiku-20241022";

async function generateDailyDigest(tp) {
    // Query active projects using Dataview
    const projects = await queryActiveProjects();

    // Query people with follow-ups
    const people = await queryPeopleWithFollowups();

    // Query today's admin tasks
    const adminTasks = await queryTodaysTasks();

    // Build context for AI
    const context = buildDigestContext(projects, people, adminTasks);

    // Generate digest with AI
    const digest = await generateDigest(context, tp.date.now("YYYY-MM-DD"));

    // Create notification
    await createDigestNotification(tp, digest);
}

async function queryActiveProjects() {
    const dv = app.plugins.plugins.dataview.api;
    const pages = dv.pages('"Projects"')
        .where(p => p.status === "active")
        .limit(20);

    return pages.array().map(p => ({
        name: p.file.name,
        status: p.status,
        next_action: p.next_action || "None specified"
    }));
}

async function queryPeopleWithFollowups() {
    const dv = app.plugins.plugins.dataview.api;
    const pages = dv.pages('"People"')
        .where(p => p.follow_ups && p.follow_ups !== "")
        .limit(10);

    return pages.array().map(p => ({
        name: p.file.name,
        follow_ups: p.follow_ups
    }));
}

async function queryTodaysTasks() {
    const dv = app.plugins.plugins.dataview.api;
    const today = moment().format("YYYY-MM-DD");
    const pages = dv.pages('"Admin"')
        .where(p => p.status === "todo")
        .where(p => p.due_date && p.due_date <= today)
        .limit(10);

    return pages.array().map(p => ({
        name: p.file.name,
        due_date: p.due_date
    }));
}

function buildDigestContext(projects, people, admin) {
    let context = "ACTIVE PROJECTS:\n";
    projects.forEach((p, i) => {
        context += `${i+1}. ${p.name}\n`;
        context += `   Status: ${p.status}\n`;
        context += `   Next Action: ${p.next_action}\n\n`;
    });

    context += "\nPEOPLE TO FOLLOW UP WITH:\n";
    people.forEach((p, i) => {
        context += `${i+1}. ${p.name}\n`;
        context += `   Follow-up: ${p.follow_ups}\n\n`;
    });

    context += "\nTASKS DUE:\n";
    admin.forEach((a, i) => {
        context += `${i+1}. ${a.name}\n`;
        context += `   Due: ${a.due_date}\n\n`;
    });

    return context;
}

async function generateDigest(context, currentDate) {
    const prompt = `You are a personal productivity assistant. Generate a concise daily digest based on the following data.

${context}

TODAY'S DATE: ${currentDate}

INSTRUCTIONS:
Create a digest with EXACTLY this format. Keep it under 150 words total.

---

☀️ **Good morning!**

**🎯 Top 3 Actions Today:**
1. [Most important/urgent action from projects or admin]
2. [Second priority]
3. [Third priority]

**👥 People to Connect With:**
- [Person name]: [Brief follow-up reminder]

**⚠️ Watch Out For:**
[One thing that might be stuck, overdue, or getting neglected]

**💪 One Small Win to Notice:**
[Something positive or progress made, or encouraging thought]

---

RULES:
- Be specific and actionable, not motivational
- Prioritize overdue items and concrete next actions
- If there's nothing in a section, omit it entirely
- Keep language direct and practical
- Don't add explanations or commentary outside the format`;

    if (API_PROVIDER === "anthropic") {
        return await callClaudeAPI(prompt);
    } else {
        return await callOpenAIAPI(prompt);
    }
}

async function callClaudeAPI(prompt) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "x-api-key": API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        },
        body: JSON.stringify({
            model: MODEL,
            max_tokens: 1024,
            messages: [{
                role: "user",
                content: prompt
            }]
        })
    });

    const data = await response.json();
    return data.content[0].text;
}

async function callOpenAIAPI(prompt) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: MODEL,
            messages: [{
                role: "user",
                content: prompt
            }]
        })
    });

    const data = await response.json();
    return data.choices[0].message.content;
}

async function createDigestNotification(tp, digest) {
    const timestamp = tp.date.now("YYYY-MM-DD-HHmm");
    const notifPath = `Notifications/Daily-Digest-${timestamp}.md`;

    const content = `---
type: notification
created: ${tp.date.now("YYYY-MM-DD HH:mm:ss")}
notification_type: "daily_digest"
---

${digest}`;

    await app.vault.create(notifPath, content);
}

module.exports = generateDailyDigest;
```

---

## **Part 5: Weekly Review Script**

Create `Scripts/generate-weekly-review.js`:

```javascript
// Configuration
const API_PROVIDER = "anthropic";
const API_KEY = "YOUR_API_KEY_HERE";
const MODEL = "claude-3-5-sonnet-20241022"; // Use more powerful model for weekly review

async function generateWeeklyReview(tp) {
    // Query this week's inbox log
    const inboxLog = await queryWeeklyInboxLog();

    // Query all active/waiting/blocked projects
    const projects = await queryAllActiveProjects();

    // Build context
    const context = buildWeeklyContext(inboxLog, projects);

    // Generate review
    const review = await generateReview(context, inboxLog.length);

    // Create notification
    await createReviewNotification(tp, review);
}

async function queryWeeklyInboxLog() {
    const dv = app.plugins.plugins.dataview.api;
    const sevenDaysAgo = moment().subtract(7, 'days').format("YYYY-MM-DD");

    const pages = dv.pages('"Inbox-Log"')
        .where(p => p.created >= sevenDaysAgo)
        .limit(50);

    return pages.array().map(p => ({
        original_text: p.original_text,
        filed_to: p.filed_to,
        destination_name: p.destination_name,
        status: p.status
    }));
}

async function queryAllActiveProjects() {
    const dv = app.plugins.plugins.dataview.api;
    const pages = dv.pages('"Projects"')
        .where(p => ["active", "waiting", "blocked"].includes(p.status))
        .limit(30);

    return pages.array().map(p => ({
        name: p.file.name,
        status: p.status,
        next_action: p.next_action || "None specified"
    }));
}

function buildWeeklyContext(inboxLog, projects) {
    let context = "=== ITEMS CAPTURED THIS WEEK ===\n\n";

    inboxLog.forEach((item, i) => {
        const text = item.original_text?.substring(0, 50) || "No text";
        context += `${i+1}. [${item.filed_to}] ${item.destination_name || text}\n`;
        if (item.status === "needs_review") {
            context += `   ⚠️ NEEDS REVIEW\n`;
        }
        context += `\n`;
    });

    context += "\n=== ACTIVE PROJECTS STATUS ===\n\n";

    projects.forEach((p, i) => {
        context += `${i+1}. ${p.name}\n`;
        context += `   Status: ${p.status}\n`;
        context += `   Next: ${p.next_action}\n\n`;
    });

    // Count by category
    const categoryCounts = {};
    inboxLog.forEach(item => {
        const cat = item.filed_to || "Unknown";
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    context += "\n=== CAPTURE SUMMARY ===\n";
    for (const [cat, count] of Object.entries(categoryCounts)) {
        context += `${cat}: ${count}\n`;
    }

    return context;
}

async function generateReview(context, totalCaptures) {
    const prompt = `You are a personal productivity assistant conducting a weekly review. Analyze the following data and generate an insightful summary.

${context}

TOTAL CAPTURES THIS WEEK: ${totalCaptures}

INSTRUCTIONS:
Create a weekly review with EXACTLY this format. Keep it under 250 words total.

---

📅 **Week in Review**

**📊 Quick Stats:**
- Items captured: [number]
- Breakdown: [x people, y projects, z ideas, w admin]

**🎯 What Moved Forward:**
- [Project or area that made progress]
- [Another win or completion]

**🔴 Open Loops (needs attention):**
1. [Something blocked, stalled, or waiting too long]
2. [Another concern]

**💡 Patterns I Notice:**
[One observation about themes, recurring topics, or where energy is going]

**📌 Suggested Focus for Next Week:**
1. [Specific action for highest priority item]
2. [Second priority]
3. [Third priority]

**🔧 Items Needing Review:**
[List any items still marked "Needs Review" or flag if none]

---

RULES:
- Be analytical, not motivational
- Call out projects that haven't had action in over a week
- Note if capture volume was unusually high or low
- Suggest concrete next actions, not vague intentions
- If something looks stuck, say so directly
- Keep language concise and actionable`;

    if (API_PROVIDER === "anthropic") {
        return await callClaudeAPI(prompt);
    } else {
        return await callOpenAIAPI(prompt);
    }
}

async function callClaudeAPI(prompt) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "x-api-key": API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        },
        body: JSON.stringify({
            model: MODEL,
            max_tokens: 2048,
            messages: [{
                role: "user",
                content: prompt
            }]
        })
    });

    const data = await response.json();
    return data.content[0].text;
}

async function callOpenAIAPI(prompt) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: MODEL,
            messages: [{
                role: "user",
                content: prompt
            }]
        })
    });

    const data = await response.json();
    return data.choices[0].message.content;
}

async function createReviewNotification(tp, review) {
    const timestamp = tp.date.now("YYYY-MM-DD");
    const notifPath = `Notifications/Weekly-Review-${timestamp}.md`;

    const content = `---
type: notification
created: ${tp.date.now("YYYY-MM-DD HH:mm:ss")}
notification_type: "weekly_review"
---

${review}`;

    await app.vault.create(notifPath, content);
}

module.exports = generateWeeklyReview;
```

---

## **Part 6: Setting Up Cron Automation**

### **Step 6.1: Install and Configure Cron Plugin**

1. Install "Cron" plugin from Community Plugins
2. Enable the plugin
3. Open Cron settings

### **Step 6.2: Create Cron Jobs**

Add these cron jobs in the plugin settings:

**Daily Processing (10 PM):**
```
Name: Process Daily Note
Cron Expression: 0 22 * * *
Command: Templater: Process Daily Note
```

**Daily Digest (7 AM):**
```
Name: Daily Digest
Cron Expression: 0 7 * * *
Command: Templater: Generate Daily Digest
```

**Weekly Review (Sunday 4 PM):**
```
Name: Weekly Review
Cron Expression: 0 16 * * 0
Command: Templater: Generate Weekly Review
```

### **Step 6.3: Make Scripts Available as Commands**

In Templater settings:
1. Go to "User Scripts"
2. Set script folder: `Scripts/`
3. The scripts will now be available as Templater commands

---

## **Part 7: Dataview Dashboards**

### **Step 7.1: Create a Dashboard Note**

Create `Dashboard.md` in your vault root:

````markdown
# Second Brain Dashboard

## 📊 Quick Stats

```dataview
TABLE length(rows) as Count
FROM "Inbox-Log"
WHERE created >= date(today) - dur(7 days)
GROUP BY filed_to
```

## 🎯 Active Projects

```dataview
TABLE status, next_action as "Next Action", last_touched as "Last Updated"
FROM "Projects"
WHERE status = "active"
SORT last_touched DESC
```

## 👥 People with Follow-ups

```dataview
TABLE follow_ups as "Follow-up", last_touched as "Last Contact"
FROM "People"
WHERE follow_ups != null AND follow_ups != ""
SORT last_touched ASC
```

## ⚠️ Tasks Due Soon

```dataview
TABLE due_date as "Due", status
FROM "Admin"
WHERE status = "todo" AND due_date >= date(today)
SORT due_date ASC
```

## 🔧 Items Needing Review

```dataview
TABLE original_text as "Original Text", confidence, created
FROM "Inbox-Log"
WHERE status = "needs_review"
SORT created DESC
```

## 💡 Recent Ideas

```dataview
TABLE one_liner as "One-Liner", created
FROM "Ideas"
SORT created DESC
LIMIT 10
```
````

---

## **Part 8: Testing and Deployment**

### **Step 8.1: Test the Daily Processing**

1. Create a test daily note with entries separated by `---`:

```markdown
---
date: 2026-01-09
last_processed: null
---

# Thursday, January 09, 2026

Met Sarah today and she mentioned she's looking for a new job in product management.

---

Need to finish the Q1 report by Friday. Next step is to compile the sales data.

---

Idea: what if we added a dark mode to the app? Could improve user retention.

---

Remember to renew car registration by Jan 15th.

---
```

2. Run the processing command manually first (before setting up cron)
3. Check that 4 notes were created in the correct folders
4. Verify Inbox-Log entries exist
5. Check Notifications/ for summary

### **Step 8.2: Test Classification Edge Cases**

Try these examples to verify the AI handles ambiguity:

```markdown
Vague entry that could be anything

---

John
```

These should trigger "needs_review" and create clarification notifications.

### **Step 8.3: Test the Digest**

1. Manually run the daily digest command
2. Check Notifications/ for the digest note
3. Verify it pulls from your test data

### **Step 8.4: Set Up Always-On Processing (Optional)**

If using an always-on computer:

**For Mac/Linux (using crontab):**
```bash
# Edit crontab
crontab -e

# Add these lines (adjust vault path)
0 22 * * * /usr/local/bin/obsidian-cli process /path/to/vault
0 7 * * * /usr/local/bin/obsidian-cli digest /path/to/vault
0 16 * * 0 /usr/local/bin/obsidian-cli review /path/to/vault
```

**For Windows (using Task Scheduler):**
1. Open Task Scheduler
2. Create tasks for each automation
3. Set triggers (daily at 10 PM, 7 AM, Sunday 4 PM)
4. Set action to run Obsidian CLI commands

---

## **Troubleshooting & Error Handling**

### **Common Issues**

| Issue | Solution |
| ----- | ----- |
| API key not working | Double-check key is valid, has credits, and correct provider (Anthropic vs OpenAI) |
| Dataview queries return nothing | Verify folder names match exactly (case-sensitive) |
| Cron jobs not running | Check Obsidian is open at trigger time. Consider always-on computer option. |
| AI returns markdown-wrapped JSON | Script handles this with `.replace(/```json\n?/g, '')` cleanup |
| Duplicate entries created | Check `last_processed` frontmatter is updating correctly |
| Scripts not showing in Templater | Verify "Scripts/" folder path in Templater settings |

### **Monitoring Your System**

**Weekly health check (2 minutes):**
1. Open Dashboard.md
2. Check "Items Needing Review" section
3. Process any clarifications
4. Verify recent entries look correct

**Monthly maintenance:**
1. Check API usage and costs
2. Archive old Inbox-Log entries (3+ months old)
3. Review and close completed projects
4. Update prompts if classification quality drifts

---

## **Quick Reference Card**

### **Daily Use**

* **Capture:** Write in daily note → Separate thoughts with `---` → System processes at 10 PM
* **Fix:** Check Notifications/ folder → Follow clarification instructions → Add to next daily note
* **Review:** Check Notifications/ at 7 AM for daily digest, Sunday for weekly review

### **What Arrives Automatically**

* **Every night (10 PM):** Processing summary in Notifications/
* **Every morning (7 AM):** Daily digest with top 3 actions
* **Every Sunday (4 PM):** Weekly review with patterns and priorities

### **Folder Structure**

| Folder | Purpose |
| ----- | ----- |
| 0-Daily/ | Your daily notes (journal + todo + scratch pad) |
| People/ | Person notes with context and follow-ups |
| Projects/ | Project notes with status and next actions |
| Ideas/ | Idea notes with one-liners and elaboration |
| Admin/ | Admin task notes with due dates |
| Inbox-Log/ | Audit trail of all classifications |
| Notifications/ | AI responses, digests, and clarifications |

---

## **Architecture Comparison**

### **Original (Slack/Notion/Zapier)**
- Capture: Slack message
- Processing: Zapier automation
- Storage: Notion databases
- Feedback: Slack replies
- Scheduling: Zapier triggers

### **Your Implementation (Obsidian)**
- Capture: Daily note entries (separated by `---`)
- Processing: Templater scripts (JavaScript)
- Storage: Obsidian folders with YAML frontmatter
- Feedback: Notifications/ folder
- Scheduling: Cron plugin + always-on computer (optional)

### **Key Differences**
- **No external dependencies:** Everything runs in Obsidian (except AI API)
- **Batch processing:** Entries processed once daily instead of real-time
- **File-based:** Uses markdown files instead of database records
- **Queryable:** Dataview provides SQL-like queries over folders
- **Portable:** Entire system is plain text files you control

---

**Build time:** 2-3 hours
**Maintenance:** 5 minutes/week
**Return:** Every thought captured, classified, and surfaced without cognitive overhead
