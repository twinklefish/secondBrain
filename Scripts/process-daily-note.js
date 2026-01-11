// ============================================
// GROQ API HELPER (INLINED)
// ============================================

async function loadAPIKey() {
    try {
        const envFile = app.vault.getAbstractFileByPath("Scripts/groq-api-key.txt");
        if (envFile) {
            const content = await app.vault.read(envFile);
            const match = content.match(/GROQ_API_KEY=(.+)/);
            if (match) return match[1].trim();
        }
    } catch (e) {
        console.error("Failed to load API key from .env:", e);
    }
    return "YOUR_GROQ_API_KEY_HERE";
}

let API_KEY;
async function ensureAPIKey() {
    if (!API_KEY) {
        API_KEY = await loadAPIKey();
    }
    return API_KEY;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGroqAPI(prompt, options = {}) {
    const config = {
        baseURL: "https://api.groq.com/openai/v1",
        model: "moonshotai/kimi-k2-instruct-0905",
        maxTokens: 1024,
        temperature: 0,
        maxRetries: 3,
        retryDelay: 1000,
        ...options
    };

    const key = await ensureAPIKey();
    let lastError;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
            const response = await fetch(`${config.baseURL}/chat/completions`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${key}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: config.model,
                    messages: [{
                        role: "user",
                        content: prompt
                    }],
                    max_tokens: config.maxTokens,
                    temperature: config.temperature,
                    response_format: { type: "json_object" }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                const error = new Error(errorData.error?.message || `HTTP ${response.status}`);
                error.status = response.status;
                throw error;
            }

            const data = await response.json();
            const content = data.choices[0].message.content;
            const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            return cleaned;

        } catch (error) {
            lastError = error;

            if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
                throw error;
            }

            if (attempt < config.maxRetries) {
                const delay = config.retryDelay * Math.pow(2, attempt);
                await sleep(delay);
            }
        }
    }

    throw lastError || new Error("Groq API call failed after retries");
}

function validateClassification(jsonString) {
    try {
        const obj = JSON.parse(jsonString);

        if (!obj.destination) {
            console.error("Validation failed - API response:", jsonString);
            throw new Error("Missing 'destination' field");
        }
        if (typeof obj.confidence !== 'number') {
            console.error("Validation failed - API response:", jsonString);
            throw new Error("Missing or invalid 'confidence' field");
        }
        if (!obj.data) {
            console.error("Validation failed - API response:", jsonString);
            throw new Error("Missing 'data' field");
        }

        const validDestinations = ["people", "projects", "ideas", "admin", "needs_review"];
        if (!validDestinations.includes(obj.destination)) {
            console.error("Validation failed - API response:", jsonString);
            throw new Error(`Invalid destination: ${obj.destination}`);
        }

        return obj;
    } catch (e) {
        if (e instanceof SyntaxError) {
            console.error("JSON parse failed - raw response:", jsonString);
            throw new Error(`Classification validation failed: Invalid JSON - ${e.message}`);
        }
        throw new Error(`Classification validation failed: ${e.message}`);
    }
}

// ============================================
// PATHS
// ============================================

// Paths
const PEOPLE_FOLDER = "People";
const PROJECTS_FOLDER = "Projects";
const IDEAS_FOLDER = "Ideas";
const ADMIN_FOLDER = "Admin";
const INBOX_LOG_FOLDER = "Inbox-Log";
const NOTIFICATIONS_FOLDER = "Notifications";

// ============================================
// MAIN ENTRY POINT
// ============================================

