# CLAUDE.md — Agent Context File
# GCE Attendance Report Generator

**Purpose of this file:** This document gives an AI agent complete context to resume work on this project without any prior conversation history. Read the entire file before making any changes. Do not assume — ask if anything is ambiguous.

---

## 1. What This Project Is

A **Google Apps Script** system that automates attendance reporting for a college (GCE — Government College of Education). Teachers record student attendance using the **Memento Database** Android app. Memento syncs each teacher's attendance to their own individual Google Sheet. This system reads all those sheets, generates formatted reports, and exports PDFs — all triggered from a menu inside a single "controller" Google Sheet.

**The user runs this once per semester.** The system is designed to minimise manual effort each semester.

---

## 2. How The System Is Used

1. Teacher attendance sheets live in a shared Google Drive folder.
2. The controller spreadsheet (e.g. `2026-1-GCE-Attendance-Controller`) also lives in **that same folder**.
3. The user opens the controller spreadsheet → sees a **GCE** menu.
4. They click **GCE → Populate Config** — the script scans the parent folder, creates a `Config` sheet tab inside the controller spreadsheet, and fills in one row per teacher sheet found.
5. The user fills in `start_date` and `end_date` for each row, sets `process = TRUE` for the teachers they want to run.
6. They click **GCE → Process Attendance** — the script processes every `TRUE` row, creates report sheets inside each teacher's spreadsheet, and saves PDFs to Google Drive.

---

## 3. File Structure

```
Attendance Report Batch Generator/       ← project root (= the user's selected folder)
├── Code.js                              ← ALL processing logic (Google Apps Script)
├── Config.js                            ← User-editable configuration constants only
├── README.md                            ← End-user documentation
├── CLAUDE.md                            ← This file (AI agent context)
└── samples/
    ├── sample-config.csv                ← Anonymized example of the Config sheet structure
    └── sample-attendance-data.csv       ← Anonymized example of a teacher's raw attendance sheet
```

**IMPORTANT — file extensions:** The files are `.js` not `.gs`. Google Apps Script accepts both extensions. `.js` was chosen because JavaScript tooling (VS Code, linters, GitHub syntax highlighting) recognizes `.js` but not `.gs`.

**How to deploy:** In the Google Apps Script editor (Extensions → Apps Script inside the controller spreadsheet), create two script files named `Config` and `Code`, paste the contents of `Config.js` and `Code.js` respectively. Google Apps Script ignores the extension — only the filename matters inside the editor.

---

## 4. Config.js — What It Contains

`Config.js` defines a single global object `GCE_CONFIG` with these fields:

| Field | Type | Default | Purpose |
|---|---|---|---|
| `configSheetName` | string | `"Config"` | Name of the config sheet tab inside the controller spreadsheet |
| `defaultSort` | string | `"percentage"` | Default sort for new rows added by Populate Config |
| `defaultPdf` | string | `"both"` | Default PDF mode for new rows added by Populate Config |
| `defaultPdfFolder` | string | `"Attendance Reports"` | Default Drive folder path for PDFs |
| `titleSuffix` | string | `" - Attendance Report"` | Appended to sheet_name when auto-generating a missing title |

`GCE_CONFIG` is referenced throughout `Code.js`. Do not delete or rename it.

---

## 5. Code.js — Architecture Overview

The file is divided into 6 clearly labelled sections:

### Section 1 — Menu Setup
`onOpen()` — Creates the GCE menu. This is the ONLY `onOpen()` in the project (a historical bug had two conflicting `onOpen()` functions from two files; that has been fixed). Menu structure:
- GCE → Populate Config
- GCE → Process Attendance
- GCE → Debug → Test Configuration Reading
- GCE → Debug → Test Folder Search
- GCE → Debug → Test Folder Contents

### Section 2 — Folder Scanner
- `getAttendanceFolder()` — Returns the Google Drive parent folder of the controller spreadsheet. **No folder name is hardcoded.** The controller spreadsheet must live inside the attendance folder for this to work.
- `scanFolderAndPopulateConfig(configSheetName)` — Scans the parent folder, skips the controller file itself (matched by file ID, not by name), finds all Google Sheets, and calls `updateConfigSheet`.
- `updateConfigSheet(spreadsheets, configSheetName)` — Writes to the Config sheet. Contains the canonical `HEADERS` array that defines the Config sheet column order. Creates the Config sheet if it doesn't exist. Writes headers if the sheet is empty. Warns and exits if the sheet has data but unrecognized headers (to avoid overwriting user data). Adds new rows for newly found sheets; updates `sheet_name` of existing rows (matched by `sheet_id`).

