# Test Cases — Quiz Scoreboard

This document describes how to set up and run the test, and exactly what to verify
in the output after the script runs. Read this fully before starting.

---

## Setup Instructions

### Step 1 — Create the test source spreadsheet

1. Create a new Google Spreadsheet. Call it something like "Quiz Scoreboard TEST — Source".
2. Create two sheet tabs inside it. Name them exactly:
   - `Quiz 1`
   - `Quiz 2`
3. Import `test-quiz-1-attempts.csv` into the `Quiz 1` tab.
4. Import `test-quiz-2-attempts.csv` into the `Quiz 2` tab.
5. Attach the Apps Script project to this spreadsheet (or copy the script files into it).

### Step 2 — Create the test output spreadsheet

1. Create a second new Google Spreadsheet. Call it "Quiz Scoreboard TEST — Output".
2. Create one sheet tab inside it. Name it exactly: `Email Map`
3. Import `test-email-map.csv` into the `Email Map` tab.
4. Copy the spreadsheet ID from the URL (the long string between `/d/` and `/edit`).

### Step 3 — Configure the script

Open `config.js` and add a test class entry (or temporarily replace the existing one):

```javascript
{
  name: "Test Class",
  outputSpreadsheetId: "PASTE_YOUR_TEST_OUTPUT_SPREADSHEET_ID_HERE",
  mapSheetName: "Email Map",
  quizResultSheetName: "Quiz Result",
  attemptDetailsSheetName: "Quiz Attempt Details",
  attemptCountSheetName: "Attempt Report",
}
```

### Step 4 — Run the script

Open the Apps Script editor, select the `main` function, and click Run.
Check the execution log for any errors.

### Step 5 — Verify the output

Open the test output spreadsheet and check the `Quiz Result` tab and the
`Quiz Attempt Details` tab against the expected results described below.

---

## Test Data Overview

### Students (Email Map)

| Seat  | Name         | Email              | Purpose                                    |
|-------|--------------|--------------------|---------------------------------------------|
| TA-001 | TEST ALPHA  | alpha@test.com     | TC-001: Perfect student, 3 valid attempts  |
| TA-002 | TEST BETA   | beta@test.com      | TC-002: One attempt is too soon            |
| TA-003 | TEST GAMMA  | gamma@test.com     | TC-003: Score exactly at minimum (16)      |
| TA-004 | TEST DELTA  | delta@test.com     | TC-004: All scores below minimum           |
| TA-005 | TEST EPSILON| epsilon@test.com   | TC-005: 6 valid attempts, highest 3 used   |
| —     | —            | unknown@test.com   | TC-006: Email not in Email Map             |

### Quiz 1 — All attempts

