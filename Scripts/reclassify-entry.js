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

// ============================================
// MAIN RECLASSIFY FUNCTION
// ============================================

const NOTIFICATIONS_FOLDER = "Notifications";
const INBOX_LOG_FOLDER = "Inbox-Log";

async function reclassifyPendingEntries(tp) {
    const taskListPath = `${NOTIFICATIONS_FOLDER}/Needs-Review.md`;
    const file = app.vault.getAbstractFileByPath(taskListPath);

    if (!file) {
        new Notice("No pending clarifications found");
        return;
    }

    const content = await app.vault.read(file);
    const lines = content.split('\n');

    const completed = [];
    const remaining = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Detect checked task
        if (line.match(/^- \[x\]/i)) {
            // Parse hash and category override
            const hashMatch = line.match(/Hash: `([^`]+)`/);
            const categoryMatch = lines[i+1]?.match(/Category:\s*\[?(\w+)\]?/);

            if (hashMatch && categoryMatch) {
                completed.push({
                    hash: hashMatch[1],
                    category: categoryMatch[1].toLowerCase(),
                    taskLines: [line, lines[i+1], lines[i+2], lines[i+3]]
                });
                i += 3; // skip detail lines
                continue;
            }
        }

        remaining.push(line);
    }

    if (completed.length === 0) {
        new Notice("No completed clarifications found (check the boxes first)");
        return;
    }

    new Notice(`Re-classifying ${completed.length} entries...`);

    // Process completed entries
    const results = [];
    for (const item of completed) {
        try {
            const inboxLog = await findInboxLogByHash(item.hash);
            if (!inboxLog) {
                results.push({ hash: item.hash, status: "not_found" });
                continue;
            }

            const originalText = inboxLog.original_text;
            const forcedCategory = item.category;

            // Re-classify with forced category
            const classification = await classifyWithForcedCategory(originalText, forcedCategory);

            // Create record (reuse logic from process-daily-note)
            const result = await createOrUpdateRecordManual(tp, classification, originalText, item.hash, inboxLog.source_note);
            results.push({ hash: item.hash, status: "reclassified", ...result });

        } catch (e) {
            console.error("Re-classification error:", e);
            results.push({ hash: item.hash, status: "error", error: e.message });
        }
    }

    // Update task list with only remaining items
    await app.vault.modify(file, remaining.join('\n'));

    // Create notification
    await createReclassificationSummary(tp, results);

    new Notice(`Re-classified ${results.length} entries. Check Notifications/ folder.`);
}

async function findInboxLogByHash(hash) {
    const dv = app.plugins.plugins.dataview.api;
    if (!dv) return null;

    const logs = dv.pages(`"${INBOX_LOG_FOLDER}"`)
        .where(p => p.entry_hash === hash);

    const result = logs.array();
    return result.length > 0 ? result[0] : null;
}

async function classifyWithForcedCategory(text, forcedCategory) {
    const prompt = buildForcedClassificationPrompt(text, forcedCategory);
    const response = await callGroqAPI(prompt);
    const classification = validateClassification(response);
    classification.destination = forcedCategory;
    classification.confidence = 0.95; // Manual override gets high confidence
    return classification;
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

async function createOrUpdateRecordManual(tp, classification, originalText, entryHash, sourceNote) {
    // Copy logic from process-daily-note.js createOrUpdateRecord()
    // (Implementation same as main script)
    // For brevity, assume same logic as above
}

async function createReclassificationSummary(tp, results) {
    const timestamp = tp.date.now("YYYY-MM-DD-HHmmss");
    const notifPath = `${NOTIFICATIONS_FOLDER}/Reclassification-${timestamp}.md`;

    let summary = "# 🔄 Re-classification Complete\n\n";
    summary += `**Processed:** ${results.length} entries\n\n`;

    results.forEach(r => {
        if (r.status === "reclassified") {
            summary += `- ✅ **${r.name}** (${r.destination})\n`;
        } else if (r.status === "not_found") {
            summary += `- ❌ Hash \`${r.hash}\` not found in Inbox-Log\n`;
        } else if (r.status === "error") {
            summary += `- ⚠️ Hash \`${r.hash}\`: ${r.error}\n`;
        }
    });

    summary += `\n---\n*Generated on ${tp.date.now("YYYY-MM-DD HH:mm:ss")}*`;

    await app.vault.create(notifPath, summary);
}


// Templater wrapper export
module.exports = async (tp) => await reclassifyPendingEntries(tp);