### Section 3 — Batch Processor
- `processBatchFromActiveSpreadsheet()` — Menu entry point; calls `processBatchAttendanceReports()`.
- `processBatchAttendanceReports(configSpreadsheetId, configSheetName)` — Reads the Config sheet, loops over rows where `process = TRUE`, calls `mainAttendanceController` for each.
- `getConfigurationData(spreadsheetId, sheetName)` — Reads and validates the Config sheet. Handles optional `pdf_alt_name` column gracefully (older Config sheets without it still work). Auto-fixes missing/duplicate titles instead of throwing errors.
- `formatDateForConfig(dateValue)` — Converts any date format to `YYYY-MM-DD` string.
- `parseBoolean(value)` — Converts sheet cell values (`"TRUE"`, `"true"`, `true`, `1`, `"yes"`) to JavaScript boolean.

### Section 4 — Attendance Engine
- `mainAttendanceController(title, dateRange, sort, pdf, sourceSheetName, spreadsheetId, pdfFolderPath, pdfAltName)` — Top-level controller per teacher. Decides which sub-functions to call based on `sort` and `pdf` parameters. Captures PDF results and passes to `createAltPDFCopies` if `pdfAltName` is set.
- `mainGenerateAttendanceReport(...)` — Generates report sheet(s) only, no PDF.
- `mainGenerateAttendanceReportWithPDF(...)` — Generates report sheet(s), exports PDFs, optionally deletes sheets (`pdf = "only"` mode). Returns array of `{ fileId, fileName, ... }` for each PDF created.
- `getRawData(sourceSheetName, spreadsheetId)` — Reads raw data from a teacher's sheet.
- `processAttendanceData(rawData, dateRange)` — Pipeline: parse → calculate stats → format.
- `parseData(rawData, dateRange)` — Filters by date range, builds student records, filters out dates where no student has Present or Leave status (e.g. holidays).
- `calculateStatistics(studentRecords, validDates)` — Per-student: present/absent/leave counts, percentage. Percentage = Present ÷ (Present + Absent). Leave is NOT counted against percentage.
- `calculateDailyStatistics(studentStats, validDates)` — Per-date: total present/absent/leave across all students.
- `formatReportData(studentStats, validDates)` — Assembles the final 2D array: 4 summary rows + 1 header row + N student rows.
- `sortReportData(reportData, sortOption)` — Sorts student rows by seat or percentage; renumbers the serial column.
- `transformAttendanceDisplay(reportData)` — Converts full words (Present/Absent/Leave) to single letters (P/A/L) in date columns.
- `writeReportToSheet(reportData, title, sortOption, spreadsheetId)` — Creates/clears a sheet, writes data, calls `formatReportSheet`.
- `formatReportSheet(reportSheet, reportData, title)` — All visual formatting: title in row 1 (merged A1:G1, **text wrap enabled**), summary rows 2–5 bold, header row 6 black/white, row banding, column widths, frozen rows/columns (6 rows, 7 columns frozen).

### Section 5 — PDF Export
- `downloadSheetAsPDF(sheetName, folderPath, spreadsheetId)` — Exports a single sheet as PDF using the Google Sheets export API with OAuth token. Landscape, A4, fit to width, frozen rows repeat. Returns `{ success, fileName, fileId, folderPath, downloadUrl }`.
- `getOrCreateFolder(folderPath)` — Navigates or creates a nested folder path in Google Drive (split on `/`).
- `createAltPDFCopies(pdfsGenerated, title, pdfAltName, baseFolderPath)` — **Orthogonal, self-contained function.** After the main PDFs are generated, this copies each PDF into `<baseFolderPath>/Alternate Reports/` and renames it by substituting `title` with `pdfAltName` in the filename. Handles `sort = "both"` automatically because it replaces only the base title portion, leaving suffixes like ` - Seat` and ` - Percentage` intact.

### Section 6 — Legacy
`pivotAttendanceData()` and `generateAttendanceReport()` — deprecated wrappers kept for backward compatibility.

