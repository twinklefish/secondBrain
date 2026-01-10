const INBOX_LOG_FOLDER = "Inbox-Log";
const ARCHIVE_FOLDER = `${INBOX_LOG_FOLDER}/Archive`;
const NOTIFICATIONS_FOLDER = "Notifications";
const DAYS_TO_KEEP = 90;

async function archiveOldLogs(tp) {
    const dv = app.plugins.plugins.dataview.api;
    if (!dv) {
        new Notice("Dataview plugin not loaded");
        return;
    }

    const cutoffDate = moment().subtract(DAYS_TO_KEEP, 'days').format("YYYY-MM-DD");

    const oldLogs = dv.pages(`"${INBOX_LOG_FOLDER}"`)
        .where(p => p.created && p.created < cutoffDate)
        .array();

    if (oldLogs.length === 0) {
        new Notice(`No logs older than ${DAYS_TO_KEEP} days found`);
        return;
    }

    new Notice(`Archiving ${oldLogs.length} logs...`);

    // Create archive folder if needed
    if (!app.vault.getAbstractFileByPath(ARCHIVE_FOLDER)) {
        await app.vault.createFolder(ARCHIVE_FOLDER);
    }

    // Move old logs
    let moved = 0;
    for (const log of oldLogs) {
        const file = log.file;
        const newPath = `${ARCHIVE_FOLDER}/${file.name}`;
        try {
            await app.fileManager.renameFile(file, newPath);
            moved++;
        } catch (e) {
            console.error(`Failed to archive ${file.path}:`, e);
        }
    }

    new Notice(`Archived ${moved} logs older than ${DAYS_TO_KEEP} days`);

    // Create summary notification
    const summary = `# 🗃️ Archive Summary

**Date:** ${tp.date.now("YYYY-MM-DD HH:mm:ss")}
**Archived:** ${moved} logs
**Cutoff Date:** ${cutoffDate}

Logs older than ${DAYS_TO_KEEP} days are now in [[${ARCHIVE_FOLDER}/]]

---

## Statistics

- Total logs archived: ${moved}
- Archive location: \`${ARCHIVE_FOLDER}/\`
- Logs are preserved for reference but won't appear in queries`;

    const notifPath = `${NOTIFICATIONS_FOLDER}/Archive-${tp.date.now("YYYY-MM-DD-HHmmss")}.md`;
    await app.vault.create(notifPath, summary);
}


// Templater wrapper export
module.exports = async (tp) => await archiveOldLogs(tp);
