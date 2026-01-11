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
    // Instead of using Dataview, directly search through log files
    const logFolder = app.vault.getAbstractFileByPath(INBOX_LOG_FOLDER);
    if (!logFolder || !logFolder.children) return null;

    for (const file of logFolder.children) {
        if (file.extension !== 'md') continue;

        try {
            const content = await app.vault.read(file);
            const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
            if (!fmMatch) continue;

            const frontmatter = fmMatch[1];
            const hashMatch = frontmatter.match(/entry_hash:\s*["']?([^"\n]+)["']?/);

            if (hashMatch && hashMatch[1] === hash) {
                // Parse the frontmatter to get the data
                const lines = frontmatter.split('\n');
                const data = {};
                let currentKey = null;
                let multilineValue = [];

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];

                    // Check if this is a new key:value pair (has colon and doesn't start with whitespace)
                    const colonIdx = line.indexOf(':');
                    const isNewField = colonIdx > -1 && !line.match(/^\s/) && line.slice(0, colonIdx).trim();

                    if (isNewField) {
                        // Save previous multiline field if exists
                        if (currentKey && multilineValue.length > 0) {
                            data[currentKey] = multilineValue.join('\n');
                            multilineValue = [];
                        }

                        const key = line.slice(0, colonIdx).trim();
                        let value = line.slice(colonIdx + 1).trim();

                        if (value === '|') {
                            // Start of multiline field
                            currentKey = key;
                            multilineValue = [];
                        } else {
                            // Single-line field
                            value = value.replace(/^["']|["']$/g, '');
                            data[key] = value;
                            currentKey = null;
                        }
                    } else if (currentKey) {
                        // Continuation of multiline field (including blank lines)
                        multilineValue.push(line.replace(/^\s{2}/, '')); // Remove 2-space indent
                    }
                }

                // Save last multiline field
                if (currentKey && multilineValue.length > 0) {
                    data[currentKey] = multilineValue.join('\n');
                }

                return data;
            }
        } catch (e) {
            console.error(`Error reading log file ${file.path}:`, e);
            continue;
        }
    }

    return null;
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
    const dest = classification.destination;
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

        return { destination: dest, name: fileName, status: "filed" };
    } else {
        // Merge into existing file
        await mergeIntoExisting(existingFile, classification, originalText, sourceNote);

        await createInboxLog(tp, originalText, entryHash, dest, fileName, filePath, classification.confidence, "merged", sourceNote);

        return { destination: dest, name: fileName, status: "merged" };
    }
}

// Helper functions needed by createOrUpdateRecordManual

const PEOPLE_FOLDER = "People";
const PROJECTS_FOLDER = "Projects";
const IDEAS_FOLDER = "Ideas";
const ADMIN_FOLDER = "Admin";

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
