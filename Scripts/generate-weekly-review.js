const NOTIFICATIONS_FOLDER = "Notifications";
const INBOX_LOG_FOLDER = "Inbox-Log";

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
                    temperature: config.temperature
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                const error = new Error(errorData.error?.message || `HTTP ${response.status}`);
                error.status = response.status;
                throw error;
            }

            const data = await response.json();
            return data.choices[0].message.content;

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
// MAIN WEEKLY REVIEW FUNCTION
// ============================================

async function generateWeeklyReview(tp) {
    const dv = app.plugins.plugins.dataview.api;
    if (!dv) {
        new Notice("Dataview plugin not loaded");
        return;
    }

    new Notice("Generating weekly review...");

    // Query this week's inbox log
    const inboxLog = await queryWeeklyInboxLog(dv);

    // Query all active/waiting/blocked projects
    const projects = await queryAllActiveProjects(dv);

    // Build context
    const context = buildWeeklyContext(inboxLog, projects);

    // Generate review
    const review = await generateReview(context, inboxLog.length);

    // Create notification
    await createReviewNotification(tp, review);

    new Notice("Weekly review created!");
}

async function queryWeeklyInboxLog(dv) {
    const sevenDaysAgo = moment().subtract(7, 'days').format("YYYY-MM-DD");

    return dv.pages(`"${INBOX_LOG_FOLDER}"`)
        .where(p => p.created && p.created >= sevenDaysAgo)
        .limit(100)
        .map(p => ({
            original_text: p.original_text,
            filed_to: p.filed_to,
            destination_name: p.destination_name,
            status: p.status,
            confidence: p.confidence
        }))
        .array();
}

async function queryAllActiveProjects(dv) {
    return dv.pages('"Projects"')
        .where(p => ["active", "waiting", "blocked"].includes(p.status))
        .limit(30)
        .map(p => ({
            name: p.file.name,
            status: p.status,
            next_action: p.next_action || "None specified"
        }))
        .array();
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

    try {
        const response = await callGroqAPI(prompt, { maxTokens: 2048 });
        return response;
    } catch (e) {
        return `# Weekly Review Error\n\nFailed to generate review: ${e.message}\n\nPlease check your Groq API key and try again.`;
    }
}

async function createReviewNotification(tp, review) {
    const timestamp = tp.date.now("YYYY-MM-DD");
    const notifPath = `${NOTIFICATIONS_FOLDER}/Weekly-Review-${timestamp}.md`;

    const content = `---
type: notification
created: ${tp.date.now("YYYY-MM-DD HH:mm:ss")}
notification_type: "weekly_review"
---

${review}`;

    await app.vault.create(notifPath, content);
}


// Templater wrapper export
module.exports = async (tp) => await generateWeeklyReview(tp);
