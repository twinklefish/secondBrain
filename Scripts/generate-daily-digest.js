const NOTIFICATIONS_FOLDER = "Notifications";

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
        model: "moonshotai/kimi-k2-instruct-0905", // Using Groq's Llama 3.3 70B model
        maxTokens: 1024,
        temperature: 0,
        maxRetries: 3,
        retryDelay: 1000,
        ...options
    };

    const key = await ensureAPIKey();

    // DEBUG: Log key format (first/last 4 chars only for security)
    console.log("API Key loaded:", key ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}` : "MISSING");
    console.log("API Key length:", key ? key.length : 0);

    let lastError;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
            const requestBody = {
                model: config.model,
                messages: [{
                    role: "user",
                    content: prompt
                }],
                max_tokens: config.maxTokens,
                temperature: config.temperature
            };

            // DEBUG: Log request details
            console.log("Groq API Request:", {
                url: `${config.baseURL}/chat/completions`,
                model: config.model,
                authHeader: `Bearer ${key.substring(0, 10)}...`
            });

            const response = await fetch(`${config.baseURL}/chat/completions`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${key}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}`;
                try {
                    const errorData = await response.json();
                    console.error("Groq API Error Response:", errorData);
                    errorMessage = errorData.error?.message || errorMessage;
                } catch (parseErr) {
                    const errorText = await response.text();
                    console.error("Groq API Error (raw):", errorText);
                    errorMessage = errorText || errorMessage;
                }
                const error = new Error(errorMessage);
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
// MAIN DIGEST FUNCTION
// ============================================

async function generateDailyDigest(tp) {
    const dv = app.plugins.plugins.dataview.api;
    if (!dv) {
        new Notice("Dataview plugin not loaded");
        return;
    }

    new Notice("Generating daily digest...");

    // Query active projects
    const projects = await queryActiveProjects(dv);

    // Query people with follow-ups
    const people = await queryPeopleWithFollowups(dv);

    // Query today's admin tasks
    const adminTasks = await queryTodaysTasks(dv);

    // Build context for AI
    const context = buildDigestContext(projects, people, adminTasks);

    // Generate digest with AI
    const digest = await generateDigest(context, tp.date.now("YYYY-MM-DD"));

    // Create notification
    await createDigestNotification(tp, digest);

    new Notice("Daily digest created!");
}

async function queryActiveProjects(dv) {
    return dv.pages('"Projects"')
        .where(p => p.status === "active")
        .limit(20)
        .map(p => ({
            name: p.file.name,
            status: p.status,
            next_action: p.next_action || "None specified",
            last_touched: p.last_touched
        }))
        .array();
}

async function queryPeopleWithFollowups(dv) {
    return dv.pages('"People"')
        .where(p => p.follow_ups && p.follow_ups.trim() !== "")
        .limit(10)
        .map(p => ({
            name: p.file.name,
            follow_ups: p.follow_ups,
            last_touched: p.last_touched
        }))
        .array();
}

async function queryTodaysTasks(dv) {
    const today = moment().format("YYYY-MM-DD");
    return dv.pages('"Admin"')
        .where(p => p.status === "todo")
        .where(p => p.due_date && p.due_date <= today)
        .limit(10)
        .map(p => ({
            name: p.file.name,
            due_date: p.due_date,
            status: p.status
        }))
        .array();
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

    try {
        const response = await callGroqAPI(prompt, { maxTokens: 1024 });
        return response;
    } catch (e) {
        return `# Daily Digest Error\n\nFailed to generate digest: ${e.message}\n\nPlease check your Groq API key and try again.`;
    }
}

async function createDigestNotification(tp, digest) {
    const timestamp = tp.date.now("YYYY-MM-DD-HHmm");
    const notifPath = `${NOTIFICATIONS_FOLDER}/Daily-Digest-${timestamp}.md`;

    const content = `---
type: notification
created: ${tp.date.now("YYYY-MM-DD HH:mm:ss")}
notification_type: "daily_digest"
---

tags::

${digest}`;

    await app.vault.create(notifPath, content);
}


// Templater wrapper export
module.exports = async (tp) => await generateDailyDigest(tp);