---

## 6. Config Sheet Schema

The Config sheet lives as a tab inside the controller spreadsheet. The canonical column order (defined in `HEADERS` inside `updateConfigSheet`) is:

| # | Column | Required | Valid values / format |
|---|---|---|---|
| 1 | `sheet_id` | Yes | Google Sheets file ID (from URL) |
| 2 | `sheet_name` | Yes | Exact tab name in the teacher's spreadsheet |
| 3 | `title` | Yes | Report sheet name. Auto-generated as `sheet_name + " - Attendance Report"` if blank or equal to `sheet_name` |
| 4 | `start_date` | Yes | `YYYY-MM-DD` |
| 5 | `end_date` | Yes | `YYYY-MM-DD` |
| 6 | `sort` | Yes | `seat` / `percentage` / `both` |
| 7 | `pdf` | Yes | `no` / `only` / `both` |
| 8 | `pdf_folder_path` | Yes | Drive folder path, e.g. `2026 - 1 - GCE/Reports` |
| 9 | `pdf_alt_name` | **Optional** | Alternate base filename for PDF copy. Blank = skip. |
| 10 | `process` | Yes | `TRUE` / `FALSE` |

**`sort` values:**
- `seat` — one report sheet, students in seat-number order
- `percentage` — one report sheet, students highest-to-lowest attendance %
- `both` — two report sheets: `<title> - Seat` and `<title> - Percentage`; two PDFs if pdf ≠ "no"

**`pdf` values:**
- `no` — report sheet only, no PDF
- `only` — PDF saved to Drive, report sheet deleted after export
- `both` — report sheet kept AND PDF saved to Drive

**`pdf_alt_name` behaviour:**
- If set: after main PDF(s) are saved, copies are made in `<pdf_folder_path>/Alternate Reports/` with the alt name substituted for the base title. The user can use a Google Sheets formula to auto-compute this column, e.g.: `=REGEXREPLACE(C2, "^(.*?) - (.*?) - (.*)", "$2 - $1 - $3")` to swap teacher name and semester name.
- If blank: no copy is made, no error.

---

## 7. Raw Attendance Data Schema

Each teacher's Google Sheet (the source data, produced by Memento Database) must have a tab with these exact column headers (case-sensitive):

| Column | Required | Notes |
|---|---|---|
| `Date` | Yes | Date of the class. Format: `M/D/YYYY` (Memento default). Code also accepts `YYYY-MM-DD` and Date objects. |
| `Seat` | Yes | Student roll/seat number. Used as unique ID. Format: `A1-YYYYMMPPPPPP` (e.g. `A1-242158006001`). |
| `Name` | Yes | Student full name. |
| `Status` | Yes | `Present`, `Leave`, or blank/anything else (treated as Absent). Note: `Absent` as a string is also treated as Absent. |
| `Comments` | No | Free text. Ignored by the code. |
| `__id` | No | Internal Memento record ID. Ignored by the code. |

**Rows with empty `Seat` or `Name` are silently skipped.**

**Date filtering:** Dates outside `start_date`–`end_date` are excluded. Dates where every student has blank/absent status are also excluded (treats them as non-class days).

**Student first appearance:** If a student's first record appears after `start_date`, they are not penalized for earlier dates. Their percentage is calculated only from the date of their first entry onwards.

---

## 8. Report Sheet Layout

Generated inside the teacher's own spreadsheet:

| Row(s) | Content |
|---|---|
| 1 | Title (merged A1:G1, bold, font size 12, **text wrap enabled** — required for long titles) |
| 2 | Total class days (count of valid dates) |
| 3 | Students Present per date |
| 4 | Students Absent per date |
| 5 | Students on Leave per date |
| 6 | Column headers: #, Seat, Name, Percent, Present, Absent, Leave, [date columns...] |
| 7+ | One row per student |

Date column headers use compact 3-line format: `Mon\n04\nAug`.

Frozen: rows 1–6, columns 1–7. Row banding applied to student rows (rows 7+).

---

## 9. Key Design Decisions (and Why)

