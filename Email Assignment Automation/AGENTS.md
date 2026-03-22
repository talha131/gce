# AGENTS.md — Email Assignment Automation

This file exists to give any AI agent (or developer) full context about this project without requiring any back-and-forth with the owner. Read this entirely before making any suggestions or changes.

---

## What This Project Is

A **Google Apps Script** automation deployed inside a **Google Sheet**. It sends personalized assignment emails to students by reading their data from the sheet and matching it to a pre-written Gmail draft. The script is **always triggered manually** — there are no time-based or event-based triggers. The owner runs it from a custom menu inside the Google Sheet.

---

## Who Owns and Uses This

- The owner is a **teacher/instructor**.
- They are the **sole user** of the sheet and the script.
- All student data (emails, names, seat numbers) is **private and accessible only to the teacher**.
- There is no shared access — no one else opens or edits the sheet.
- Data privacy is not a concern from a multi-user perspective; it is a single-user tool.

---

## Technology Stack

- **Platform**: Google Apps Script (JavaScript-based scripting environment built into Google Workspace)
- **Runtime**: V8 engine inside Google Apps Script — not Node.js, not a browser. Standard browser APIs and Node.js APIs do NOT exist here.
- **Deployment**: Bound to a specific Google Sheet (container-bound script). Accessed via Extensions > Apps Script inside the sheet.
- **APIs used**:
  - `SpreadsheetApp` — read/write Google Sheet data
  - `GmailApp` — read Gmail drafts, send emails
  - `Utilities.sleep()` — introduce delays between sends
  - `SpreadsheetApp.getUi()` — show dialogs and confirmation prompts to the user
- **File**: `assignmentEmailAutomation.js` — contains all logic in a single file.
- **Entry points**:
  - `onOpen()` — runs automatically when the sheet is opened; creates the custom menu.
  - `sendAssignmentEmails()` — main function; triggered manually by the teacher from the custom menu.

---

## Google Sheet Structure

The workbook contains at minimum two sheets: **Config** and **Students** (name configurable).

### Config Sheet

Named exactly `"Config"`. Contains key-value pairs read by the script:

| Row | Column A (Setting)  | Column B (Value)         |
|-----|---------------------|--------------------------|
| 1   | Setting             | Value                    |
| 2   | SHEET_NAME          | Students                 |
| 3   | ASSIGNMENT_COLUMN   | D                        |
| 4   | SEND_EMAILS         | true                     |
| 5   | SENDER_NAME         | Dr. John Smith           |

- **SHEET_NAME**: The name of the sheet tab containing student data.
- **ASSIGNMENT_COLUMN**: A single column letter (e.g., `D`, `E`, `F`) indicating which assignment to process in this run. Only one column is processed per run — there is no batch/multi-column mode.
- **SEND_EMAILS**: `true` sends real emails. `false` runs in test/simulation mode — no emails are sent, but the script logs what it would do. The sheet is also NOT updated in test mode.
- **SENDER_NAME**: Optional. If provided, this name appears as the sender's display name in the recipient's inbox. The actual sending address is always the Google account that owns/runs the script — this cannot be changed.

The script reads config from rows 2–10 of columns A and B. Rows beyond 10 are ignored.

### Students Sheet

Default name: `"Students"` (configurable via Config). Fixed column layout:

| Column | Index (0-based) | Content                          |
|--------|-----------------|----------------------------------|
| A      | 0               | Student email address            |
| B      | 1               | Student full name                |
| C      | 2               | Seat number                      |
| D+     | 3+              | Assignment status per assignment |

- **Row 1**: Header row. Column D onward contains assignment names. These names must exactly match Gmail draft subjects (case-sensitive).
- **Rows 2+**: One row per student.
- Assignment status values:
  - `false`, empty, or blank = email NOT yet sent → student will receive the email this run.
  - `true`, `"true"`, or `"TRUE"` = email already sent → student is skipped.
- After a successful send, the script writes `true` into the student's cell for that assignment column. This is how it tracks who has been sent what.

---

## Gmail Draft Requirements

- The teacher must **manually create a Gmail draft** before running the script.
- The **draft subject must exactly match the assignment column header** in row 1 of the Students sheet. This match is **case-sensitive** — `"Assignment 1"` and `"assignment 1"` are treated as different subjects.
- Only **one draft** with that subject may exist. If duplicates are found, the script aborts and asks the teacher to delete the extras.
- The draft body is HTML (Gmail stores it as HTML internally). The script reads the HTML body and processes it before sending.
- Attachments in the draft are supported and will be included in all sent emails.

---

## Placeholders (Personalization)

The script supports the following placeholders in both the **email body** and the **email subject**. They are replaced per student before sending. All placeholders are **case-insensitive** (regex flag `/gi`).

| Placeholder           | Replaced With                         |
|-----------------------|---------------------------------------|
| `{{Name}}`            | Student's name from column B          |
| `{{Seat}}`            | Student's seat number from column C   |
| `{{SeatNumber}}`      | Same as `{{Seat}}`                    |

- If a student's name is empty, it falls back to `"Student"`.
- If a student's seat is empty, it falls back to `"N/A"`.
- No other placeholders exist. Do not invent or suggest new ones unless asked.

---

## How the Script Executes (Step by Step)

