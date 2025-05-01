# Google Apps Script Attendance Report Generator

This project provides an automated attendance report generation system for Google Sheets using Google Apps Script.

## Features

- Batch processing of attendance reports from configuration files
- Multiple sorting options (by seat number, attendance percentage, or both)
- Flexible PDF generation options
- Configurable date ranges and output folders
- Custom Google Sheets menu integration
- Validation to prevent report overwriting

## Configuration Options

The system uses a CSV configuration file to define batch processing parameters. Here are all available configuration options:

| Parameter | Possible Values | Description |
|-----------|----------------|-------------|
| **sheet_id** | Any valid Google Sheets ID | ID of the spreadsheet containing source data |
| **sheet_name** | Any valid sheet name | Name of the sheet containing attendance data |
| **title** | Any string (must be different from sheet_name) | Name for the generated report sheet(s) |
| **start_date** | YYYY-MM-DD format | Start date for attendance data filtering |
| **end_date** | YYYY-MM-DD format | End date for attendance data filtering |
| **sort** | `seat`, `percentage`, `both` | How to sort the attendance data |
| **pdf** | `no`, `only`, `both` | PDF generation options |
| **pdf_folder_path** | Any Google Drive folder path | Where to save generated PDFs |
| **process** | `true`, `false` | Whether to process this configuration row |

### Sort Options

- **`seat`** - Sort by seat number (default order)
- **`percentage`** - Sort by attendance percentage (descending)
- **`both`** - Generate two reports: one sorted by seat, one by percentage

### PDF Options

- **`no`** - Generate sheets only (no PDF)
- **`only`** - Generate PDFs only (delete sheets after PDF creation)
- **`both`** - Generate both sheets and PDFs (keep both)

### Process Options

- **`true`** - Process this configuration row
- **`false`** - Skip this configuration row

## Sample Configuration

See `sample-batch-config.csv` for examples of different configuration combinations:

```csv
sheet_id,sheet_name,title,start_date,end_date,sort,pdf,pdf_folder_path,process
1vwrX7aLKrPjqhjktlow1-_jJKhjNVf6qcPWWchS-4m4,BEd 4 Semester 4 - Prof Ali - Assessment,4 Yr Sem 4 - Prof Ali - Assessment - Report,2025-08-01,2025-08-31,percentage,both,Attendance Reports,true
1vwrX7aLKrPjqhjktlow1-_jJKhjNVf6qcPWWchS-4m4,Sample Data Sheet,Sample Report - Seat Order,2025-08-01,2025-08-31,seat,no,Attendance Reports,false
1vwrX7aLKrPjqhjktlow1-_jJKhjNVf6qcPWWchS-4m4,Sample Data Sheet,Sample Report - PDF Only,2025-08-01,2025-08-31,seat,only,PDF Archive/2025,false
```

## Usage

### Via Google Sheets Menu

1. Open your Google Sheets document
2. Look for the "GCE" menu in the menu bar
3. Select "Process Attendance" to run batch processing
4. Select "Test Configuration" to verify your configuration setup

### Via Script Editor

1. Open the Google Apps Script editor
2. Run the `processBatchFromActiveSpreadsheet()` function for batch processing
3. Run the `testConfigurationReading()` function to test configuration parsing

## File Structure

- `attendance.js` - Core attendance report generation functions
- `batch-processor.js` - Batch processing and configuration management
- `sample-batch-config.csv` - Example configuration file
- `sample-attendance.csv` - Example attendance data format

## Important Notes

- The `sheet_name` and `title` parameters must be different to prevent report overwriting
- Dates must be in YYYY-MM-DD format
- PDF folder paths can include nested folders using "/" separator
- Days where all students are absent or have blank statuses are automatically ignored
- All formatting is applied before PDF generation to ensure proper appearance

## Error Handling

The system includes validation for:
- Duplicate sheet names and titles
- Invalid date formats
- Missing required parameters
- Configuration file parsing errors

If validation fails, an error dialog will be displayed and processing will stop to prevent data corruption.