| Decision | Rationale |
|---|---|
| Parent folder auto-detection | Eliminates the need to hardcode a folder name each semester. The controller spreadsheet must live inside the attendance folder — this is the intended usage pattern. |
| Skip controller by file ID, not name | Renaming the controller spreadsheet won't break the folder scanner. |
| Title auto-fix instead of error | If `title == sheet_name`, the report sheet would overwrite the source data. Rather than crashing the batch, the code silently appends `" - Attendance Report"`. |
| `pdf_alt_name` as a copy, not regeneration | Copying a file in Drive (~instant) is far faster than re-running the full report pipeline per teacher. Critical because GAS has a 6-minute execution limit and the batch can have 50+ teachers. |
| `createAltPDFCopies` is orthogonal | The entire alt-PDF feature was added without touching any existing PDF generation function. If it breaks, it only affects the copy step; the main PDFs are already saved. |
| Single `onOpen()` | A previous version had two files each with their own `onOpen()`, causing one menu to silently suppress the other. The old `get-sheet-name.js` file was removed. |
| `.js` extension instead of `.gs` | Google Apps Script accepts both. `.js` gives better tooling support (VS Code IntelliSense, GitHub syntax highlighting, linters). |
| Leave excluded from attendance % | Leave = excused absence. Percentage = Present ÷ (Present + Absent) only. Leave counts are shown in the report but do not affect the percentage. |
| Dates with all-absent/blank rows excluded | A date where nobody has Present or Leave is assumed to be a non-class day (holiday, cancellation). Including it would inflate absent counts unfairly. |

---

## 10. Known Limitations / Gotchas

1. **Duplicate detection in Populate Config is by `sheet_id` only**, not by `(sheet_id + sheet_name)`. If a teacher's spreadsheet has multiple tabs, each tab gets its own Config row, but the duplicate check cannot distinguish between two tabs of the same spreadsheet. Workaround: after running Populate Config, delete Config rows for any tabs that aren't the raw data tab (e.g. old report sheets that were kept instead of deleted).

2. **GAS execution time limit is 6 minutes.** With 50+ teachers, the batch may hit this limit. If it does, set `process = FALSE` on the already-completed rows and re-run for the remaining ones.

3. **PDF export uses the Sheets export API with an OAuth bearer token.** If the script's authorization is revoked, PDF export will fail with a 401 error. Fix: re-authorize via Apps Script → Run any function → Authorize.

4. **The `pdf = "only"` mode deletes report sheets after PDF export.** If the PDF export fails midway, the sheet is not deleted (the delete only happens after a successful export). However, if the spreadsheet is already at the Google Sheets tab limit, `insertSheet` may fail before any PDF is made.

5. **The `sort = "both"` mode creates two sheets and two PDFs per teacher.** This doubles Drive storage and processing time. For large batches, consider using `sort = "seat"` or `sort = "percentage"` instead of `"both"`.

6. **`pdf_alt_name` only works when `pdf` is `"only"` or `"both"`** (i.e. when PDFs are actually generated). If `pdf = "no"`, the alt name is ignored silently.

---

## 11. Semester Checklist (What The User Does Each Semester)

1. Create a new Drive folder named e.g. `2026 - 2 - GCE Attendance`.
2. Place the controller spreadsheet inside that folder (copy from previous semester or create new).
3. Open Extensions → Apps Script → paste `Config.js` and `Code.js` contents into `Config` and `Code` files.
4. Save and reload the spreadsheet. Authorize when prompted.
5. Click **GCE → Populate Config** — Config sheet is created automatically with all headers.
6. Fill in `start_date` and `end_date` for all rows.
7. Optionally adjust `sort`, `pdf`, `pdf_folder_path`, `pdf_alt_name` per row.
8. Set `process = TRUE` for all rows to run, `FALSE` to skip.
9. Click **GCE → Process Attendance**.

---

## 12. Files That Are NOT Part of the Deployable Code

These files are in the project folder for reference only and are NOT copied into Google Apps Script:

| File | Purpose |
|---|---|
| `README.md` | End-user documentation |
| `CLAUDE.md` | This file — AI agent context |
| `samples/sample-config.csv` | Anonymized example of Config sheet structure |
| `samples/sample-attendance-data.csv` | Anonymized example of teacher's raw attendance sheet |

The original CSV/PDF/XLSX files in the root folder (from Prof Aoun's class) are **real data samples** from the 2026 semester 1 run. They contain real student names and should be treated as sensitive. The anonymized versions in `samples/` should be used for documentation and testing.
