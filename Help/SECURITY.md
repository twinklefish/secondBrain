# Security & Privacy Guide

## 🔒 What's Protected

This vault is configured to protect your personal data from accidental exposure via git commits.

---

## 📁 Files Protected by .gitignore

### API Keys & Credentials
```
Scripts/groq-api-key.txt     # Your Groq API key
Scripts/.env                  # Alternative key location
Scripts/groq-api-key          # Alternative key location
```

**Why:** API keys provide access to your Groq account and usage credits.

---

### Personal Data Files
```
Dashboard.md                  # Contains Dataview query results with your data
```

**Why:** The dashboard displays your actual projects, contacts, tasks, and ideas through Dataview queries. This contains personal information.

**Safe alternative:** `Templates/Dashboard-Template.md` (clean template, no personal data)

---

### Workspace Files
```
.obsidian/workspace.json          # Your personal layout
.obsidian/workspace-mobile.json   # Your mobile layout
```

**Why:** Contains your personal window/pane arrangements and open files.

---

### Optional: Generated Content

**Currently NOT git-ignored (you may want to sync via Obsidian Sync):**
```
0-Daily/         # Your daily notes
People/          # Contact records
Projects/        # Project notes
Ideas/           # Idea capture
Admin/           # Tasks
Inbox-Log/       # Processing history
Notifications/   # System outputs
```

**To exclude from git:**
Uncomment these lines in `.gitignore`:
```gitignore
# Notifications/
# Inbox-Log/
# 0-Daily/
# People/
# Projects/
# Ideas/
# Admin/
```

---

## ✅ Safe to Commit

These files contain **no personal data** and are safe for git:

### Templates
```
Templates/Person-Template.md
Templates/Project-Template.md
Templates/Idea-Template.md
Templates/Admin-Template.md
Templates/Daily-Note-Template.md
Templates/Dashboard-Template.md  # Clean template (not your active dashboard!)
Templates/Runners/*.md
```

**Why:** Templates are structural code, not your actual data.

---

### Scripts
```
Scripts/process-daily-note.js
Scripts/generate-daily-digest.js
Scripts/generate-weekly-review.js
Scripts/reclassify-entry.js
Scripts/archive-old-logs.js
Scripts/groq-api.js
```

**Why:** Scripts contain no secrets or personal data (API key is in separate file).

---

### Documentation
```
README.md
CLAUDE.md
Help/*.md
Templates/README.md
.gitignore
.claudeignore
```

**Why:** Documentation and configuration (no secrets or personal data).

---

## 🛡️ Claude Code Protection (.claudeignore)

Prevents Claude from automatically reading sensitive files:

```
Scripts/groq-api-key.txt      # API key
Scripts/groq-api-key          # Alternative
.env                          # Alternative

# Personal data folders
0-Daily/**
Notifications/**
Inbox-Log/**
People/**
Projects/**
Ideas/**
Admin/**
```

**Note:** `.claudeignore` prevents **automatic** inclusion, but Claude can still read files if explicitly asked. Never ask Claude to read your API key file.

---

## 🔐 Best Practices

### 1. API Key Management

**DO:**
- ✅ Store in `Scripts/groq-api-key.txt` (git-ignored)
- ✅ Rotate key if exposed
- ✅ Enable Groq Zero Data Retention
- ✅ Set usage limits in Groq console

**DON'T:**
- ❌ Hard-code in scripts
- ❌ Commit to git
- ❌ Share in screenshots
- ❌ Paste in public chats

---

### 2. Dashboard Management

**DO:**
- ✅ Keep `Dashboard.md` git-ignored
- ✅ Use `Templates/Dashboard-Template.md` for version control
- ✅ Recreate from template when needed

**DON'T:**
- ❌ Commit `Dashboard.md` with your personal query results
- ❌ Share screenshots of populated dashboard

---

### 3. Git Commits

**Before each commit, verify:**
```bash
git status
```

**Check that these are NOT staged:**
- Scripts/groq-api-key.txt
- Dashboard.md
- 0-Daily/ (if excluded)
- People/ (if excluded)

---

### 4. Sharing the Vault

**If sharing your vault structure with others:**

1. **Use git clone** - .gitignore will protect sensitive files
2. **Share only these folders:**
   - Templates/
   - Scripts/ (WITHOUT groq-api-key.txt)
   - Help/
   - Root .md files (README, CLAUDE, SECURITY)

3. **Don't share:**
   - Your API key file
   - Your populated Dashboard.md
   - Your personal notes (0-Daily, People, Projects, etc.)

---

## 🚨 If You Accidentally Commit Secrets

### API Key Exposed

1. **Immediately rotate the key:**
   - Go to https://console.groq.com/keys
   - Delete the exposed key
   - Create a new key
   - Update `Scripts/groq-api-key.txt`

2. **Remove from git history** (if pushed):
   ```bash
   # Use git-filter-repo or BFG Repo-Cleaner
   # Or make the repository private
   ```

3. **Consider the repository compromised** if public

---

### Personal Data Exposed

1. **Remove Dashboard.md from git:**
   ```bash
   git rm --cached Dashboard.md
   git commit -m "Remove personal dashboard data"
   ```

2. **Update .gitignore:**
   ```bash
   echo "Dashboard.md" >> .gitignore
   git add .gitignore
   git commit -m "Add Dashboard.md to gitignore"
   ```

3. **Force push** (if not shared with others):
   ```bash
   git push --force
   ```

4. **Or make repository private**

---

## 🔍 Security Checklist

Before pushing to a public git repository:

- [ ] `Scripts/groq-api-key.txt` exists and is git-ignored
- [ ] `Dashboard.md` is git-ignored
- [ ] Run `git status` and verify no sensitive files are staged
- [ ] Check `.gitignore` is committed
- [ ] API key has usage limits set in Groq console
- [ ] Groq Zero Data Retention is enabled
- [ ] No screenshots with personal data in commits
- [ ] README doesn't contain your actual API key as an example

---

## 📋 Summary

**Three-Layer Protection:**

1. **Git-ignore** - Prevents accidental commits
2. **Claude-ignore** - Prevents AI reading (with explicit reads still possible)
3. **Groq ZDR** - Prevents API provider from storing your data

**Key principle:** Structure and code are public, data and keys are private.

---

**Last Updated:** 2026-01-10
