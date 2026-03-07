# GCE Attendance Report Generator

Reads teacher attendance data from individual Google Sheets, generates formatted reports, and exports PDFs — triggered from a menu inside the controller spreadsheet.

---

## Quick Reference — Config Sheet Columns

| Column            | What to put here                                                                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sheet_id`        | Google Sheets file ID (from the URL: `.../spreadsheets/d/**ID**/edit`)                                                                                           |
| `sheet_name`      | Exact tab name inside the teacher's spreadsheet that has the raw data                                                                                            |
| `title`           | Name for the generated report sheet. **Must differ from `sheet_name`.** If blank or identical, auto-set to `sheet_name + " - Attendance Report"`                 |
| `start_date`      | `YYYY-MM-DD` — first date to include                                                                                                                             |
| `end_date`        | `YYYY-MM-DD` — last date to include                                                                                                                              |
| `sort`            | See options below                                                                                                                                                |
| `pdf`             | See options below                                                                                                                                                |
| `pdf_folder_path` | Drive folder path for PDFs, e.g. `2026 - 1 - GCE/Reports`. Created automatically if missing.                                                                     |
| `pdf_alt_name`    | Optional. If set, creates a renamed copy of each generated PDF inside an `Alternate Reports` subfolder within `pdf_folder_path`. Leave blank to skip. See below. |
| `process`         | `TRUE` to include this row in the next run, `FALSE` to skip                                                                                                      |

### `sort` options

| Value        | Effect                                                     |
| ------------ | ---------------------------------------------------------- |
| `seat`       | One sheet, students sorted by seat number                  |
| `percentage` | One sheet, students sorted by attendance % (highest first) |
| `both`       | Two sheets: `<title> - Seat` and `<title> - Percentage`    |

### `pdf_alt_name` — alternate PDF copies

If you want to organize the same reports two different ways (e.g. by teacher name in one folder, by semester in another), set `pdf_alt_name` to the alternate base filename. After the main PDF is saved, the script copies it into an `Alternate Reports` subfolder and renames it.

Example — original name organized by teacher:

```
Prof Mehdi - BEd 4 Semester 5 - English Opt - Attendance Report.pdf
```

Set `pdf_alt_name` to `BEd 4 Semester 5 - Prof Mehdi - English Opt` and the copy becomes:

```
Alternate Reports/BEd 4 Semester 5 - Prof Mehdi - English Opt.pdf
```

When `sort = both`, the suffixes are preserved automatically — both `… - Seat.pdf` and `… - Percentage.pdf` get copied and renamed.

You can use a Google Sheets formula to compute `pdf_alt_name` automatically from `sheet_name` or `title` so you never type it manually.

Leave blank to skip the copy entirely.

### `pdf` options

| Value  | Effect                                              |
| ------ | --------------------------------------------------- |
| `no`   | Report sheet only, no PDF                           |
| `only` | PDF saved to Drive, report sheet deleted afterwards |
| `both` | Report sheet kept and PDF saved to Drive            |

---

## Google Sheet Tips

Use `=REGEXREPLACE(C2, "^(.*?) - (.*?) - (.*)", "$2 - $1 - $3")` to create alternate PDF filenames.

`Prof Shagufta - BEd 2.5E Semester 5 - Practicum - Attendance Report` → `BEd 2.5E Semester 5 - Prof Shagufta - Practicum - Attendance Report`

---

## Menu

| Menu item                                    | What it does                                                                                                                                                                                         |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GCE → Populate Config**                    | Scans the parent Drive folder, creates the Config sheet if needed, adds new rows for any sheets not already listed. Existing rows are refreshed. Dates are left blank — fill them in before running. |
| **GCE → Process Attendance**                 | Processes every row where `process = TRUE`. Errors on individual rows are logged but don't stop the rest.                                                                                            |
| **GCE → Debug → Test Configuration Reading** | Logs all config rows to the Apps Script logger without processing anything                                                                                                                           |
| **GCE → Debug → Test Folder Search**         | Logs the detected parent folder name and ID                                                                                                                                                          |
| **GCE → Debug → Test Folder Contents**       | Lists all files found in the parent folder                                                                                                                                                           |

---

## Setup (each semester)

1. Place the controller spreadsheet **inside the same Drive folder** as all teacher attendance spreadsheets.
2. Open **Extensions → Apps Script**, create two files — `Config.gs` and `Code.gs` — and paste the contents.
3. Save, reload the spreadsheet, authorize when prompted.
4. Click **GCE → Populate Config** — the Config sheet is created and filled automatically.
5. Fill in `start_date` and `end_date` for each row. Adjust `sort`, `pdf`, `pdf_folder_path` as needed. Set `process = TRUE` for the teachers you want to run.
6. Click **GCE → Process Attendance**.

---

## Input Data Format

Each teacher's attendance sheet must have these column headers (case-sensitive): `Date`, `Seat`, `Name`, `Status`.

`Status` values: `Present`, `Leave`. Anything else (blank, `Absent`, etc.) → treated as Absent.

Dates where no student has a Present or Leave entry are automatically excluded (e.g. holidays).

---

## Report Layout

Row 1 is the title. Rows 2–5 are summary statistics (total days, daily present/absent/leave counts). Row 6 is the column header. Row 7 onwards is one row per student. Columns A–G and rows 1–6 are frozen.

Attendance % = `Present ÷ (Present + Absent) × 100`. Leave is not counted against attendance. Students are not penalized for dates before their first recorded entry.

---

## Troubleshooting

**"No spreadsheets found" after Populate Config** — The controller spreadsheet is not inside the attendance folder. Move it in and try again.

**Config sheet shows "unexpected headers" warning** — The Config tab has content that the script doesn't recognise. Delete or rename that tab and run Populate Config again.

**"Source sheet not found"** — `sheet_name` in Config doesn't match the actual tab name. Re-run Populate Config to refresh, or correct the row manually.

**A teacher's spreadsheet has extra tabs (e.g. old reports)** — Populate Config will add each tab as a separate row. Delete or set `process = FALSE` on any rows that aren't the raw data tab.
