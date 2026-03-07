/**
 * GCE Attendance Report Generator — Configuration
 * ─────────────────────────────────────────────────
 * This is the ONLY file you should need to edit between semesters.
 *
 * All processing logic lives in Code.gs.
 * Do not edit Code.gs unless you are making structural changes to the system.
 */

var GCE_CONFIG = {
  /**
   * Name of the configuration sheet tab inside this controller spreadsheet.
   * Change this only if you rename your config tab.
   * Default: "Config"
   */
  configSheetName: "Config",

  /**
   * Default sort order applied when "Populate Config" creates new rows.
   *
   * "seat"        → students sorted by seat number (alphabetical)
   * "percentage"  → students sorted by attendance percentage (highest first)
   * "both"        → two report sheets created: one by seat, one by percentage
   */
  defaultSort: "percentage",

  /**
   * Default PDF output mode applied when "Populate Config" creates new rows.
   *
   * "no"    → generate the report sheet only; no PDF saved to Drive
   * "only"  → generate a PDF, save it to Drive, then delete the report sheet
   * "both"  → generate the report sheet AND save a PDF to Drive
   */
  defaultPdf: "both",

  /**
   * Default Google Drive folder path for saving PDFs (new rows only).
   * Use "/" to create nested folders, e.g. "2026 - 1 - GCE Attendance/Reports"
   * Path is relative to My Drive root.
   */
  defaultPdfFolder: "Attendance Reports",

  /**
   * Suffix appended to sheet_name when the title column is empty
   * or identical to sheet_name (which would overwrite the source data).
   *
   * Example: "Prof Aoun - Psychology" becomes
   *          "Prof Aoun - Psychology - Attendance Report"
   */
  titleSuffix: " - Attendance Report",
};
