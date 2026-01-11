// ============================================
// BATCH PROCESS LEGACY JOURNALS
// ============================================
// Processes all legacy journal files from Legacy-Import/ folder
// 1. Adds --- delimiters (AI)
// 2. Moves to Inbox/
// 3. Processes to 0-Daily/
// 4. Classifies entries to categories
// Shows progress, handles errors gracefully

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
        console.error("Failed to load API key:", e);
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
        maxTokens: 8192,
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
// BATCH PROCESSING
// ============================================

const LEGACY_IMPORT_FOLDER = "Legacy-Import";
const INBOX_FOLDER = "Inbox";
const DAILY_FOLDER = "0-Daily";

async function processLegacyBatch(tp) {
    new Notice("🚀 Starting batch legacy journal processing...");

    // Check if Legacy-Import folder exists
    const legacyFolder = app.vault.getAbstractFileByPath(LEGACY_IMPORT_FOLDER);
    if (!legacyFolder) {
        new Notice("❌ Legacy-Import/ folder not found. Please create it and add your legacy journals.");
        return;
    }

    // Get all markdown files in Legacy-Import
    const files = app.vault.getMarkdownFiles()
        .filter(f => f.path.startsWith(`${LEGACY_IMPORT_FOLDER}/`));

    if (files.length === 0) {
        new Notice("❌ No markdown files found in Legacy-Import/");
        return;
    }

    console.log(`Found ${files.length} legacy journal files to process`);
    new Notice(`Found ${files.length} files to process. Starting...`);

    const stats = {
        total: files.length,
        processed: 0,
        failed: 0,
        skipped: 0,
        errors: []
    };

    // Process each file
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const progress = `[${i + 1}/${files.length}]`;

        console.log(`${progress} Processing ${file.basename}`);
        new Notice(`${progress} Processing ${file.basename}...`);

        try {
            // Step 1: Add delimiters if needed
            const delimiterResult = await addDelimitersToFile(file);

            if (delimiterResult.skipped) {
                console.log(`  ⏭️ Skipped (${delimiterResult.reason})`);
                stats.skipped++;
                continue;
            }

            // Step 2: Move to Inbox
            await moveToInbox(file);

            // Step 3: Process through Inbox → Daily Note
            const inboxFile = app.vault.getAbstractFileByPath(`${INBOX_FOLDER}/${file.name}`);
            if (inboxFile) {
                await processInboxToDailyNote(tp, inboxFile);

                // Step 4: Process Daily Note → Classify entries
                const dailyFile = app.vault.getAbstractFileByPath(`${DAILY_FOLDER}/${file.basename}.md`);
                if (dailyFile) {
                    await processDailyNoteEntries(tp, dailyFile);
                }
            }

            stats.processed++;
            console.log(`  ✅ Successfully processed ${file.basename}`);

        } catch (error) {
            console.error(`  ❌ Failed to process ${file.basename}:`, error);
            stats.failed++;
            stats.errors.push({
                file: file.basename,
                error: error.message
            });
        }

        // Rate limiting: small delay between files
        if (i < files.length - 1) {
            await sleep(500);
        }
    }

    // Create summary report
    await createBatchSummary(tp, stats);

    new Notice(`✅ Batch processing complete! Processed: ${stats.processed}, Failed: ${stats.failed}, Skipped: ${stats.skipped}`);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function addDelimitersToFile(file) {
    const content = await app.vault.read(file);

    // Skip if already processed (check if it exists in Inbox-Archive)
    const archiveFile = app.vault.getAbstractFileByPath(`Inbox-Archive/${file.name}`);
    if (archiveFile) {
        return { skipped: true, reason: "already processed (in archive)" };
    }

    // Check if already in 0-Daily (already processed)
    const dailyFile = app.vault.getAbstractFileByPath(`0-Daily/${file.basename}.md`);
    if (dailyFile) {
        return { skipped: true, reason: "already processed (in 0-Daily)" };
    }

    // Call AI to add delimiters
    const prompt = buildDelimiterPrompt(content, file.basename);
    const responseText = await callGroqAPI(prompt);
    const response = JSON.parse(responseText);

    if (!response.processed_content) {
        throw new Error("AI response missing processed_content field");
    }

    // Update file with delimited content
    await app.vault.modify(file, response.processed_content);

    return { skipped: false, sections: response.sections_identified };
}

