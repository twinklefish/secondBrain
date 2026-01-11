// ============================================
// BATCH PROCESS LEGACY JOURNALS
// ============================================
// Processes all legacy journal files from Legacy-Import/ folder
// 1. Move to Inbox/
// 2. Process to 0-Daily/ (structure format)
// 3. Classify entries to categories
// Shows progress, handles errors gracefully
//
// NOTE: This does NOT add --- delimiters. Files are processed as-is:
// - Files with existing --- delimiters will have each section classified separately
// - Files without delimiters will be processed as a single entry
// - Use process-legacy-journal.js manually if you want to add delimiters to specific files

// ============================================
// HELPER FUNCTIONS
// ============================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
            // Check if already processed
            const archiveFile = app.vault.getAbstractFileByPath(`Inbox-Archive/${file.name}`);
            const dailyFile = app.vault.getAbstractFileByPath(`${DAILY_FOLDER}/${file.basename}.md`);

            if (archiveFile || dailyFile) {
                console.log(`  ⏭️ Skipped (already processed)`);
                stats.skipped++;
                continue;
            }

            // Step 1: Move to Inbox
            await moveToInbox(file);

            // Step 2: Process through Inbox → Daily Note
            const inboxFile = app.vault.getAbstractFileByPath(`${INBOX_FOLDER}/${file.name}`);
            if (inboxFile) {
                await processInboxToDailyNote(tp, inboxFile);

                // Step 3: Process Daily Note → Classify entries
                const processedDailyFile = app.vault.getAbstractFileByPath(`${DAILY_FOLDER}/${file.basename}.md`);
                if (processedDailyFile) {
                    await processDailyNoteEntries(tp, processedDailyFile);
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

1. ✅ Moved ${stats.processed} legacy journals from Legacy-Import/ to processing pipeline
2. ✅ Structured entries into Daily Note format (respecting existing --- delimiters)
3. ✅ Classified entries to People/Projects/Ideas/Admin categories
4. ✅ Created inbox logs for audit trail

## Next Steps

1. Run "Generate Historical Weekly Reviews" to create weekly reviews for all processed data
2. Run "Archive Old Logs" to clean up old inbox logs
3. Review any failed files listed above and process manually if needed

## Note on Delimiters

Files were processed as-is without adding delimiters:
- Files with existing `---` delimiters had each section classified separately
- Files without delimiters were processed as single entries
- Use "Process Legacy Journal" manually on individual files if you want to add delimiters

---

*Batch processing took approximately ${Math.round(stats.total * 2 / 60)} minutes*
`;

    await app.vault.create(summaryPath, content);
}

// Templater wrapper export
module.exports = async (tp) => await processLegacyBatch(tp);
