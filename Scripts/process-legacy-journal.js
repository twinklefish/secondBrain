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
        maxTokens: 4096,
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
// LEGACY JOURNAL PROCESSING
// ============================================

async function processLegacyJournal(tp) {
    const activeFile = tp.file.find_tfile(tp.file.title);
    if (!activeFile) {
        new Notice("❌ No active file found");
        return;
    }

    new Notice("🔄 Processing legacy journal entry...");

    try {
        // Read the current file content
        const originalContent = await app.vault.read(activeFile);

        // Check if it's a task file (skip processing)
        if (activeFile.basename.toLowerCase().includes('task')) {
            new Notice("⏭️ Skipping task file - no processing needed");
            return;
        }

        // Check if already has delimiters (already processed)
        if (originalContent.includes('\n---\n')) {
            new Notice("⏭️ File already has delimiters - skipping");
            return;
        }

        // Build prompt for AI to insert delimiters
        const prompt = buildDelimiterPrompt(originalContent, activeFile.basename);

        // Call Groq API
        const responseText = await callGroqAPI(prompt, { maxTokens: 8192 });
        const response = JSON.parse(responseText);

        if (!response.processed_content) {
            throw new Error("AI response missing processed_content field");
        }

        // Validate that markdown structure is preserved
        const processedContent = response.processed_content;

        // Update the file with delimited content
        await app.vault.modify(activeFile, processedContent);

        new Notice(`✅ Processed: ${response.sections_identified} sections identified`);

        // Create processing log
        await createProcessingLog(tp, activeFile.basename, response);

    } catch (error) {
        console.error("Legacy journal processing error:", error);
        new Notice(`❌ Processing failed: ${error.message}`);
    }
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

WHAT COUNTS AS A MAJOR SECTION BREAK (add ---):
- Shift from work topic to completely unrelated personal topic
- Shift from one meeting/event to a completely different meeting/event
- Shift from one person/relationship to a completely different person
- Shift from one project to a completely unrelated project
- Significant time shift (morning → evening with different activities)

WHAT DOES NOT COUNT AS SECTION BREAK (NO ---):
- Multiple paragraphs about the same meeting, conversation, or topic
- Follow-up thoughts or elaborations on the same subject
- Different aspects of the same project/person/event
- List of related observations or ideas on similar themes
- Continuation of narrative from one paragraph to the next
- Sequential sentences or short observations on related topics
- Items within a bulleted or numbered list
- Rows in a table

CRITICAL FORMATTING:
- ALWAYS add a blank line before and after the --- delimiter
- Format: "text\\n\\n---\\n\\ntext" (NOT "text\\n---\\ntext")
- This prevents markdown bold formatting issues

EXAMPLES:

Input (single-sentence ideas on DIFFERENT topics):
"Coffee with James was insightful.

Pricing model needs revision.

Maybe explore partnerships instead of building in-house.

Podcast about decision-making was excellent.

Office lease renewal coming up."

Output (group if thematically related, separate if truly distinct):
"Coffee with James was insightful.

Pricing model needs revision.

Maybe explore partnerships instead of building in-house.

\\n---\\n

Podcast about decision-making was excellent.

\\n---\\n

Office lease renewal coming up."

Input (multi-paragraph about SAME topic):
"Product strategy meeting went well. Team discussed roadmap for 2025.

We mapped out three major themes based on customer research. Interesting tensions between what customers say versus usage data.

Team consensus is to prioritize enterprise features over consumer features for next two quarters."

Output (NO delimiters - all same topic):
"Product strategy meeting went well. Team discussed roadmap for 2025.

We mapped out three major themes based on customer research. Interesting tensions between what customers say versus usage data.

Team consensus is to prioritize enterprise features over consumer features for next two quarters."

Input (distinct topics):
"Had Q2 planning meeting with team. Everyone aligned on priorities, though concern about resource allocation.

---

Called Mom in evening - she's doing well after surgery. Planning to visit next month.

---

Random thought while walking dog: what if we approached vendor negotiation as partnership rather than transactional?"

Return JSON in this format:
{
  "processed_content": "The full content with --- delimiters inserted",
  "sections_identified": 3,
  "reasoning": "Brief explanation of what major topic shifts you identified"
}

CRITICAL RULES:
- Return the COMPLETE content - do not truncate or summarize
- PRESERVE exact formatting, spacing, and markdown syntax
- ONLY add --- delimiters, nothing else
- BE CONSERVATIVE - err on the side of fewer delimiters
- Think: "Would these be in the same chapter of a book?" If yes, NO delimiter
- If sentences/paragraphs are thematically related, keep them together
- Maximum ~2-4 delimiters for a typical daily journal (not 10+)`;
}

async function createProcessingLog(tp, filename, response) {
    const timestamp = tp.date.now("YYYY-MM-DD-HHmmss");
    const logPath = `Notifications/Legacy-Processing-${timestamp}.md`;

    const content = `---
type: notification
created: ${tp.date.now("YYYY-MM-DD HH:mm:ss")}
notification_type: "legacy_processing"
source_file: "${filename}"
---

# Legacy Journal Processing

**File:** ${filename}
**Processed:** ${tp.date.now("YYYY-MM-DD HH:mm:ss")}
**Sections Identified:** ${response.sections_identified}

## AI Reasoning

${response.reasoning}

## Result

✅ Delimiters inserted successfully. Original file has been updated.

---

*You can now run "Process Daily Note" on this file to extract and classify entries.*
`;

    await app.vault.create(logPath, content);
}

// Templater wrapper export
module.exports = async (tp) => await processLegacyJournal(tp);