async function processDailyNote(tp) {
    const activeFile = tp.file.find_tfile(tp.file.title);
    if (!activeFile) {
        new Notice("No active daily note found");
        return;
    }

    console.log("Process Daily Note - Active file path:", activeFile.path);
    console.log("Checking if starts with 'Inbox/':", activeFile.path.startsWith("Inbox/"));

    // Check if this is an Inbox file - if so, run Process Inbox first
    if (activeFile.path.startsWith("Inbox/")) {
        console.log("Inbox file detected - running Process Inbox first");
        new Notice("Running Process Inbox first...");
        try {
            const processInbox = tp.user["process-inbox"];
            if (processInbox) {
                await processInbox(tp);
                // The file should now be in 0-Daily, so re-find it
                const dailyFileName = activeFile.basename;
                const dailyFile = app.vault.getAbstractFileByPath(`0-Daily/${dailyFileName}.md`);
                if (!dailyFile) {
                    new Notice("❌ Failed to find processed daily note");
                    return;
                }
                // Continue processing the new daily note
                // Re-read the file content
                const dailyContent = await app.vault.read(dailyFile);
                return await processDailyNoteContent(tp, dailyFile, dailyContent);
            } else {
                new Notice("❌ Process Inbox function not found. Please check Templater settings.");
                return;
            }
        } catch (error) {
            console.error("Error running Process Inbox:", error);
            new Notice(`❌ Process Inbox failed: ${error.message}`);
            return;
        }
    }

    const content = await app.vault.read(activeFile);
    return await processDailyNoteContent(tp, activeFile, content);
}

async function processDailyNoteContent(tp, activeFile, content) {
    const frontmatter = tp.frontmatter || {};
    const lastOffset = frontmatter.last_processed_offset || 0;

    // Extract entries
    const entries = extractEntries(content, lastOffset);
    if (entries.length === 0) {
        await createNotification(tp, "No new entries to process", "daily-processing", "");
        new Notice("No new entries to process");
        return;
    }

    new Notice(`Found ${entries.length} potential entries...`);

    // Get processed hashes for deduplication
    const processedHashes = await getProcessedHashes();

    // Filter out duplicates
    const newEntries = entries.filter(e => !processedHashes.has(e.hash));
    if (newEntries.length === 0) {
        await createNotification(tp, "All entries already processed", "daily-processing", "");
        new Notice("All entries already processed");
        return;
    }

    new Notice(`Processing ${newEntries.length} new entries...`);

    // Process each entry
    const results = [];
    for (const entry of newEntries) {
        try {
            // Check for category override
            const override = detectCategoryOverride(entry.text);

            let classification;
            if (override) {
                classification = await classifyWithOverride(override);
            } else {
                classification = await classifyEntry(entry.text);
            }

            const result = await createOrUpdateRecord(
                tp,
                classification,
                entry.text,
                entry.hash,
                activeFile.basename
            );
            results.push(result);
        } catch (e) {
            console.error("Error processing entry:", e);
            await logError(tp, entry.text, entry.hash, e);
        }
    }

    // Update offset to end of file
    await updateProcessingMetadata(tp, activeFile, content.length);

    // Create summary notification
    await createSummaryNotification(tp, results);

    new Notice(`Processed ${results.length} entries. Check Notifications/ folder.`);
}

// ============================================
// ENTRY EXTRACTION & HASHING
// ============================================

function hashEntry(text) {
    // FNV-1a hash algorithm
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return `h${(hash >>> 0).toString(36)}`;
}

