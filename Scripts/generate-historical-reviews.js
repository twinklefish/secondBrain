// ============================================
// GENERATE HISTORICAL WEEKLY REVIEWS
// ============================================
// Generates weekly reviews for all weeks in the historical data
// Scans Inbox-Log for all unique weeks and creates a review for each

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
// HISTORICAL REVIEW GENERATION
// ============================================

async function generateHistoricalReviews(tp) {
    const dv = app.plugins.plugins.dataview.api;
    if (!dv) {
        new Notice("❌ Dataview plugin not loaded");
        return;
    }

    new Notice("🔄 Generating historical weekly reviews...");

    // Get all weeks that have inbox log data
    const weeks = await getAllWeeksWithData(dv);

    if (weeks.length === 0) {
        new Notice("❌ No historical data found in Inbox-Log");
        return;
    }

    console.log(`Found ${weeks.length} weeks with data to review`);
    new Notice(`Found ${weeks.length} weeks. Generating reviews...`);

    const stats = {
        total: weeks.length,
        generated: 0,
        failed: 0,
        errors: []
    };

    // Generate review for each week
    for (let i = 0; i < weeks.length; i++) {
        const weekStart = weeks[i];
        const progress = `[${i + 1}/${weeks.length}]`;

        console.log(`${progress} Generating review for week of ${weekStart}`);
        new Notice(`${progress} Week of ${weekStart}...`);

        try {
            await generateWeekReview(tp, dv, weekStart);
            stats.generated++;

            // Rate limiting
            if (i < weeks.length - 1) {
                await sleep(1000); // 1 second between reviews
            }

        } catch (error) {
            console.error(`Failed to generate review for ${weekStart}:`, error);
            stats.failed++;
            stats.errors.push({
                week: weekStart,
                error: error.message
            });
        }
    }

    // Create summary
    await createHistoricalReviewSummary(tp, stats);

    new Notice(`✅ Generated ${stats.generated} weekly reviews! (${stats.failed} failed)`);
}

async function getAllWeeksWithData(dv) {
    // Get all inbox logs
    const allLogs = dv.pages(`"${INBOX_LOG_FOLDER}"`).array();

    // Extract unique week start dates (Monday of each week)
    const weekStarts = new Set();

    allLogs.forEach(log => {
        if (!log.source_note) return;

        // Extract date from source_note
        const match = log.source_note.toString().match(/\[\[(\d{4}-\d{2}-\d{2})\]\]/);
        if (!match) return;

        const date = moment(match[1]);
        const weekStart = date.clone().startOf('week').format('YYYY-MM-DD');
        weekStarts.add(weekStart);
    });

    // Sort weeks chronologically
    return Array.from(weekStarts).sort();
}

async function generateWeekReview(tp, dv, weekStart) {
    const weekEnd = moment(weekStart).add(6, 'days').format('YYYY-MM-DD');

    // Query data for this week
    const inboxLog = await queryWeeklyInboxLog(dv, weekStart, weekEnd);
    const projects = await queryAllActiveProjects(dv);
    const categoryCounts = await getCategoryCountsForWeek(dv, weekStart, weekEnd);

    // Build context
    const context = buildWeeklyContext(inboxLog, projects, categoryCounts);

    // Generate review
    const review = await generateReview(context, inboxLog.length, categoryCounts);

    // Create notification
    await createReviewNotification(tp, review, weekStart);
}

