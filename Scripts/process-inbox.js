// ============================================
// PROCESS INBOX TO DAILY NOTE
// ============================================
// Takes raw text from Inbox/ and structures it into Daily Note format
// using AI classification, then moves it to 0-Daily/

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
        maxTokens: 2048,
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
// MAIN PROCESS FUNCTION
// ============================================

const INBOX_FOLDER = "Inbox";
const INBOX_ARCHIVE_FOLDER = "Inbox-Archive";
const DAILY_FOLDER = "0-Daily";

async function processInbox(tp) {
    const activeFile = tp.file.find_tfile(tp.file.title);
    if (!activeFile) {
        new Notice("No active file found");
        return;
    }

    // Verify file is in Inbox folder
    if (!activeFile.path.startsWith(`${INBOX_FOLDER}/`)) {
        new Notice("This file is not in the Inbox folder");
        return;
    }

    const rawContent = await app.vault.read(activeFile);
    const fileName = activeFile.basename; // e.g., "2026-01-05"

    new Notice("Structuring inbox content with AI...");

    try {
        // Use AI to structure the content
        const structured = await structureInboxContent(rawContent, fileName);

        // Create the daily note
        const dailyNotePath = `${DAILY_FOLDER}/${fileName}.md`;
        const dailyNoteContent = buildDailyNote(tp, fileName, structured);

        // Check if daily note already exists
        const existingDaily = app.vault.getAbstractFileByPath(dailyNotePath);
        if (existingDaily) {
            new Notice("Daily note already exists. Merging content...");
            await mergeDailyNote(existingDaily, structured);
        } else {
            await app.vault.create(dailyNotePath, dailyNoteContent);
        }

        // Archive the inbox file
        await archiveInboxFile(activeFile);

        new Notice(`✅ Processed ${fileName} → 0-Daily/`);

        // Open the new daily note
        const dailyFile = app.vault.getAbstractFileByPath(dailyNotePath);
        if (dailyFile) {
            await app.workspace.getLeaf().openFile(dailyFile);
        }

    } catch (error) {
        console.error("Error processing inbox:", error);
        new Notice(`❌ Error: ${error.message}`);
    }
}

async function structureInboxContent(rawText, fileName) {
    const prompt = buildStructuringPrompt(rawText, fileName);
    const response = await callGroqAPI(prompt);

    try {
        const structured = JSON.parse(response);
        return structured;
    } catch (e) {
        console.error("Failed to parse AI response:", response);
        throw new Error("AI returned invalid JSON");
    }
}

function buildStructuringPrompt(rawText, fileName) {
    return `You are a personal knowledge management assistant. Structure this raw journal entry into organized sections.

RAW CONTENT:
${rawText}

DATE: ${fileName}

Your task:
1. Separate the content into three sections: Journal, Tasks, and Scratch Pad
2. Journal = reflections, thoughts, observations, events (KEEP ALL --- delimiters intact)
3. Tasks = actionable items found in the content (often under "TODO" heading)
4. Scratch Pad = miscellaneous notes, ideas, or temporary information

Return JSON in this exact format:
{
  "journal": "Journal section content (can be multiple paragraphs)",
  "tasks": "Tasks section content (must be markdown checklist format)",
  "scratch_pad": "Scratch pad content (anything that doesn't fit above)"
}

CRITICAL RULES FOR --- DELIMITERS:
- PRESERVE all --- delimiters that appear in the raw content
- If raw content has text separated by ---, keep those separators in the journal field
- The --- delimiter is used to separate different thoughts/entries within the journal
- DO NOT remove or relocate --- delimiters from the original content
- Each --- in the output should match exactly where it appeared in the input

EXAMPLE:
If input has:
"First thought about meeting Sarah

---

Second thought about project idea

---

TODO
- wash dog"

Output should be:
{
  "journal": "First thought about meeting Sarah\\n\\n---\\n\\nSecond thought about project idea",
  "tasks": "- [ ] wash dog",
  "scratch_pad": ""
}

OTHER RULES:
- If a section has no content, use empty string ""
- Preserve the original text as much as possible, just reorganize it
- Fix obvious misspellings and line breaks mid-sentence
- Don't add new content, only reorganize what's there
- Journal should contain the main narrative/thoughts WITH their original --- separators
- Tasks MUST be formatted as markdown checkboxes: "- [ ] task description"
- Each task item should start with "- [ ]" (dash, space, open bracket, space, close bracket, space, then task text)
- Remove any "TODO" or "To Do" headings from the tasks - just list the actual tasks
- Scratch pad is for everything else
- Default to Journal if unsure

Return ONLY valid JSON, no markdown formatting.`;
}

function buildDailyNote(tp, fileName, structured) {
    const date = moment(fileName, "YYYY-MM-DD");
    const formattedDate = date.format("dddd, MMMM DD, YYYY");

    return `---
date: ${fileName}
last_processed: null
last_processed_offset: 0
---

# ${formattedDate}

## Journal

${structured.journal || ''}

---

## Tasks

${structured.tasks || ''}

---

## Scratch Pad

${structured.scratch_pad || ''}

---
`;
}

async function mergeDailyNote(existingFile, structured) {
    const current = await app.vault.read(existingFile);

    // Simple merge: append new content to each section
    let updated = current;

    // Find and append to Journal section
    if (structured.journal) {
        updated = updated.replace(
            /(## Journal\n\n)([\s\S]*?)(\n---)/,
            `$1$2\n\n${structured.journal}$3`
        );
    }

    // Find and append to Tasks section
    if (structured.tasks) {
        updated = updated.replace(
            /(## Tasks\n\n)([\s\S]*?)(\n---)/,
            `$1$2\n\n${structured.tasks}$3`
        );
    }

    // Find and append to Scratch Pad section
    if (structured.scratch_pad) {
        updated = updated.replace(
            /(## Scratch Pad\n\n)([\s\S]*?)(\n---)/,
            `$1$2\n\n${structured.scratch_pad}$3`
        );
    }

    await app.vault.modify(existingFile, updated);
}

async function archiveInboxFile(file) {
    // Ensure archive folder exists
    const archiveFolder = app.vault.getAbstractFileByPath(INBOX_ARCHIVE_FOLDER);
    if (!archiveFolder) {
        await app.vault.createFolder(INBOX_ARCHIVE_FOLDER);
    }

    // Move file to archive
    const newPath = `${INBOX_ARCHIVE_FOLDER}/${file.name}`;
    await app.fileManager.renameFile(file, newPath);
}

// Templater wrapper export
module.exports = async (tp) => await processInbox(tp);