| Timestamp        | Email             | Score | Expected result                                        |
|------------------|-------------------|-------|--------------------------------------------------------|
| 1/1/2026 10:00   | alpha@test.com    | 18    | Valid (score ≥ 16, first attempt)                      |
| 1/1/2026 10:00   | beta@test.com     | 17    | Valid (score ≥ 16, first attempt)                      |
| 1/1/2026 10:00   | gamma@test.com    | 16    | Valid (score = exactly 16 = minimum — must be Valid)   |
| 1/1/2026 10:00   | delta@test.com    | 15    | **Invalid** (score 15 < minimum 16)                   |
| 1/1/2026 10:00   | epsilon@test.com  | 16    | Valid                                                  |
| 1/1/2026 10:00   | unknown@test.com  | 18    | Valid score, but email not in Email Map                |
| 1/3/2026 10:00   | beta@test.com     | 18    | **Invalid** (only 2 days since beta's last valid on 1/1 — minimum is 4 days) |
| 1/6/2026 10:00   | alpha@test.com    | 19    | Valid (5 days since last valid on 1/1)                 |
| 1/6/2026 10:00   | epsilon@test.com  | 17    | Valid (5 days since last valid on 1/1)                 |
| 1/8/2026 10:00   | beta@test.com     | 19    | Valid (7 days since beta's last valid on 1/1 — the 1/3 attempt was invalid so the clock runs from 1/1) |
| 1/11/2026 10:00  | alpha@test.com    | 20    | Valid (5 days since last valid on 1/6)                 |
| 1/11/2026 10:00  | epsilon@test.com  | 18    | Valid (5 days since last valid on 1/6)                 |
| 1/16/2026 10:00  | epsilon@test.com  | 19    | Valid (5 days since last valid on 1/11)                |
| 1/21/2026 10:00  | epsilon@test.com  | 20    | Valid (5 days since last valid on 1/16)                |
| 1/26/2026 10:00  | epsilon@test.com  | 20    | Valid (5 days since last valid on 1/21)                |

### Quiz 2 — All attempts

| Timestamp        | Email           | Score | Expected result                          |
|------------------|-----------------|-------|------------------------------------------|
| 1/1/2026 10:00   | alpha@test.com  | 20    | Valid                                    |
| 1/1/2026 10:00   | delta@test.com  | 14    | **Invalid** (score 14 < minimum 16)     |
| 1/6/2026 10:00   | alpha@test.com  | 20    | Valid (5 days since last valid on 1/1)   |
| 1/11/2026 10:00  | alpha@test.com  | 20    | Valid (5 days since last valid on 1/6)   |

---

## TC-001 — Perfect student (TEST ALPHA)

**What this tests:** A student who completes every quiz correctly with 3 valid
attempts, each spaced more than 4 days apart.

**Quiz 1 valid attempts:** scores 18, 19, 20
**Quiz 2 valid attempts:** scores 20, 20, 20

**Score calculation (highest 3):**
- Quiz 1: top 3 of [18, 19, 20] = 20 + 19 + 18 = **57**
- Quiz 2: top 3 of [20, 20, 20] = 20 + 20 + 20 = **60**
- Total: 57 + 60 = **117**

**What to verify in Quiz Result:**
- Name: `TEST ALPHA`, Seat: `TA-001`
- Status: `Perfect`
- Total: `117 / 120`
- Quiz 1 column: `57 / 60` with **green** background
- Quiz 2 column: `60 / 60` with **green** background

**What to verify in Quiz Attempt Details:**
- 3 rows for ALPHA on Quiz 1, all showing `Valid = Yes`
- 3 rows for ALPHA on Quiz 2, all showing `Valid = Yes`
- No row showing `Valid = No` for ALPHA

---

## TC-002 — Attempt too soon (TEST BETA)

**What this tests:** A student whose second attempt on a quiz comes within 4 days
of their first valid attempt. That second attempt must be marked invalid, and the
clock for the gap check must run from the previous **valid** attempt — not from
the invalid one.

**Quiz 1 attempts:**
- 1/1: score 17 → **Valid** (first attempt)
- 1/3: score 18 → **Invalid** (only 2 days after the valid attempt on 1/1)
- 1/8: score 19 → **Valid** (7 days after the last valid attempt on 1/1;
  the invalid attempt on 1/3 does not reset the clock)

**Score calculation (highest 3):**
- Quiz 1: only 2 valid attempts [17, 19] → top 2 = 19 + 17 = **36**
  (only 2 valid, needs 3 to be complete)
- Quiz 2: no attempts → **0**
- Total: **36**

**What to verify in Quiz Result:**
- Name: `TEST BETA`, Seat: `TA-002`
- Status: `Attempt all quizzes`
- Total: `36 / 120`
- Quiz 1 column: `36 / 60` with **yellow** background (in progress, not complete)
- Quiz 2 column: `0 / 60` with no background colour

**What to verify in Quiz Attempt Details:**
- Row for 1/3 attempt: `Valid = No`, Reason = `Valid attempt too soon after previous valid attempt`
- Row for 1/1 attempt: `Valid = Yes`
- Row for 1/8 attempt: `Valid = Yes`
- The "Last Attempt" column for the 1/8 row shows `1/3/2026` (the immediately preceding attempt,
  even though that attempt was invalid)

---

## TC-003 — Score exactly at minimum (TEST GAMMA)

**What this tests:** A score of exactly 16 (the `minimumScore` value) must be
treated as **valid**. The rule is `score >= minimumScore` (greater than or equal),
so 16 passes.

**Quiz 1 attempts:**
- 1/1: score 16 → **Valid** (16 ≥ 16)

**Quiz 2 attempts:** none

**Score calculation:**
- Quiz 1: 1 valid attempt [16] → top 1 = **16**
- Quiz 2: no attempts → **0**
- Total: **16**

**What to verify in Quiz Result:**
- Name: `TEST GAMMA`, Seat: `TA-003`
- Status: `Attempt all quizzes`
- Total: `16 / 120`
- Quiz 1 column: `16 / 60` with **yellow** background
- Quiz 2 column: `0 / 60` with no background colour

**What to verify in Quiz Attempt Details:**
- Row for the 1/1 attempt: `Valid = Yes`, `Reason` column is empty

---

## TC-004 — All scores below minimum (TEST DELTA)

**What this tests:** A student who never reaches the minimum score on any quiz.
All their attempts must be marked invalid. They must appear on the scoreboard
with zero and the 🤡 status, but both invalid attempts must still appear in the
audit log.

**Quiz 1 attempts:**
- 1/1: score 15 → **Invalid** (15 < 16)

**Quiz 2 attempts:**
- 1/1: score 14 → **Invalid** (14 < 16)

**Score calculation:**
- Quiz 1: 0 valid attempts → **0**
- Quiz 2: 0 valid attempts → **0**
- Total: **0**

**What to verify in Quiz Result:**
- Name: `TEST DELTA`, Seat: `TA-004`
- Status: `🤡`
- Total: `0 / 120`
- Quiz 1 column: `0 / 60` with no background colour
- Quiz 2 column: `0 / 60` with no background colour

**What to verify in Quiz Attempt Details:**
- Row for Quiz 1, 1/1 attempt: `Valid = No`, `Reason = Score below minimum`
- Row for Quiz 2, 1/1 attempt: `Valid = No`, `Reason = Score below minimum`

---

## TC-005 — 6 valid attempts, highest 3 used (TEST EPSILON)

**What this tests:** When a student has more valid attempts than `requiredAttempts`,
the script must use the **highest** scoring valid attempts, not the chronologically
first ones. This is the key behavioural difference from an older version of the code.

**Quiz 1 attempts (all valid, all 5+ days apart):**

| Date     | Score | Valid |
|----------|-------|-------|
| 1/1/2026  | 16    | Yes   |
| 1/6/2026  | 17    | Yes   |
| 1/11/2026 | 18    | Yes   |
| 1/16/2026 | 19    | Yes   |
| 1/21/2026 | 20    | Yes   |
| 1/26/2026 | 20    | Yes   |

**Score calculation:**
- All 6 valid. Sorted highest first: [20, 20, 19, 18, 17, 16]
- Top 3: 20 + 20 + 19 = **59**
- If the old code (first 3 chronologically) were used, the result would be 16 + 17 + 18 = 51.
  A result of 51 means the new code is NOT running correctly.

**Quiz 2 attempts:** none → **0**

**Total: 59**

**What to verify in Quiz Result:**
- Name: `TEST EPSILON`, Seat: `TA-005`
- Status: `Attempt all quizzes`
- Total: `59 / 120`
- Quiz 1 column: `59 / 60` with **green** background (59 ≥ 48 = 16 × 3, so considered complete)
- Quiz 2 column: `0 / 60` with no background colour
- **If you see `51 / 60` instead of `59 / 60`, the highest-score fix is not working.**

**What to verify in Quiz Attempt Details:**
- 6 rows for EPSILON on Quiz 1, all showing `Valid = Yes`
- Each row's "Last Attempt" column shows the timestamp of the row immediately before it

---

## TC-006 — Unknown student (unknown@test.com)

**What this tests:** A student who submits a quiz using an email address that does
not appear in the Email Map. They must be excluded from the scoreboard but must
appear in the audit log.

**Submission:**
- Quiz 1, 1/1/2026, score 18 (a passing score, so it is not blocked by the score rule)

**What to verify in Quiz Result:**
- There is **no row** for `unknown@test.com` anywhere on this sheet.
- There is **no row** with Student Name = `Unknown` anywhere on this sheet.

**What to verify in Quiz Attempt Details:**
- There **is** a row for this submission.
- `Student ID = Unknown`
- `Student Name = Unknown`
- `Email = unknown@test.com`
- `Quiz Name = Quiz 1`
- `Score = 18`
- `Valid = Yes`

---

## Summary — Expected Quiz Result Sheet

After the script runs, the `Quiz Result` tab should contain these rows
(sorted by Total descending, highest first):

| Name         | Seat   | Status              | Total      | Quiz 1   | Quiz 2   |
|--------------|--------|---------------------|------------|----------|----------|
| TEST ALPHA   | TA-001 | Perfect             | 117 / 120  | 57 / 60  | 60 / 60  |
| TEST EPSILON | TA-005 | Attempt all quizzes | 59 / 120   | 59 / 60  | 0 / 60   |
| TEST BETA    | TA-002 | Attempt all quizzes | 36 / 120   | 36 / 60  | 0 / 60   |
| TEST GAMMA   | TA-003 | Attempt all quizzes | 16 / 120   | 16 / 60  | 0 / 60   |
| TEST DELTA   | TA-004 | 🤡                  | 0 / 120    | 0 / 60   | 0 / 60   |

`unknown@test.com` must **not** appear anywhere in this sheet.

**Cell colours in the Quiz 1 and Quiz 2 columns:**
- Green: score ≥ 48 (= 16 × 3). Applies to ALPHA Quiz 1 (57), ALPHA Quiz 2 (60), EPSILON Quiz 1 (59).
- Yellow: score ≥ 16 but < 48. Applies to BETA Quiz 1 (36), GAMMA Quiz 1 (16).
- No colour: score = 0. Applies to all zero cells.

---

## Summary — Expected Quiz Attempt Details Sheet

The `Quiz Attempt Details` tab should contain one row per submission, including
`unknown@test.com`'s submission. Key rows to spot-check:

| Student ID | Student Name | Email            | Quiz   | Score | Valid | Reason                                                 |
|------------|--------------|------------------|--------|-------|-------|--------------------------------------------------------|
| Unknown    | Unknown      | unknown@test.com | Quiz 1 | 18    | Yes   | —                                                      |
| TA-004     | TEST DELTA   | delta@test.com   | Quiz 1 | 15    | No    | Score below minimum                                    |
| TA-004     | TEST DELTA   | delta@test.com   | Quiz 2 | 14    | No    | Score below minimum                                    |
| TA-002     | TEST BETA    | beta@test.com    | Quiz 1 | 18    | No    | Valid attempt too soon after previous valid attempt    |
| TA-005     | TEST EPSILON | epsilon@test.com | Quiz 1 | 16    | Yes   | — (first of 6 valid attempts)                          |
| TA-005     | TEST EPSILON | epsilon@test.com | Quiz 1 | 20    | Yes   | — (fifth attempt, should appear in log even though not used for score) |
