# Assignment Email Automation

Automated personalized email sending for assignments using Google Apps Script.

---

## Quick Reference (Daily Use)

> Already set up? Here's all you need each time you send a new assignment:

1. Add a new column in the Students sheet (e.g., column `F`) with the assignment name as the header in row 1
2. Make sure all student cells in that column are empty or `false`
3. Create a Gmail draft — subject must **exactly match** the column header (case-sensitive)
4. In the Config sheet, set `ASSIGNMENT_COLUMN` to that column letter (e.g., `F`)
5. Click **📧 Email Automation > Send Assignment Emails** in the menu bar
6. Confirm the dialogs — done. Students get marked `true` automatically.

For the next assignment, add another column and repeat.

---

## Sheet Structure

### Config Sheet

Create a sheet named **"Config"**:

```
     A                    B
1    Setting              Value
2    SHEET_NAME           Students
3    ASSIGNMENT_COLUMN    D
4    SEND_EMAILS          true
5    SENDER_NAME          Dr. John Smith
```

**Settings:**

- **SHEET_NAME**: Name of the sheet containing student data
- **ASSIGNMENT_COLUMN**: Which assignment column to process ("D", "E", "F", etc.) — one column per run
- **SEND_EMAILS**: `true` to send emails, `false` for test mode (no emails sent, sheet not updated)
- **SENDER_NAME**: (Optional) Name to display as sender in recipient inbox

### Students Sheet

```
     A              B           C         D              E              F
1    Email          Name        Seat      Assignment 1   Assignment 2   Midterm
2    john@edu       John Doe    101       true           true           false
3    jane@edu       Jane Smith  102       true           false          false
4    bob@edu        Bob Wilson  103       false          false          false
```

**Structure:**

- **Column A**: Student email addresses
- **Column B**: Student names
- **Column C**: Seat numbers
- **Column D+**: Assignment status (`true` = sent, `false` or empty = not sent)
- **Row 1**: Headers — assignment names must match Gmail draft subjects exactly (case-sensitive)

---

## Setup

### 1. Create Sheets

1. Create **"Config"** sheet with structure shown above
2. Create student data sheet (e.g., "Students") with Email, Name, Seat columns
3. Add assignment columns starting from column D

### 2. Add Script

1. Go to **Extensions > Apps Script**
2. Copy contents of `assignmentEmailAutomation.js` and paste
3. Save and name the project

### 3. Create Gmail Draft

1. In Gmail, compose email with formatting and emojis
2. Use placeholders (case-insensitive) — these work in both the **email body and the subject line**:
   - `{{Name}}` — Student's name
   - `{{Seat}}` or `{{SeatNumber}}` — Seat number
3. **Subject must exactly match the assignment column header (row 1) — case-sensitive**
4. Save as draft (do not send)

### 4. Grant Permissions

1. In Apps Script, select `onOpen` function and run
2. Accept permissions for Gmail and Spreadsheet access
3. Reload your Google Sheet
4. You'll see **📧 Email Automation** menu in the menu bar

### 5. Test and Run

1. Set `SEND_EMAILS` to `false` in Config sheet (cell B4)
2. Click **📧 Email Automation > Send Assignment Emails** from the menu bar
3. Check logs (**View > Executions**)
4. Set `SEND_EMAILS` to `true` and run to send
5. You'll be prompted to confirm you've tested with your alternate account first

---

## Usage

1. Set `ASSIGNMENT_COLUMN` in Config sheet to the column you want to process
2. Ensure the column header in row 1 matches the Gmail draft subject (exact, case-sensitive)
3. Click **📧 Email Automation > Send Assignment Emails** from the menu bar
4. If in live mode, confirm you've tested with alternate account
5. Confirm to proceed
6. Script sends to students with `false` or empty status and marks them as `true`

For next assignment, change `ASSIGNMENT_COLUMN` to next column and repeat.

---

## Troubleshooting

**Menu not showing**: Run `onOpen` function in Apps Script editor once, then reload the sheet

**Config sheet not found**: Create sheet named exactly "Config"

**Draft not found**: Gmail draft subject must exactly match column header in row 1 (case-sensitive)

**Multiple drafts found**: Delete duplicate drafts, keep only one

**Emojis display incorrectly**: Fixed automatically — use emojis normally in draft, don't type HTML codes

**Script quota exceeded**: Gmail limits ~100-500 emails/day depending on account type

---

**Note**: This script is designed for educational use. Ensure you comply with your institution's email policies and data privacy regulations.
