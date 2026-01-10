# Templater Configuration Guide

## Required Settings for Templater

You need to configure Templater to recognize the Scripts folder. Here's how:

### 1. Open Templater Settings

In Obsidian:
1. Settings (gear icon) → Templater
2. Scroll down to find these settings

### 2. Configure These Fields

**Template folder location:**
```
Templates
```
(This tells Templater where to find your note templates)

**Script files folder location:**
```
Scripts
```
⚠️ **CRITICAL** - Without this, your JavaScript files won't be accessible!

**Trigger Templater on new file creation:**
```
☑ Enable this checkbox
```
(Optional but recommended)

### 3. Verify Configuration

After setting these:
1. Close Settings
2. Restart Obsidian (to reload Templater with new settings)

### 4. Test That Scripts Are Accessible

After restart, you should be able to:
1. Open Command Palette (Ctrl/Cmd + P)
2. See commands like:
   - "Templater: Process Daily Note"
   - "Templater: Generate Daily Digest"
   - etc.

If you don't see these commands, the Scripts folder isn't configured correctly.

---

## Visual Reference

Your Templater settings should look like this:

```
┌─────────────────────────────────────────────┐
│ Templater Settings                          │
├─────────────────────────────────────────────┤
│                                             │
│ Template folder location                    │
│ ┌─────────────────────────────────────────┐ │
│ │ Templates                               │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Script files folder location                │
│ ┌─────────────────────────────────────────┐ │
│ │ Scripts                                 │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ☑ Trigger Templater on new file creation   │
│                                             │
└─────────────────────────────────────────────┘
```

---

## What This Does

- **Template folder:** Templater knows to look in `Templates/` for template files
- **Script folder:** Templater can execute JavaScript files from `Scripts/`
- **Trigger on creation:** Automatically applies templates to new files

---

## After Configuration

Once configured:
1. Restart Obsidian
2. Enable Groq Zero Data Retention (next step)
3. Run smoke tests to verify everything works

---

## Troubleshooting

**"Command not found" when trying to run scripts:**
- Script folder location is not set correctly
- Restart Obsidian after setting it

**Scripts run but throw errors:**
- Check Developer Console (Ctrl+Shift+I)
- Verify API key is in Scripts/.env

**Templates don't apply automatically:**
- "Trigger Templater on new file creation" is not enabled
- Template folder location is not set

---

## Next: Enable Privacy Protection

After Templater is configured:

Visit: https://console.groq.com/settings/data-controls
Enable **Zero Data Retention**

This ensures Groq doesn't store your personal data from API calls.
