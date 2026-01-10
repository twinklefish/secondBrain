// ============================================
// API KEY LOADING (CRITICAL SECURITY)
// ============================================

// Load from git-ignored file in Scripts/ folder
async function loadAPIKey() {
    try {
        const envFile = app.vault.getAbstractFileByPath("Scripts/.env");
        if (envFile) {
            const content = await app.vault.read(envFile);
            const match = content.match(/GROQ_API_KEY=(.+)/);
            if (match) return match[1].trim();
        }
    } catch (e) {
        console.error("Failed to load API key from .env:", e);
    }

    // Fallback: hardcoded (NOT RECOMMENDED - for initial testing only)
    return "YOUR_GROQ_API_KEY_HERE";
}

// Load API key on module initialization
let API_KEY;
async function ensureAPIKey() {
    if (!API_KEY) {
        API_KEY = await loadAPIKey();
    }
    return API_KEY;
}

const GROQ_CONFIG = {
    baseURL: "https://api.groq.com/openai/v1",
    model: "moonshotai/kimi-k2-instruct-0905",
    maxTokens: 1024,
    temperature: 0,
    maxRetries: 3,
    retryDelay: 1000 // ms, doubles each retry
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGroqAPI(prompt, options = {}) {
    const config = { ...GROQ_CONFIG, ...options };
    const key = await ensureAPIKey(); // Ensure API key is loaded
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
                    response_format: { type: "json_object" } // Enforce JSON output
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

            // Clean potential markdown wrapping
            const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

            return cleaned;

        } catch (error) {
            lastError = error;

            // Don't retry on 4xx errors (except 429)
            if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
                throw error;
            }

            // Exponential backoff for retries
            if (attempt < config.maxRetries) {
                const delay = config.retryDelay * Math.pow(2, attempt);
                console.log(`Groq API call failed (attempt ${attempt + 1}/${config.maxRetries + 1}), retrying in ${delay}ms...`);
                await sleep(delay);
            }
        }
    }

    throw lastError || new Error("Groq API call failed after retries");
}

function validateClassification(jsonString) {
    try {
        const obj = JSON.parse(jsonString);

        if (!obj.destination) throw new Error("Missing 'destination' field");
        if (typeof obj.confidence !== 'number') throw new Error("Missing or invalid 'confidence' field");
        if (!obj.data) throw new Error("Missing 'data' field");

        const validDestinations = ["people", "projects", "ideas", "admin", "needs_review"];
        if (!validDestinations.includes(obj.destination)) {
            throw new Error(`Invalid destination: ${obj.destination}`);
        }

        return obj;
    } catch (e) {
        throw new Error(`Classification validation failed: ${e.message}`);
    }
}

// Export for use in other scripts
module.exports = { callGroqAPI, validateClassification };
