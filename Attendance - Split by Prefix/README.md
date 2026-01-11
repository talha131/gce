# Attendance Split by Prefix

This Google Apps Script splits attendance reports by seat prefix into separate spreadsheet files.

## Configuration

Before running, update the `CONFIG` object at the top of `attendance_split_by_prefix.js`:

```javascript
var CONFIG = {
  prefixes: [
    {
      prefix: "A",
      spreadsheetId: "YOUR_SPREADSHEET_ID_FOR_A_PREFIX",
    },
    {
      prefix: "T",
      spreadsheetId: "YOUR_SPREADSHEET_ID_FOR_T_PREFIX",
    },
  ],
};
```

### How to get Spreadsheet IDs:

1. Open the target Google Spreadsheet
2. Copy the ID from the URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
3. Paste it into the configuration

## Usage

1. Open your source spreadsheet with attendance data
2. Go to Extensions > Apps Script
3. Copy the code from `attendance_split_by_prefix.js`
4. Update the CONFIG with your spreadsheet IDs
5. Run the `pivotAttendanceData` function

## Features

- Filters attendance data by seat prefix (e.g., seats starting with "A" or "T")
- Generates separate reports in different spreadsheet files
- Each report includes:
  - Total days summary
  - Daily attendance totals
  - Individual student attendance with percentages
  - Formatting and color coding for ≥80% attendance
  - Frozen headers and columns for easy navigation

## Requirements

- Source spreadsheet must have a sheet named: `Prof Talha - BEd 4 Year Semester 1 - Applications of ICT`
- Required columns: Date, Seat, Name, Status
- Output spreadsheets must be accessible to the script runner