1. Reads the Config sheet. Validates all required settings.
2. Reads the Students sheet. Validates it exists and has data.
3. Reads the assignment column header from row 1 of the specified column.
4. Searches all Gmail drafts for one whose subject matches the header (case-sensitive, exact string match).
5. Aborts if zero or more than one matching draft is found.
6. Reads the HTML body and attachments from the matched draft.
7. Converts all characters with Unicode code points above 255 to HTML entities (e.g., `🎓` → `&#127891;`). This prevents emoji rendering issues in sent emails.
8. Reads all student rows and filters to those where the assignment column is NOT `true`.
9. In **live mode** (`SEND_EMAILS = true`):
   - Shows a test reminder dialog asking if the teacher has tested with an alternate account first. If "No", aborts.
10. Shows a confirmation dialog listing the draft subject, number of recipients, and mode. If "No", aborts.
11. Iterates over each student to send:
    - Replaces placeholders in body and subject.
    - Calls `GmailApp.sendEmail()` with `htmlBody` and attachments.
    - Writes `true` to the student's assignment cell immediately after a successful send.
    - Waits a **random 2–6 second delay** between sends to avoid Gmail rate-limiting or spam flags. No delay after the last email.
    - If sending fails for a student, the error is caught, logged, and the student's cell is **NOT marked as true** — they will be retried on the next run.
12. Shows a completion summary: count of successes, failures, and any error messages (up to 5 shown in the dialog; full list in Apps Script logs).

In **test mode** (`SEND_EMAILS = false`):
- The confirmation dialog still shows but no test reminder is shown.
- No emails are sent.
- No cells are updated.
- The script logs `[TEST MODE] Would send to: <name> (<email>)` for each student.

---

## Error Handling Behavior

- **Per-student errors** are caught individually. A failure for one student does not stop the batch — the script continues to the next student.
- Failed students are **not marked as sent**. On the next run they will be included again automatically.
- Errors are logged to the Apps Script execution log (accessible via View > Executions in the Apps Script editor) and shown in the completion summary dialog.
- **Script-level errors** (missing config sheet, missing students sheet, missing draft, empty column, etc.) cause the script to abort early with a descriptive alert dialog.

---

## Sending Account

Emails are always sent from the **Google account that is running the script** — i.e., the teacher's Google account. This cannot be changed at the code level. `SENDER_NAME` only changes the display name shown to recipients, not the actual sending address.

---

## Triggering / Execution

- **Always manual**. There are no time-based triggers, no installable triggers, no event-driven automation.
- The teacher opens the Google Sheet, clicks **📧 Email Automation > Send Assignment Emails** from the menu bar.
- The `onOpen()` function creates this menu each time the sheet is opened.
- If the menu is missing, the teacher must open Apps Script editor, run the `onOpen()` function once manually, then reload the sheet.

---

## Typical Workflow for a New Assignment

1. Add a new column header in row 1 of the Students sheet (e.g., `"Assignment 3"`).
2. Leave all student cells in that column empty or `false`.
3. Create a Gmail draft with subject exactly matching that header.
4. Open Config sheet, set `ASSIGNMENT_COLUMN` to the new column letter (e.g., `"F"`).
5. Set `SEND_EMAILS` to `false`, run the script, verify logs.
6. Set `SEND_EMAILS` to `true`, run the script, confirm the dialogs.
7. For the next assignment, repeat from step 1 with a new column.

---

## Known Behaviors and Edge Cases

- **Emoji handling**: Gmail's Apps Script API returns emojis in the HTML body as raw Unicode. If sent as-is, they may render as garbled characters. The `convertEmojisToEntities()` function converts all characters above code point 255 to HTML entities before sending.
- **Test mode does not update the sheet**: In test mode, no cell is ever set to `true`. Running in test mode multiple times will always show the same students as pending.
- **Partial runs**: If the script is interrupted mid-run (e.g., Apps Script timeout), students who were already sent to will have `true` in their cells and won't be double-emailed. Students not yet reached will be picked up on the next run.
- **Gmail daily send limits**: Google accounts are limited to approximately 100 emails/day (personal) or up to 1,500/day (Google Workspace). Exceeding this quota causes `GmailApp.sendEmail()` to throw, which is caught per-student and logged.
- **Column letters beyond Z**: The `columnLetterToIndex()` helper supports multi-letter columns (e.g., `AA`, `AB`). This is not a limitation.
- **Empty email address**: If a row has a student name and seat number but no email address, the row is silently skipped — no email is sent, no error is thrown, and the assignment cell is never marked `true`. This is intentional behavior. The student will be skipped on every run until an email is added. There is no warning in the completion summary; the success count will simply be lower.

---

## Files in This Project

```
assignmentEmailAutomation.js   — All script logic (single file, copy into Apps Script editor)
README.md                      — Setup and usage guide for the teacher
AGENTS.md                      — This file. Full context for AI agents and developers.
```

---

## What AI Agents Should NOT Do

- Do not suggest adding time-based triggers or automation. The teacher wants manual control.
- Do not suggest multi-user access controls or sharing configurations. This is a single-user tool.
- Do not add new placeholders unless explicitly asked.
- Do not restructure the sheet layout or change fixed column assignments (A=email, B=name, C=seat) without being asked.
- Do not propose splitting the script into multiple files — it is intentionally a single file for easy copy-paste into Apps Script editor.
- Do not use Node.js, browser, or npm APIs. This runs exclusively in Google Apps Script.