function extractEntries(content, lastProcessedOffset) {
    // Find frontmatter end
    const fmEnd = content.indexOf('---', 3);
    const bodyStart = fmEnd !== -1 ? content.indexOf('\n', fmEnd + 3) + 1 : 0;

    // Only process content after last offset
    const sliceStart = Math.max(bodyStart, lastProcessedOffset);
    const body = content.substring(sliceStart);

    // Extract only Journal and Scratch Pad sections (skip Tasks)
    const processableSections = extractProcessableSections(body);

    // Split by delimiter (more robust regex)
    const DELIMITER = /\n---\s*\n/;
    return processableSections.split(DELIMITER)
        .map(t => t.trim())
        .filter(t => t.length > 10)
        .filter(t => !t.startsWith('<!--'))
        .filter(t => !t.includes('New entries below this line'))
        .filter(t => !t.includes('Quick Capture'))
        .filter(t => !t.match(/^##?\s+/)) // Filter out headings
        .map((text, idx) => ({
            text,
            hash: hashEntry(text),
            originalIndex: idx
        }));
}

function extractProcessableSections(content) {
    // Extract content from ## Journal and ## Scratch Pad sections only
    // Skip ## Tasks section
    const sections = [];
    const lines = content.split('\n');
    let currentSection = null;
    let sectionContent = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check if this is a section header
        if (line.match(/^##\s+/)) {
            // Save previous section if it was processable
            if (currentSection === 'journal' || currentSection === 'scratch_pad') {
                sections.push(sectionContent.join('\n'));
            }

            // Start new section
            sectionContent = [];
            if (line.match(/^##\s+Journal/i)) {
                currentSection = 'journal';
            } else if (line.match(/^##\s+Scratch\s*Pad/i)) {
                currentSection = 'scratch_pad';
            } else {
                currentSection = 'skip';
            }
        } else if (currentSection !== 'skip') {
            sectionContent.push(line);
        }
    }

    // Save last section if processable
    if (currentSection === 'journal' || currentSection === 'scratch_pad') {
        sections.push(sectionContent.join('\n'));
    }

    return sections.join('\n');
}

async function getProcessedHashes() {
    const dv = app.plugins.plugins.dataview.api;
    if (!dv) {
        console.warn("Dataview not loaded, skipping deduplication");
        return new Set();
    }

    try {
        const logs = dv.pages('"Inbox-Log"')
            .where(p => p.entry_hash)
            .map(p => p.entry_hash);
        return new Set(logs.array());
    } catch (e) {
        console.warn("Failed to load processed hashes:", e);
        return new Set();
    }
}

// ============================================
// CATEGORY OVERRIDE DETECTION
// ============================================

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

async function classifyWithOverride(override) {
    // Still call AI to extract structured data, but force the category
    const prompt = buildForcedClassificationPrompt(override.text, override.category);
    const response = await callGroqAPI(prompt);
    const classification = validateClassification(response);

    // Force the destination
    classification.destination = override.category;
    classification.confidence = 1.0;

    return classification;
}

// ============================================
// AI CLASSIFICATION
// ============================================

async function classifyEntry(text) {
    try {
        const prompt = buildClassificationPrompt(text);
        const response = await callGroqAPI(prompt);
        return validateClassification(response);
    } catch (error) {
        console.error("Classification failed, routing to needs_review:", error);
        // If classification fails, route to needs_review with the error details
        return {
            destination: "needs_review",
            confidence: 0.0,
            data: {
                original_text: text.substring(0, 200),
                possible_categories: ["unknown"],
                reason: `API or validation error: ${error.message}`
            }
        };
    }
}

function buildClassificationPrompt(text) {
    return `You are a classification system for a personal knowledge management system. Return ONLY valid JSON.

INPUT:
${text}

CATEGORIES:
- "people" - information about a person, relationship update, something someone said
- "projects" - a project, task with multiple steps, ongoing work
- "ideas" - a thought, insight, concept, something to explore later
- "admin" - a simple errand, one-off task, something with a due date
- "needs_review" - if confidence < 0.6 or unclear

JSON SCHEMA (return exactly this structure):

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
    "due_date": "2026-01-15",
    "notes": "Additional context",
    "tags": []
  }
}

For UNCLEAR (confidence < 0.6):
{
  "destination": "needs_review",
  "confidence": 0.45,
  "data": {
    "original_text": "${text.substring(0, 100)}",
    "possible_categories": ["projects", "admin"],
    "reason": "Could be a project or a simple task"
  }
}

RULES:
- If confidence < 0.6, destination MUST be "needs_review"
- "next_action" must be specific and executable
- Status options for projects: "active", "waiting", "blocked", "someday"
- Extract dates when mentioned and format as YYYY-MM-DD (or null if not mentioned)
- If no clear tags apply, use empty array []
- Always return valid JSON with no markdown formatting`;
}

function buildForcedClassificationPrompt(text, forcedCategory) {
    const schemas = {
        people: '{"name": "...", "context": "...", "follow_ups": "...", "tags": ["..."]}',
        projects: '{"name": "...", "status": "active", "next_action": "...", "notes": "...", "tags": ["..."]}',
        ideas: '{"name": "...", "one_liner": "...", "notes": "...", "tags": ["..."]}',
        admin: '{"name": "...", "due_date": "YYYY-MM-DD or null", "notes": "...", "tags": []}'
    };

    return `Extract structured data from this text for a ${forcedCategory} record.

TEXT: ${text}

CATEGORY: ${forcedCategory}

Return ONLY JSON matching this structure:
{
  "destination": "${forcedCategory}",
  "confidence": 0.95,
  "data": ${schemas[forcedCategory]}
}

RULES:
- Extract specific details from the text
- Do not invent information
- For dates, use YYYY-MM-DD format or null
- Keep tags relevant and concise`;
}

// ============================================
// RECORD CREATION & MERGING
// ============================================

async function createOrUpdateRecord(tp, classification, originalText, entryHash, sourceNote) {
    const dest = classification.destination;

    if (dest === "needs_review" || classification.confidence < 0.6) {
        return await createNeedsReviewRecord(tp, classification, originalText, entryHash, sourceNote);
    }

    const folder = getFolderForCategory(dest);
    const fileName = sanitizeFileName(classification.data.name);
    const filePath = `${folder}/${fileName}.md`;

    const existingFile = app.vault.getAbstractFileByPath(filePath);

    if (!existingFile) {
        // Create new file
        const template = await loadTemplate(getTemplateForCategory(dest));
        const content = replacePlaceholders(template, classification.data, sourceNote, classification.confidence, entryHash);
        await app.vault.create(filePath, content);

        await createInboxLog(tp, originalText, entryHash, dest, fileName, filePath, classification.confidence, "filed", sourceNote);

        return { destination: dest, name: fileName, status: "filed", confidence: classification.confidence };
    } else {
        // Merge into existing file
        await mergeIntoExisting(existingFile, classification, originalText, sourceNote);

        await createInboxLog(tp, originalText, entryHash, dest, fileName, filePath, classification.confidence, "merged", sourceNote);

        return { destination: dest, name: fileName, status: "merged", confidence: classification.confidence };
    }
}

async function mergeIntoExisting(file, classification, originalText, sourceNote) {
    const current = await app.vault.read(file);

    // Parse frontmatter
    const fmMatch = current.match(/^---\n([\s\S]*?)\n---/);
    const fmObj = yamlToObject(fmMatch ? fmMatch[1] : "");

    // Update key fields
    const updates = {
        last_touched: moment().format("YYYY-MM-DD"),
        confidence: Math.max(fmObj.confidence || 0, classification.confidence)
    };

    // Category-specific updates
    if (classification.destination === "people") {
        if (classification.data.follow_ups) {
            updates.follow_ups = mergeMultilineField(fmObj.follow_ups, classification.data.follow_ups);
        }
        if (classification.data.context) {
            updates.context = mergeMultilineField(fmObj.context, classification.data.context);
        }
    } else if (classification.destination === "projects") {
        if (classification.data.status) updates.status = classification.data.status;
        if (classification.data.next_action) updates.next_action = classification.data.next_action;
        if (classification.data.notes) {
            updates.notes = mergeMultilineField(fmObj.notes, classification.data.notes);
        }
    } else if (classification.destination === "admin") {
        if (classification.data.due_date) updates.due_date = classification.data.due_date;
        if (classification.data.status) updates.status = classification.data.status;
    }

    Object.assign(fmObj, updates);

    // Rebuild frontmatter
    const newFrontmatter = objectToYaml(fmObj);

    // Append history entry
    const bodyWithoutFm = current.replace(/^---\n[\s\S]*?\n---\n/, "");
    const historyEntry = `\n---\n**${moment().format("YYYY-MM-DD HH:mm")}** - Merged from [[${sourceNote}]]:\n> ${originalText}\n`;

    const merged = `---\n${newFrontmatter}---\n${bodyWithoutFm}${historyEntry}`;

    await app.vault.modify(file, merged);
}

function mergeMultilineField(existing, incoming) {
    if (!existing) return incoming;
    if (!incoming) return existing;
    // Avoid duplicates
    if (existing.includes(incoming)) return existing;
    return `${existing}\n- ${incoming}`;
}

// ============================================
// CLARIFICATION WORKFLOW
// ============================================

async function createNeedsReviewRecord(tp, classification, originalText, entryHash, sourceNote) {
    const timestamp = tp.date.now("YYYY-MM-DD-HHmmss");
    const notifPath = `${NOTIFICATIONS_FOLDER}/Clarification-${timestamp}.md`;

    const content = `---
type: notification
created: ${tp.date.now("YYYY-MM-DD HH:mm:ss")}
notification_type: clarification_needed
source_note: "[[${sourceNote}]]"
entry_hash: ${entryHash}
original_text: |
  ${originalText}
confidence: ${classification.confidence}
possible_categories: [${(classification.data.possible_categories || []).join(", ")}]
reason: "${classification.data.reason || "Unclear classification"}"
---

# 🤔 Clarification Needed

**Original Text:**
> ${originalText}

**Confidence:** ${classification.confidence}
**Possible Categories:** ${(classification.data.possible_categories || []).join(", ")}
**Reason:** ${classification.data.reason || "Unclear classification"}

---

## How to Fix

1. Open [[${NOTIFICATIONS_FOLDER}/Needs-Review]]
2. Find this entry in the task list (hash: \`${entryHash}\`)
3. Edit the "Category:" line to one of: people, projects, ideas, admin
4. Check the box when ready
5. Run "Re-classify Pending Entries" command

*Generated on ${tp.date.now("YYYY-MM-DD HH:mm:ss")}*`;

    await app.vault.create(notifPath, content);

    // Append to rolling task list
    await appendNeedsReviewTask(originalText, entryHash, sourceNote, classification, timestamp);

    // Log
    await createInboxLog(tp, originalText, entryHash, "needs_review", "Pending", notifPath, classification.confidence, "needs_review", sourceNote);

    return {
        destination: "needs_review",
        name: "Clarification requested",
        status: "needs_review",
        confidence: classification.confidence
    };
}

async function appendNeedsReviewTask(originalText, entryHash, sourceNote, classification, timestamp) {
    const taskListPath = `${NOTIFICATIONS_FOLDER}/Needs-Review.md`;
    const file = app.vault.getAbstractFileByPath(taskListPath);

    const taskLine = `- [ ] **${timestamp}** | Hash: \`${entryHash}\` | [[${sourceNote}]]\n  - Category: [people/projects/ideas/admin]\n  - Original: ${originalText.substring(0, 100)}${originalText.length > 100 ? "..." : ""}\n  - Reason: ${classification.data.reason || "Unclear"}\n`;

    if (!file) {
        const initial = `# Needs Review\n\nEntries awaiting manual classification. Edit the "Category:" line and check the box, then run **Re-classify Pending Entries**.\n\n${taskLine}`;
        await app.vault.create(taskListPath, initial);
    } else {
        const current = await app.vault.read(file);
        await app.vault.modify(file, current + "\n" + taskLine);
    }
}

// ============================================
// INBOX LOG & NOTIFICATIONS
// ============================================

async function createInboxLog(tp, originalText, entryHash, filedTo, destName, destLink, confidence, status, sourceNote) {
    const timestamp = tp.date.now("YYYY-MM-DD-HHmmss");
    const logPath = `${INBOX_LOG_FOLDER}/Log-${timestamp}.md`;

    const templateContent = await loadTemplate("Inbox-Log-Template");
    let content = templateContent;

    content = content.replace(/{{ENTRY_HASH}}/g, entryHash);
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

    let summary = "# ✅ Processing Complete\n\n";
    summary += `**Processed:** ${results.length} entries\n\n`;

    const byDestination = {};
    results.forEach(r => {
        if (!byDestination[r.destination]) byDestination[r.destination] = [];
        byDestination[r.destination].push(r);
    });

    for (const [dest, items] of Object.entries(byDestination)) {
        summary += `\n## ${dest.charAt(0).toUpperCase() + dest.slice(1)} (${items.length})\n`;
        items.forEach(item => {
            const statusEmoji = item.status === "merged" ? "🔄" : "📝";
            summary += `- ${statusEmoji} **${item.name}** (confidence: ${item.confidence}, status: ${item.status})\n`;
        });
    }

    const needsReview = results.filter(r => r.status === "needs_review");
    if (needsReview.length > 0) {
        summary += `\n⚠️ **${needsReview.length} items need clarification** - see [[${NOTIFICATIONS_FOLDER}/Needs-Review]]\n`;
    }

    summary += `\n---\n*Generated on ${tp.date.now("YYYY-MM-DD")} at ${tp.date.now("HH:mm:ss")}*`;

    await app.vault.create(notifPath, summary);
}

async function createNotification(tp, message, type, content) {
    const timestamp = tp.date.now("YYYY-MM-DD-HHmmss");
    const notifPath = `${NOTIFICATIONS_FOLDER}/${type}-${timestamp}.md`;

    const fullContent = `---
type: notification
created: ${tp.date.now("YYYY-MM-DD HH:mm:ss")}
notification_type: "${type}"
---

# ${message}

${content}

---
*Generated on ${tp.date.now("YYYY-MM-DD HH:mm:ss")}*`;

    await app.vault.create(notifPath, fullContent);
}

async function logError(tp, originalText, entryHash, error) {
    const timestamp = tp.date.now("YYYY-MM-DD-HHmmss");
    const errorPath = `${INBOX_LOG_FOLDER}/Error-${timestamp}.md`;

    const content = `---
type: inbox-log
created: ${tp.date.now("YYYY-MM-DD HH:mm:ss")}
entry_hash: "${entryHash}"
status: "error"
error_message: "${error.message}"
---

# Error Processing Entry

**Original Text:**
> ${originalText}

**Error:**
\`\`\`
${error.stack || error.message}
\`\`\`

---
*Failed on ${tp.date.now("YYYY-MM-DD HH:mm:ss")}*`;

    await app.vault.create(errorPath, content);
}

// ============================================
// METADATA UPDATE
// ============================================

async function updateProcessingMetadata(tp, file, offset) {
    await app.fileManager.processFrontMatter(file, (fm) => {
        fm.last_processed = tp.date.now("YYYY-MM-DD HH:mm:ss");
        fm.last_processed_offset = offset;
    });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getFolderForCategory(dest) {
    const mapping = {
        people: PEOPLE_FOLDER,
        projects: PROJECTS_FOLDER,
        ideas: IDEAS_FOLDER,
        admin: ADMIN_FOLDER
    };
    return mapping[dest] || NOTIFICATIONS_FOLDER;
}

function getTemplateForCategory(dest) {
    const mapping = {
        people: "Person-Template",
        projects: "Project-Template",
        ideas: "Idea-Template",
        admin: "Admin-Template"
    };
    return mapping[dest] || "Notification-Template";
}

function sanitizeFileName(name) {
    return (name || "Untitled").replace(/[\\/:*?"<>|]/g, '-').substring(0, 100);
}

async function loadTemplate(templateName) {
    const templateFile = app.vault.getAbstractFileByPath(`Templates/${templateName}.md`);
    if (!templateFile) throw new Error(`Template not found: ${templateName}`);
    return await app.vault.read(templateFile);
}

function replacePlaceholders(template, data, sourceNote, confidence, entryHash) {
    let result = template;

    // Common replacements
    result = result.replace(/{{NAME}}/g, data.name || "Untitled");
    result = result.replace(/{{SOURCE}}/g, sourceNote);
    result = result.replace(/{{CONFIDENCE}}/g, confidence);
    result = result.replace(/{{ENTRY_HASH}}/g, entryHash || "");
    result = result.replace(/{{TAGS}}/g, (data.tags || []).join(", "));

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

function yamlToObject(str) {
    const obj = {};
    str.split('\n').forEach(line => {
        const idx = line.indexOf(':');
        if (idx === -1) return;
        const k = line.slice(0, idx).trim();
        let v = line.slice(idx + 1).trim();

        if (!k) return;

        // Handle multi-line fields (indicated by |)
        if (v === '|') {
            obj[k] = ""; // Will be filled by subsequent lines
            return;
        }

        // Parse value
        if (v === "null") v = null;
        else if (v === "true") v = true;
        else if (v === "false") v = false;
        else if (!isNaN(Number(v)) && v !== "") v = Number(v);
        else if (v.startsWith('[') && v.endsWith(']')) {
            v = v.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
        }

        obj[k] = v;
    });
    return obj;
}

function objectToYaml(obj) {
    return Object.entries(obj)
        .map(([k, v]) => {
            if (Array.isArray(v)) return `${k}: [${v.join(', ')}]`;
            if (v === null) return `${k}: null`;
            if (typeof v === 'string' && v.includes('\n')) {
                return `${k}: |\n  ${v.split('\n').join('\n  ')}`;
            }
            return `${k}: ${v}`;
        })
        .join('\n');
}

// Export main function AND helper for re-classifier

// Templater wrapper export
module.exports = async (tp) => await processDailyNote(tp);