async function queryWeeklyInboxLog(dv, weekStart, weekEnd) {
    const allLogs = dv.pages(`"${INBOX_LOG_FOLDER}"`).array();

    const weeklyLogs = allLogs.filter(p => {
        if (!p.source_note) return false;

        const match = p.source_note.toString().match(/\[\[(\d{4}-\d{2}-\d{2})\]\]/);
        if (!match) return false;

        const sourceDate = match[1];
        return sourceDate >= weekStart && sourceDate <= weekEnd;
    });

    return weeklyLogs.map(p => ({
        original_text: p.original_text,
        filed_to: p.filed_to,
        destination_name: p.destination_name,
        status: p.status,
        confidence: p.confidence,
        source_note: p.source_note
    }));
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

async function getCategoryCountsForWeek(dv, weekStart, weekEnd) {
    const categories = {
        people: 0,
        projects: 0,
        ideas: 0,
        admin: 0,
        needs_review: 0
    };

    const folders = {
        people: '"People"',
        projects: '"Projects"',
        ideas: '"Ideas"',
        admin: '"Admin"'
    };

    for (const [category, folder] of Object.entries(folders)) {
        const items = dv.pages(folder)
            .where(p => {
                if (!p.created) return false;
                const createdDate = moment(p.created.toString());
                return createdDate.isBetween(weekStart, weekEnd, 'day', '[]');
            })
            .array();

        categories[category] = items.length;
    }

    // Count needs_review from inbox logs
    const needsReview = dv.pages(`"${INBOX_LOG_FOLDER}"`)
        .where(p => p.status === "needs_review")
        .array();
    categories.needs_review = needsReview.length;

    return categories;
}

function buildWeeklyContext(inboxLog, projects, categoryCounts) {
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

    context += "\n=== CAPTURE SUMMARY (from category folders) ===\n";
    context += `people: ${categoryCounts.people}\n`;
    context += `projects: ${categoryCounts.projects}\n`;
    context += `ideas: ${categoryCounts.ideas}\n`;
    context += `admin: ${categoryCounts.admin}\n`;
    if (categoryCounts.needs_review > 0) {
        context += `needs_review (pending classification): ${categoryCounts.needs_review}\n`;
    }

    return context;
}

async function generateReview(context, totalCaptures, categoryCounts) {
    const prompt = `You are a personal productivity assistant conducting a weekly review. Analyze the following data and generate an insightful summary.

${context}

TOTAL CAPTURES THIS WEEK: ${totalCaptures}

INSTRUCTIONS:
Create a weekly review with EXACTLY this format. Keep it under 250 words total.

---

📅 **Week in Review**

**📊 Quick Stats:**
- Items captured: ${totalCaptures}
- Breakdown: ${categoryCounts.people} people, ${categoryCounts.projects} projects, ${categoryCounts.ideas} ideas, ${categoryCounts.admin} admin

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

**🔧 Items Needing Manual Classification:**
${categoryCounts.needs_review > 0 ? `${categoryCounts.needs_review} items routed to clarification due to low AI confidence - review in Notifications/Needs-Review.md` : 'None - all items classified successfully'}

---

RULES:
- Use the EXACT numbers provided for stats breakdown - do not recalculate
- "Needs Review" means items with low AI confidence waiting for manual categorization in Needs-Review.md
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

async function createReviewNotification(tp, review, weekStart) {
    const notifPath = `${NOTIFICATIONS_FOLDER}/Historical-Weekly-Review-${weekStart}.md`;

    const content = `---
type: notification
created: ${tp.date.now("YYYY-MM-DD HH:mm:ss")}
notification_type: "weekly_review_historical"
week_start: ${weekStart}
---

${review}`;

    await app.vault.create(notifPath, content);
}

async function createHistoricalReviewSummary(tp, stats) {
    const timestamp = tp.date.now("YYYY-MM-DD-HHmmss");
    const summaryPath = `Notifications/Historical-Reviews-Summary-${timestamp}.md`;

    let errorList = "";
    if (stats.errors.length > 0) {
        errorList = "\n## Errors\n\n";
        stats.errors.forEach(e => {
            errorList += `- **Week ${e.week}**: ${e.error}\n`;
        });
    }

    const content = `---
type: notification
created: ${tp.date.now("YYYY-MM-DD HH:mm:ss")}
notification_type: "historical_reviews_summary"
---

# Historical Weekly Reviews Generated

**Completed:** ${tp.date.now("YYYY-MM-DD HH:mm:ss")}

## Summary

- **Total Weeks:** ${stats.total}
- **Reviews Generated:** ${stats.generated}
- **Failed:** ${stats.failed}

${errorList}

## What's Next

1. Review the generated weekly reviews in Notifications/ folder (search for "Historical-Weekly-Review-")
2. Identify patterns across multiple weeks
3. Run "Archive Old Logs" to clean up old inbox logs

---

*Historical review generation complete!*
`;

    await app.vault.create(summaryPath, content);
}

// Templater wrapper export
module.exports = async (tp) => await generateHistoricalReviews(tp);
