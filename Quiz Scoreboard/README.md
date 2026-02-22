# Quiz Scoreboard — Complete Reference

## Table of Contents

1. [What This Project Does](#1-what-this-project-does)
2. [The Big Picture — How Everything Connects](#2-the-big-picture--how-everything-connects)
3. [Key Concepts You Must Understand First](#3-key-concepts-you-must-understand-first)
4. [The Two Types of Google Spreadsheets](#4-the-two-types-of-google-spreadsheets)
5. [The Email Map — Format and Purpose](#5-the-email-map--format-and-purpose)
6. [Validation Rules — What Makes an Attempt Count](#6-validation-rules--what-makes-an-attempt-count)
7. [Scoring — How Points Are Calculated](#7-scoring--how-points-are-calculated)
8. [The Two Output Sheets](#8-the-two-output-sheets)
9. [Status Labels on the Scoreboard](#9-status-labels-on-the-scoreboard)
10. [Unknown Students — Who They Are and How They Are Handled](#10-unknown-students--who-they-are-and-how-they-are-handled)
11. [File Structure](#11-file-structure)
12. [File-by-File Reference](#12-file-by-file-reference)
13. [The CONFIG Object — Every Field Explained](#13-the-config-object--every-field-explained)
14. [How to Add a New Class](#14-how-to-add-a-new-class)
15. [How to Set Up the Automatic Trigger](#15-how-to-set-up-the-automatic-trigger)
16. [Rules for Anyone Modifying This Code](#16-rules-for-anyone-modifying-this-code)

---

## 1. What This Project Does

This is a **Google Apps Script** project. Google Apps Script is JavaScript code that runs inside Google's servers and can read and write Google Spreadsheets automatically.

The purpose of this project is to automatically grade and display quiz results for university students. The instructor assigns quizzes through Google Forms. Students submit their answers through those forms. This script reads all the submissions, applies validation rules, calculates scores, and writes a formatted scoreboard into a separate Google Spreadsheet for each class.

The script runs automatically every hour without any human involvement.

**The problem it solves:** When a teacher has dozens of students submitting quiz answers through Google Forms, the raw response data is just a long list of rows — one row per submission. It is impossible to quickly see who has completed how many quizzes, who is behind, or who is performing well. This script transforms that raw data into a clean, colour-coded scoreboard.

---

## 2. The Big Picture — How Everything Connects

Here is the complete flow, step by step:

```
Step 1: Students submit quiz answers through a Google Form
            ↓
Step 2: Each submission is automatically saved as a new row
        in the SOURCE spreadsheet (one tab per quiz)
            ↓
Step 3: This Google Apps Script runs every hour
        It reads all the rows from all quiz tabs
            ↓
Step 4: For each class, it reads the Email Map
        from that class's OUTPUT spreadsheet
        (the Email Map tells the script which email
        belongs to which student and which seat number)
            ↓
Step 5: The script validates every attempt
        (Was the score high enough? Was there enough time
        since the student's last valid attempt?)
            ↓
Step 6: The script calculates each student's total score
        for each quiz, and determines their status
            ↓
Step 7: The script writes two sheets into each class's
        OUTPUT spreadsheet:
          - "Quiz Result"         → the scoreboard
          - "Quiz Attempt Details" → the full audit log
```

---

## 3. Key Concepts You Must Understand First

Before reading anything else, make sure you understand these terms. They are used everywhere in this project.

### Attempt
One submission of a quiz by a student. Every time a student submits a Google Form, that is one attempt. A student can attempt the same quiz as many times as they want.

### Valid Attempt
An attempt that meets two conditions:
1. The score is at or above the minimum passing score (`minimumScore` in config).
2. Enough time has passed since the student's last valid attempt on the same quiz (`timeBetweenAttempts` in config).

Only valid attempts count toward a student's score. Attempts that fail either condition are recorded in the audit log but are not counted in the scoreboard.

### Required Attempts
The number of valid attempts a student must complete for a single quiz to be considered "done." This is `requiredAttempts` in the config. Currently set to 3.

### Quiz
One Google Form. Students can be assigned multiple quizzes (Quiz 1, Quiz 2, etc.). Each quiz is a separate Google Form, and all submissions for that quiz land on a separate tab (sheet) in the source spreadsheet.

### Class
A group of students who are taught together and whose results should appear on the same scoreboard. Each class has its own output Google Spreadsheet. Students from different classes all submit to the same Google Form, but their results are written to separate output spreadsheets.

### Email Map
A sheet inside a class's output spreadsheet that lists every student in that class — their email address, their full name, and their seat number. The script uses this to match a raw email address from a quiz submission to a student's name and seat number.

### Source Spreadsheet
The Google Spreadsheet where all quiz form responses are collected. This is the spreadsheet that the Apps Script is attached to and runs on. It is also called the "active spreadsheet" in the code.

### Output Spreadsheet
A separate Google Spreadsheet where the results for one class are written. Each class has its own output spreadsheet. The script opens each output spreadsheet by its ID (which is set in the config).

---

## 4. The Two Types of Google Spreadsheets

### The Source Spreadsheet (one, shared by all classes)

This is where the Google Form responses are stored. It looks like this:

| Tab name  | What it contains                                |
|-----------|-------------------------------------------------|
| Quiz 1    | All student submissions for Quiz 1              |
| Quiz 2    | All student submissions for Quiz 2              |
| Quiz 3    | All student submissions for Quiz 3              |
| ...       | One tab per quiz                                |

Each tab has this column structure (created automatically by Google Forms):

| Column A      | Column B       | Column C       | Column D onwards       |
|---------------|----------------|----------------|------------------------|
| Timestamp     | Email Address  | Score          | Individual question answers |

- **Column A (Timestamp):** The exact date and time the student submitted the form. Example: `1/29/2026 23:42:14`
- **Column B (Email Address):** The email address the student used when submitting.
- **Column C (Score):** The score Google Forms automatically calculated. The format is `X / 20` (for a 20-question quiz). The code extracts the number before the slash.

The script reads **only columns A, B, and C**. It ignores all other columns.

### The Output Spreadsheet (one per class)

This is a separate Google Spreadsheet created by the instructor for each class. The instructor must create this spreadsheet manually and share it with the Google account that runs the Apps Script.

After the script runs, this spreadsheet contains:

| Tab name              | What it contains                                        |
|-----------------------|---------------------------------------------------------|
| Email Map             | The student roster — email, name, seat number           |
| Quiz Result           | The scoreboard (written by this script)                 |
| Quiz Attempt Details  | Full audit log of every attempt (written by this script)|
| Attempt Report        | Attempt count summary (currently not in use)            |

The tab names above are the defaults. They can be changed in the config for each class.

---

## 5. The Email Map — Format and Purpose

The Email Map is a sheet tab inside each class's output spreadsheet. **The instructor fills this in manually.** The script reads it; it does not write to it.

**The Email Map must have this exact column order, with a header row:**

| Column A         | Column B      | Column C     | Column D              |
|------------------|---------------|--------------|-----------------------|
| Email Address    | Student Name  | Seat Number  | Class Name            |
| a94@gmail.com    | ARIBA KHAN    | T4-007       | BEd 4 Year Semester 1 |
| abs@gmail.com    | ABSAR GUL     | T4-001       | BEd 4 Year Semester 1 |

Important rules for the Email Map:
- The **first row is a header row** and is automatically skipped by the script.
- The email in Column A must match exactly the email the student uses when submitting the Google Form. Capitalisation matters — `Student@gmail.com` and `student@gmail.com` are treated as different emails.
- Every student who should appear on the scoreboard **must** be listed in the Email Map. Students who submit quizzes with an email address not in the Email Map are treated as "Unknown" (see Section 10).
- Students who have not submitted any quiz attempts can still be listed in the Email Map. They will appear on the scoreboard with a score of zero.

---

## 6. Validation Rules — What Makes an Attempt Count

When the script reads a quiz submission, it applies two rules to decide whether that attempt is valid:

### Rule 1 — Minimum Score

The score must be at or above `minimumScore` (currently 16 out of 20).

- If the score is 16, 17, 18, 19, or 20 → the attempt **passes** this rule.
- If the score is 0 through 15 → the attempt **fails**. It is recorded in the audit log with the reason `"Score below minimum"` but does not count toward the student's score.

### Rule 2 — Time Between Valid Attempts

If the attempt passes Rule 1, the script then checks how much time has passed since the student's **last valid attempt** on the same quiz.

- The minimum required gap is `timeBetweenAttempts` (currently 4 days, stored as milliseconds: `4 * 24 * 60 * 60 * 1000`).
- If the time gap is 4 days or more → the attempt is **valid**.
- If the time gap is less than 4 days → the attempt **fails**. It is recorded in the audit log with the reason `"Valid attempt too soon after previous valid attempt"` but does not count toward the student's score.

**Important detail:** Rule 2 only compares the current attempt against the student's last **valid** attempt, not their last attempt of any kind. A student who fails an attempt due to low score does not reset the timer.

### What happens after 3 valid attempts

Once a student has 3 valid attempts on a quiz (or whatever number `requiredAttempts` is set to), any further valid attempts are recorded in the audit log but are **not counted** toward their score. The score calculation only takes the first `requiredAttempts` valid attempts.

---

## 7. Scoring — How Points Are Calculated

After validation, scores are calculated as follows:

**Per quiz:**
- Take all of the student's valid attempts on that quiz.
- Sort them by score from highest to lowest.
- Take only the top `requiredAttempts` (currently 3) scores.
- Add those scores together.
- Maximum possible score per quiz = `maximumScore × requiredAttempts` = 20 × 3 = **60**.

**Total score:**
- Add up the per-quiz scores across all quizzes.
- Maximum possible total = 60 × number of quizzes. For 6 quizzes, that is 360.

**Example:**
A student has these valid attempts on Quiz 3: 16, 17, 18, 19, 20, 20 (six valid attempts).
- All six pass the validation rules.
- Sorted highest first: 20, 20, 19, 18, 17, 16.
- Only the top three are used: 20, 20, 19.
- Their Quiz 3 score = 59 / 60.
- The remaining valid attempts (18, 17, 16) are ignored for scoring but still appear in the audit log.

---

## 8. The Two Output Sheets

### Sheet 1 — Quiz Result (the Scoreboard)

This is the main output. It contains one row per registered student. The columns are:

| Col 1 | Col 2 | Col 3  | Col 4 | Col 5   | Col 6   | ... |
|-------|-------|--------|-------|---------|---------|-----|
| Name  | Seat  | Status | Total | Quiz 1  | Quiz 2  | ... |

- **Name:** The student's full name from the Email Map.
- **Seat:** The student's seat number from the Email Map.
- **Status:** A word or phrase summarising the student's overall progress (see Section 9).
- **Total:** The sum of all quiz scores. Displayed as `X / 360` (where 360 assumes 6 quizzes at 60 points each — the denominator is calculated dynamically based on the actual number of quizzes).
- **Quiz columns:** One column per quiz, sorted in natural order (Quiz 1, Quiz 2, ..., Quiz 10, not Quiz 1, Quiz 10, Quiz 2). Each cell shows `X / 60`. Cells are colour-coded:
  - **Green** background: the student has completed all required valid attempts for that quiz (score ≥ `minimumScore × requiredAttempts`).
  - **Yellow** background: the student has at least one valid attempt but has not yet completed all required attempts.
  - **No colour (white):** the student has no valid attempts for that quiz.

The sheet is sorted by Total score in descending order (highest first). A timestamp row is inserted at the very top showing when the script last ran and how long ago that was.

**Only registered students appear on this scoreboard.** Students who submitted with an unknown email are deliberately excluded (see Section 10).

### Sheet 2 — Quiz Attempt Details (the Audit Log)

This sheet contains one row per attempt — every single submission by every student, valid or not. It exists so the instructor can investigate disputes, see why an attempt was marked invalid, and track the timeline of submissions.

The columns are:

| Col | Header                 | Contents                                                                 |
|-----|------------------------|--------------------------------------------------------------------------|
| 1   | Student ID             | The student's seat number, or `"Unknown"` if not in the Email Map        |
| 2   | Student Name           | The student's full name, or `"Unknown"` if not in the Email Map          |
| 3   | Email                  | The email address used for the submission                                |
| 4   | Quiz Name              | The name of the quiz tab in the source spreadsheet                       |
| 5   | Timestamp              | Date and time of the submission, formatted as `ddd, yyyy-mm-dd hh:mm:ss` |
| 6   | Score                  | The raw score on that attempt (a number)                                 |
| 7   | Valid                  | `"Yes"` if the attempt counts, `"No"` if it does not                    |
| 8   | Reason                 | If invalid, the reason (e.g. `"Score below minimum"`)                   |
| 9   | Last Attempt           | Timestamp of the student's previous attempt on this same quiz            |
| 10  | Time Since Last Attempt| A formula that calculates the gap: e.g. `"12 days, 7 hours, 44 min"`   |

**Unknown students do appear in this sheet.** This is intentional — the instructor needs to see which unregistered emails are submitting quizzes so they can identify and follow up with those students. Unknown students appear in the audit log of **every class**, not just one.

---

## 9. Status Labels on the Scoreboard

Each student on the scoreboard gets one of the following status labels in the Status column. The label is determined by looking at each quiz and classifying it as one of three states:

- **maxAttempt** (complete): the student's score for this quiz is ≥ `minimumScore × requiredAttempts` (i.e., they finished all required valid attempts)
- **mediumAttempt** (in progress): the student has at least one valid attempt but has not yet reached the full required score
- **zeroAttempt** (not started): the student's score for this quiz is below the minimum (no valid attempts counted)

| Status label          | Condition                                                                                  | Colour           |
|-----------------------|--------------------------------------------------------------------------------------------|------------------|
| **Perfect**           | All quizzes are "complete" (`maxAttempt === number of quizzes`)                            | Green            |
| **Almost there**      | All quizzes have at least one valid attempt, but not all are fully complete                | Purple (#C39BD3) |
| **Attempt all quizzes** | Mix of complete, in-progress, and not-started; at least as many done as not done          | Orange (#F8C471) |
| **Put in more efforts** | Mix of complete, in-progress, and not-started; more not-started than done                 | Yellow           |
| 🤡                    | Zero valid attempts on every single quiz                                                   | Light red        |

---

## 10. Unknown Students — Who They Are and How They Are Handled

An **unknown student** is someone who submitted a quiz using an email address that does not appear in **any** class's Email Map.

This situation arises when a student submits a quiz before the instructor has added their email to the Email Map, or when a student uses a personal email instead of the registered one.

**How the script handles unknowns:**

- Unknown students are assigned `studentId = "Unknown"` and `studentName = "Unknown"` in all records.
- Unknown students **do not appear on any class's scoreboard** (Quiz Result sheet). This is deliberate — the instructor wants students to register their emails to appear on the scoreboard.
- Unknown students **do appear in the Quiz Attempt Details sheet of every class**. This means when the instructor reviews the audit log for any class, they can see all unregistered submissions and identify which students need to register.

**A student is only treated as "unknown" if their email is absent from all class Email Maps combined.** If a student's email is in Class A's Email Map but not in Class B's Email Map, they are a known student for Class A and an unknown student that does not appear at all in Class B's logs. Only someone present in no map whatsoever gets the "Unknown" label.

---

## 11. File Structure

All files are in a single flat folder. There are no subfolders. Google Apps Script treats all `.js` files in the same project as one shared global scope — functions defined in any file can be called from any other file.

```
Quiz Scoreboard/
├── config.js   ← The only file you need to edit for configuration
├── main.js     ← Entry point; orchestrates everything
└── lib.js      ← All data processing and sheet-writing functions
```

**The only file you should edit for day-to-day management is `config.js`.** You should never need to touch the other files unless you are changing how the script works.

---

## 12. File-by-File Reference

### `config.js`

Contains the single `CONFIG` object. This is the control panel for the entire project. Everything that might need to change — scoring thresholds, spreadsheet IDs, sheet names — lives here.

See Section 13 for a complete explanation of every field.

---

### `main.js`

This is the entry point. Google Apps Script calls the `main()` function when the trigger fires (every hour).

**`main()` — the orchestration function**

Runs the entire pipeline in this order:

1. Gets all sheet tabs from the source (active) spreadsheet.
2. Loads the Email Map for each class from its output spreadsheet.
3. Builds a merged Email Map (all classes combined) to use for identifying truly unknown emails.
4. Builds a set of output sheet names (like "Quiz Result", "Quiz Attempt Details") so the script knows not to treat those tabs as quiz attempt data.
5. Reads the raw data from every quiz tab once and stores it in memory.
6. Scans all the raw data to find email addresses that do not appear in any class's Email Map — these are the unknown students.
7. Loops over each class and:
   a. Resolves the effective settings for that class (merging class-specific overrides with global defaults).
   b. Runs `processSheetData` for each quiz tab using that class's Email Map and settings.
   c. Filters the data down to only that class's registered students (for the scoreboard).
   d. Filters the data to that class's students plus all unknown emails (for the audit log).
   e. Calls `writeDetailedResultToSheets` to write the audit log.
   f. Calls `writeResultToSheets` to write the scoreboard.

**`resolveSettings(cls)`**

Takes a class config object and returns a settings object with four keys: `minimumScore`, `maximumScore`, `requiredAttempts`, `timeBetweenAttempts`. If the class defines its own value for any of these, that value is used. Otherwise, the global value from `CONFIG` is used. This implements the "class-specific overrides global" rule.

**`filterData(compiledResult, emailPredicate)`**

A utility function. Takes the full compiled result object (keyed by quiz name, then by email) and a test function. Returns a copy of the object containing only the emails for which the test function returns true. Used twice per class: once to get only that class's registered students (for the scoreboard), and once to get registered students plus unknowns (for the audit log).

---

### `lib.js`

Contains all data processing logic, shared utility functions, and sheet-writing functions.

**`processSheetData(data, quizName, emailMap, settings)`**

Takes the raw array of rows from one quiz tab and processes every submission.

- Parameters:
  - `data`: the full 2D array of values from the sheet (first row is the header)
  - `quizName`: the name of the sheet tab, used as the quiz identifier in the output
  - `emailMap`: the Email Map for the current class (used to look up name and seat number)
  - `settings`: the resolved settings object for the current class
- Before iterating, the data rows (everything after the header) are sorted by timestamp in ascending order. This guarantees the time-gap rule is applied correctly even if rows in the source sheet were inserted, edited, or re-sorted manually.
- For each row, it reads the timestamp (column 0), email (column 1), and score (column 2). If the score cell is empty or contains a non-numeric value, the attempt is logged to the execution log and recorded in the audit log as invalid with the reason `"Score missing or malformed"`.
- It looks up the email in the Email Map to get the student's name and seat number. If the email is not found, it uses `"Unknown"`.
- It applies both validation rules (minimum score, time between valid attempts).
- Returns an object keyed by email address, where each value is an array of attempt objects. Each attempt object contains: `studentId`, `studentName`, `email`, `quizName`, `timestamp`, `score`, `isValid`, `reason`.

**`transformData(originalData, settings)`**

Takes the compiled result from `processSheetData` (structured as `{quizName: {email: [attempts]}}`) and transforms it into a simpler structure ready for the scoreboard (`{email: {quizName: totalScore}}`).

- For each student and each quiz, it filters their attempts to only the valid ones, sorts those scores from highest to lowest, takes only the top `requiredAttempts` of those, and sums them.
- It also ensures that every student has an entry for every quiz — students with no attempts on a quiz get a score of 0 for that quiz.

**`sheetDataToJson(sheetId, sheetName)`**

Opens a Google Spreadsheet by its ID, reads the named sheet tab, and converts the Email Map data into a JavaScript object keyed by email address. Each value is an object with `name`, `seat`, `class`, and `email` properties. The header row is stripped. Rows are sorted alphabetically by name before being returned (though the script does not depend on this order).

**`naturalSort(a, b)`**

A comparator function for sorting strings that contain numbers in a human-friendly order. Without this, "Quiz 10" would sort before "Quiz 2" because `"1"` comes before `"2"` alphabetically. With natural sort, Quiz 1, Quiz 2, ..., Quiz 9, Quiz 10 appear in the correct order. This function is shared across the entire project — it is defined once here and used anywhere sorting is needed.

**`ensureColumns(sheet, columnIndex, numColumns)`**

A utility that ensures a Google Sheet has enough columns to accommodate the data being written. If the sheet does not have enough columns, it inserts the required number. Returns the range object starting at `columnIndex` for `numColumns` columns in row 1. This is used when writing quiz column headers to make sure the sheet is wide enough.

---

**`writeResultToSheets(data, studentMap, outputSpreadsheetId, outputSheetName, settings, quizNames)`**

Writes the scoreboard to the Quiz Result tab of a class's output spreadsheet.

- Parameters:
  - `data`: the transformed data from `transformData` — `{email: {quizName: totalScore}}`
  - `studentMap`: the class's Email Map — `{email: {name, seat, class, email}}`
  - `outputSpreadsheetId`: the Google Spreadsheet ID to write to
  - `outputSheetName`: the name of the tab to write to (created if it does not exist)
  - `settings`: the resolved settings for this class
  - `quizNames`: the list of quiz names from the source sheet tabs (passed from `main`)

What it does, in order:
1. Opens the output spreadsheet and clears the target sheet.
2. Writes and formats the header row: Name, Seat, Status, Total, then one column per quiz. Quiz names come from the `quizNames` parameter (the source sheet tabs), not from the attempt data, so quizzes with zero attempts still appear as columns.
3. Builds all student rows in memory — values, background colours, and number formats — without making any sheet API calls per cell.
4. Writes all rows to the sheet in three batched calls: one for values, one for backgrounds, one for number formats. This is significantly faster than writing cell-by-cell, especially for large classes.
5. Sorts all rows by the Total column in descending order.
6. Auto-resizes the first four columns (Name, Seat, Status, Total) for readability.
7. Inserts a timestamp row at the very top showing when the result was calculated.
8. Freezes the top two rows (timestamp row + header row) so both stay visible when scrolling.

---

**`writeDetailedResultToSheets(data, outputSpreadsheetId, outputSheetName)`**

Writes the full audit log to the Quiz Attempt Details tab of a class's output spreadsheet.

- Parameters:
  - `data`: the filtered compiled result — `{quizName: {email: [attempts]}}` — containing only this class's registered students and all unknown students
  - `outputSpreadsheetId`: the Google Spreadsheet ID to write to
  - `outputSheetName`: the name of the tab to write to (created if it does not exist)

What it does:
1. Clears the target sheet and writes the 10-column header row.
2. Iterates over every quiz and every student within that quiz.
3. For each student's attempts on a quiz, sorts them chronologically (earliest first).
4. Writes one row per attempt, including the timestamp of the previous attempt in that same quiz (so the reader can see the gap).
5. In the "Time Since Last Attempt" column (column 10), it writes a Google Sheets formula that calculates the gap between the current attempt and the previous one, and formats it as "X days, Y hours, Z min". This is a live formula, not a static value, so it stays accurate as time passes.
6. Applies date formatting to the Timestamp and Last Attempt columns.
7. Sets all column widths to 150 pixels.

---

The following two functions are also in `lib.js`. Their output is **currently disabled** — the call to `writeAttemptsSummaryToSheet` is commented out in `main.js`. The code is kept for future use.

**`transformDataForAttempts(originalData)`**

Similar to `transformData` in `lib.js`, but instead of summing scores, it counts attempts. For each student and each quiz, it returns `{total: number, valid: number}` — the total number of attempts and the number of valid attempts.

**`writeAttemptsSummaryToSheet(data, studentMap, outputSpreadsheetId, outputSheetName, settings)`**

Writes an attempt count summary sheet. Similar in layout to the scoreboard, but each quiz cell shows the total number of attempts (not the score), with the number of valid attempts shown as the denominator (e.g., `5 / 3` means the student made 5 attempts total, of which 3 were valid). Cells are colour-coded green if the student has reached `requiredAttempts` valid attempts, yellow if they have more than 1 but fewer than required, and white otherwise.

---

## 13. The CONFIG Object — Every Field Explained

The `CONFIG` object in `config.js` is the only thing that needs to change when you are managing classes or adjusting rules. Here is every field:

### Global settings (apply to all classes by default)

| Field                | Type    | Current value              | What it means                                                                                                     |
|----------------------|---------|----------------------------|-------------------------------------------------------------------------------------------------------------------|
| `minimumScore`       | Number  | `16`                       | The minimum score a student must get on a single attempt for that attempt to be counted as valid. Out of `maximumScore`. |
| `maximumScore`       | Number  | `20`                       | The highest possible score on a single attempt. This is the total number of questions on the quiz.               |
| `requiredAttempts`   | Number  | `3`                        | How many valid attempts a student must complete for a quiz to be considered fully done.                           |
| `timeBetweenAttempts`| Number  | `4 * 24 * 60 * 60 * 1000`  | The minimum number of milliseconds that must pass between two valid attempts. Currently 4 days. If you want 3 days, change the `4` to `3`. |

### `classes` array

An array where each entry represents one class. You can have as many entries as you need. Each entry has these fields:

| Field                    | Type   | What it means                                                                                                                                                    |
|--------------------------|--------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `name`                   | String | A human-readable label for the class. Appears in execution logs. Not used for any data lookup. Can be anything you find descriptive.                             |
| `outputSpreadsheetId`    | String | The ID of this class's output Google Spreadsheet. Found in the spreadsheet's URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit`              |
| `mapSheetName`           | String | The exact name of the tab inside the output spreadsheet that contains the Email Map. Must match the tab name character-for-character, including capitalisation.   |
| `quizResultSheetName`    | String | The exact name of the tab where the scoreboard will be written. If the tab does not exist, the script creates it automatically.                                  |
| `attemptDetailsSheetName`| String | The exact name of the tab where the audit log will be written. Created automatically if it does not exist.                                                       |
| `attemptCountSheetName`  | String | The exact name of the tab for the attempt count summary. Currently not in use, but must still be present in the config.                                          |

### Per-class overrides (optional)

Any of the four global settings (`minimumScore`, `maximumScore`, `requiredAttempts`, `timeBetweenAttempts`) can be added directly inside a class entry to override the global value for that class only.

Example: if Class B has a different minimum passing score:
```javascript
{
  name: "BEd 2 Year",
  outputSpreadsheetId: "...",
  mapSheetName: "Email Map",
  quizResultSheetName: "Quiz Result",
  attemptDetailsSheetName: "Quiz Attempt Details",
  attemptCountSheetName: "Attempt Report",
  minimumScore: 14,   // ← overrides the global 16 for this class only
}
```

If a class does not define an override for a setting, the global value is used automatically.

---

## 14. How to Add a New Class

Adding a new class requires changes in one place only: `config.js`. No other file needs to be touched.

**Step 1: Create the output spreadsheet**

Create a new Google Spreadsheet for the new class. Give it a descriptive name (e.g., "BEd 2 Year — Quiz Scoreboard"). Copy its ID from the URL.

**Step 2: Create the Email Map tab**

Inside the new spreadsheet, create a tab. The default expected name is `"Email Map"`. Add a header row with four columns: `Email`, `Name`, `Seat Number`, `Class`. Then fill in one row per student with their email address, full name, seat number, and class label.

**Step 3: Share the spreadsheet with the script's Google account**

The Google account that owns the Apps Script (the account under which the script runs) must have Editor access to the new output spreadsheet. Without this, the script will fail silently when it tries to open the spreadsheet.

**Step 4: Edit `config.js`**

Find the commented-out template block near the bottom of the `classes` array in `config.js`. Copy it, uncomment it, and fill in the values:

```javascript
{
  name: "BEd 2 Year",
  outputSpreadsheetId: "PASTE_SPREADSHEET_ID_HERE",
  mapSheetName: "Email Map",
  quizResultSheetName: "Quiz Result",
  attemptDetailsSheetName: "Quiz Attempt Details",
  attemptCountSheetName: "Attempt Report",
},
```

Save the file. The next time the script runs (within the hour), it will process the new class automatically.

---

## 15. How to Set Up the Automatic Trigger

The script is designed to run automatically every hour. This is set up through Google Apps Script's built-in trigger system. If the trigger is missing or was deleted, here is how to recreate it:

1. Open the source spreadsheet (the one where quiz form responses are collected).
2. In the menu bar, click **Extensions → Apps Script**.
3. In the Apps Script editor, click the clock icon in the left sidebar (Triggers).
4. Click **+ Add Trigger** in the bottom-right corner.
5. Set the following options:
   - **Choose which function to run:** `main`
   - **Choose which deployment should run:** Head
   - **Select event source:** Time-driven
   - **Select type of time based trigger:** Hour timer
   - **Select hour interval:** Every hour
6. Click **Save**.

The script will now run every hour automatically.

---

## 16. Rules for Anyone Modifying This Code

This section is specifically for AI agents or developers who may be asked to make changes to this project in the future.

### What you are allowed to change freely

- **`config.js`** — this file is designed to be edited. Adding, removing, or modifying class entries is the primary way of managing the project.

### What you must be careful about

- **Function signatures** — several functions pass a `settings` object as their last parameter (`processSheetData`, `transformData`, `writeResultToSheets`, `writeAttemptsSummaryToSheet`). If you add a new function that needs the four scoring settings, it must also receive the `settings` object as a parameter. It must **not** read from `CONFIG` directly, because `CONFIG` only holds the global defaults — the actual effective value for a class may be different.

- **`CONFIG` references** — the only place `CONFIG` should be read directly is inside `resolveSettings()` in `main.js` (where it provides the fallback values) and when reading `CONFIG.classes` (to loop over classes). Any other direct reference to `CONFIG.minimumScore`, `CONFIG.maximumScore`, `CONFIG.requiredAttempts`, or `CONFIG.timeBetweenAttempts` in any other file is a bug — those files must use the `settings` parameter instead.

- **`naturalSort`** — this function is defined exactly once, in `lib.js`. Do not define it again in any other file. Since Google Apps Script shares all files in one global scope, a second definition would be a duplicate.

- **The Email Map is not written by the code** — the script only reads the Email Map, never writes to it. Do not add any code that writes to the Email Map tab.

- **The source spreadsheet is not written to** — the script only reads from the source spreadsheet (the one with quiz responses). All output goes to the separate output spreadsheets defined in `config.js`. Do not add any code that writes back to the source spreadsheet.

- **Unknown students and the scoreboard** — unknown students must not appear on the Quiz Result scoreboard. They must appear in the Quiz Attempt Details audit log of every class. Do not change this behaviour without explicit instruction.

- **Per-class processing** — the script runs `processSheetData` once per class (not once globally). This is intentional: it allows each class to have different validation settings. Do not merge this back into a single global processing pass unless you are certain that all classes will always share the same settings.

### Do not change without explicit instruction

- The colour codes used for cell backgrounds (`#90ee90` for green, `#ffff99` for yellow, etc.)
- The status label strings ("Perfect", "Almost there", etc.)
- The column order in the output sheets
- The timestamp format in the audit log (`ddd, yyyy-mm-dd hh:mm:ss`)
- The `timeBetweenAttempts` logic — specifically, the fact that the timer checks against the last **valid** attempt, not the last attempt of any kind
