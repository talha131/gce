# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

A **Google Apps Script** project that reads Google Form quiz submissions from a source spreadsheet and writes a colour-coded scoreboard and audit log to a separate output spreadsheet per class. It runs automatically on a time-driven trigger (every hour). There is no build step, no package manager, and no local execution — all code runs inside Google's servers.

## Deploying Changes

**Option A — Manual (current workflow):** Copy the contents of each `.js` file into the corresponding file in the Google Apps Script editor (Extensions → Apps Script from the source spreadsheet).

**Option B — clasp CLI:** Install `clasp` (`npm install -g @google/clasp`), authenticate, and run `clasp push` to sync all files at once. This eliminates the copy-paste workflow entirely.

There are no linting or test commands. Test changes by running `main()` from within the Apps Script editor and inspecting the output spreadsheets and execution log.

## File Structure

Three files — that is the entire project:

| File | Role |
|---|---|
| `config.js` | The only file that needs editing for day-to-day management. Contains the `CONFIG` object. |
| `main.js` | Entry point. Contains `main()`, `resolveSettings()`, and `filterData()`. |
| `lib.js` | All supporting code: data processing helpers + three write functions. |

Google Apps Script shares one global scope across all files — there are no imports or exports. Any function defined in any file is callable from any other file.

> **Note:** `README.md` sections 11 and 12 reference old filenames (`helpers.js`, `writeResultToSheets.js`, etc.). Those files were merged into `lib.js`. The README is otherwise accurate.

## Architecture

```
main() reads source spreadsheet (one tab per quiz)
    ↓
For each class in CONFIG.classes:
    resolveSettings()       → merges class overrides with global defaults
    processSheetData()      → validates attempts, applies two rules (min score + time gap)
    transformData()         → collapses attempts → {email: {quizName: topNScore}}
    filterData()            → two views: registered-only (scoreboard), registered+unknowns (audit)
    writeDetailedResultToSheets()   → audit log tab
    writeResultToSheets()           → scoreboard tab
```

**Critical architectural rule — `CONFIG` vs `settings`:**
- `CONFIG` holds global defaults only. It is read directly in exactly two places: `resolveSettings()` (as fallback values) and the `CONFIG.classes` loop.
- Every other function that needs scoring values receives a `settings` object as a parameter. Reading `CONFIG.minimumScore` (or any other scoring field) directly from `lib.js` or anywhere outside `resolveSettings()` is a bug — the class may have per-class overrides that would be silently ignored.

**`processSheetData` runs once per class, not once globally.** This is intentional: each class can have different validation settings (`minimumScore`, `timeBetweenAttempts`, etc.).

**Quiz names come from source sheet tabs**, not from attempt data. `quizNames = Object.keys(rawSheetData)` is derived in `main()` and passed explicitly to the write functions. This ensures quizzes with zero attempts still appear as columns.

**Raw sheet data is read once** into `rawSheetData`, then reused for each class — no repeated API calls to the source spreadsheet.

## Key Rules for Code Changes

- **`naturalSort`** is defined exactly once in `lib.js`. Do not redefine it anywhere else.
- Functions must not read scoring settings from `CONFIG` directly — use the `settings` parameter.
- The script only **reads** the source spreadsheet and the Email Map. All writes go to the output spreadsheets. Never add code that writes back to the source spreadsheet or the Email Map tab.
- Unknown students (email absent from all class Email Maps) must **not** appear on any scoreboard but **must** appear in the audit log of every class.
- Scoring uses the **highest** `requiredAttempts` valid scores, not the first `requiredAttempts`. The sort in `transformData` (`sort((a, b) => b - a)`) is intentional.
- The time-gap validation rule (Rule 2 in `processSheetData`) compares against the last **valid** attempt, not the last attempt of any kind.