function buildDelimiterPrompt(content, filename) {
    return `You are a journal entry processor. Your task is to analyze this legacy journal entry and insert "---" delimiters between MAJOR distinct topics only.

ORIGINAL CONTENT:
${content}

FILENAME: ${filename}

YOUR TASK:
1. Identify MAJOR topic shifts that would be different chapters in a book (NOT different paragraphs)
2. Insert a single line containing only "---" between these major sections ONLY
3. PRESERVE all original formatting (headings, lists, tables, links, bold, italic, etc.)
4. DO NOT modify, rephrase, or summarize the text - return it exactly as written
5. DO NOT add --- before the first section or after the last section
6. BE CONSERVATIVE - when in doubt, DO NOT add a delimiter

PHILOSOPHY: Think "chapters of a book" not "paragraphs of a chapter"
- Related thoughts about the same topic/meeting/person = SAME SECTION (no delimiter)
- Completely unrelated topics/events/conversations = DIFFERENT SECTIONS (add delimiter)

CRITICAL FORMATTING:
- ALWAYS add a blank line before and after the --- delimiter
- Format: "text\\n\\n---\\n\\ntext" (NOT "text\\n---\\ntext")
- This prevents markdown bold formatting issues

Return JSON in this format:
{
  "processed_content": "The full content with --- delimiters inserted (with proper spacing)",
  "sections_identified": 3,
  "reasoning": "Brief explanation of what major topic shifts you identified"
}

CRITICAL RULES:
- Return the COMPLETE content - do not truncate or summarize
- PRESERVE exact formatting, spacing, and markdown syntax
- ONLY add --- delimiters with blank lines before and after
- BE CONSERVATIVE - err on the side of fewer delimiters
- Think: "Would these be in the same chapter of a book?" If yes, NO delimiter
- Maximum ~2-4 delimiters for a typical daily journal (not 10+)`;
}

async function moveToInbox(file) {
    // Ensure Inbox folder exists
    const inboxFolder = app.vault.getAbstractFileByPath(INBOX_FOLDER);
    if (!inboxFolder) {
        await app.vault.createFolder(INBOX_FOLDER);
    }

    // Move file to Inbox
    const newPath = `${INBOX_FOLDER}/${file.name}`;
    await app.fileManager.renameFile(file, newPath);
}

async function processInboxToDailyNote(tp, inboxFile) {
    // Access the process-inbox function via Templater's user script API
    const processInbox = tp.user["process-inbox"];

    if (!processInbox) {
        throw new Error("process-inbox script not found in Templater user scripts");
    }

    // Create a temporary tp object with the inbox file as active
    const tempTp = {
        ...tp,
        file: {
            ...tp.file,
            find_tfile: (title) => inboxFile,
            title: inboxFile.basename
        }
    };

    await processInbox(tempTp);
}

async function processDailyNoteEntries(tp, dailyFile) {
    // Access the process-daily-note function via Templater's user script API
    const processDailyNote = tp.user["process-daily-note"];

    if (!processDailyNote) {
        throw new Error("process-daily-note script not found in Templater user scripts");
    }

    // Create a temporary tp object with the daily file as active
    const tempTp = {
        ...tp,
        file: {
            ...tp.file,
            find_tfile: (title) => dailyFile,
            title: dailyFile.basename
        }
    };

    await processDailyNote(tempTp);
}

async function createBatchSummary(tp, stats) {
    const timestamp = tp.date.now("YYYY-MM-DD-HHmmss");
    const summaryPath = `Notifications/Batch-Processing-${timestamp}.md`;

    let errorList = "";
    if (stats.errors.length > 0) {
        errorList = "\n## Errors\n\n";
        stats.errors.forEach(e => {
            errorList += `- **${e.file}**: ${e.error}\n`;
        });
    }

    const content = `---
type: notification
created: ${tp.date.now("YYYY-MM-DD HH:mm:ss")}
notification_type: "batch_processing"
---

# Batch Legacy Journal Processing Complete

**Completed:** ${tp.date.now("YYYY-MM-DD HH:mm:ss")}

## Summary

- **Total Files:** ${stats.total}
- **Successfully Processed:** ${stats.processed}
- **Failed:** ${stats.failed}
- **Skipped:** ${stats.skipped}

${errorList}

## What Happened

1. ✅ Added --- delimiters to ${stats.processed} legacy journals
2. ✅ Structured entries into Daily Note format
3. ✅ Classified entries to People/Projects/Ideas/Admin
4. ✅ Created inbox logs for audit trail

## Next Steps

1. Run "Generate Historical Weekly Reviews" to create weekly reviews for all processed data
2. Run "Archive Old Logs" to clean up old inbox logs
3. Review any failed files listed above and process manually if needed

---

*Batch processing took approximately ${Math.round(stats.total * 3 / 60)} minutes*
`;

    await app.vault.create(summaryPath, content);
}

// Templater wrapper export
module.exports = async (tp) => await processLegacyBatch(tp);
