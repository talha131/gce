/**
 * GCE Attendance Report Generator — Main Code
 * ─────────────────────────────────────────────────────────────────────────
 * This file contains all processing logic for the system.
 * Configuration constants are in Config.gs — edit that file, not this one.
 *
 * SECTIONS:
 *   1. Menu Setup
 *   2. Folder Scanner  (Populate Config)
 *   3. Batch Processor (Process Attendance)
 *   4. Attendance Engine
 *   5. PDF Export
 *   6. Utility / Legacy
 * ─────────────────────────────────────────────────────────────────────────
 */

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1 — MENU SETUP
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates the GCE menu when the spreadsheet is opened.
 * This function is automatically triggered by Google Apps Script.
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();

  ui.createMenu("GCE")
    .addItem("Populate Config", "scanFolderAndPopulateConfig")
    .addItem("Process Attendance", "processBatchFromActiveSpreadsheet")
    .addSeparator()
    .addSubMenu(
      ui
        .createMenu("Debug")
        .addItem("Test Configuration Reading", "testConfigurationReading")
        .addItem("Test Folder Search", "testFolderSearch")
        .addItem("Test Folder Contents", "testFolderContents"),
    )
    .addToUi();
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2 — FOLDER SCANNER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Returns the parent folder of the active (controller) spreadsheet.
 * This is used to auto-detect the attendance folder without any hardcoded names.
 *
 * @return {Folder} Google Drive folder object
 */
function getAttendanceFolder() {
  var controllerId = SpreadsheetApp.getActiveSpreadsheet().getId();
  var controllerFile = DriveApp.getFileById(controllerId);
  var parents = controllerFile.getParents();

  if (!parents.hasNext()) {
    throw new Error(
      "This controller spreadsheet has no parent folder.\n" +
        "Please place it inside a folder before running Populate Config.",
    );
  }

  return parents.next();
}

/**
 * Scans the parent folder of this controller spreadsheet, finds all
 * Google Sheets files (excluding the controller itself), and populates
 * the Config sheet with sheet IDs and names.
 *
 * Called from the GCE → Populate Config menu item.
 *
 * @param {String} [configSheetName] - Override config sheet name (default from GCE_CONFIG)
 */
function scanFolderAndPopulateConfig(configSheetName) {
  try {
    configSheetName = configSheetName || GCE_CONFIG.configSheetName;

    Logger.log("Starting folder scan...");

    // Auto-detect the attendance folder from the controller's own location
    var targetFolder = getAttendanceFolder();
    var controllerId = SpreadsheetApp.getActiveSpreadsheet().getId();

    Logger.log("Scanning folder: " + targetFolder.getName());
    Logger.log("Config sheet: " + configSheetName);

    var files = targetFolder.getFiles();
    var spreadsheets = [];

    while (files.hasNext()) {
      var file = files.next();
      var fileName = file.getName();
      var mimeType = file.getMimeType();

      if (mimeType !== MimeType.GOOGLE_SHEETS) continue;

      // Skip the controller spreadsheet itself (compare by ID, not by name)
      if (file.getId() === controllerId) {
        Logger.log("Skipping controller file: " + fileName);
        continue;
      }

      Logger.log("Found spreadsheet: " + fileName);

      try {
        var spreadsheet = SpreadsheetApp.openById(file.getId());
        var sheets = spreadsheet.getSheets();

        for (var i = 0; i < sheets.length; i++) {
          var sheetName = sheets[i].getName();
          spreadsheets.push({
            spreadsheetId: file.getId(),
            spreadsheetName: fileName,
            sheetName: sheetName,
          });
          Logger.log("  - Sheet: " + sheetName);
        }
      } catch (err) {
        Logger.log("Error opening '" + fileName + "': " + err.toString());
      }
    }

    Logger.log("Total sheets found: " + spreadsheets.length);

    if (spreadsheets.length === 0) {
      SpreadsheetApp.getUi().alert(
        "No Spreadsheets Found",
        "No Google Sheets files were found in the folder:\n  " +
          targetFolder.getName() +
          "\n\nMake sure the attendance sheets are in the same folder as this controller file.",
        SpreadsheetApp.getUi().ButtonSet.OK,
      );
      return;
    }

    updateConfigSheet(spreadsheets, configSheetName);
    Logger.log("Folder scan and config update completed successfully!");
  } catch (error) {
    Logger.log("Error in folder scanner: " + error.toString());
    SpreadsheetApp.getUi().alert(
      "Folder Scan Error",
      error.message,
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
    throw error;
  }
}

/**
 * Writes the discovered spreadsheets into the Config sheet.
 * - Existing rows (matched by sheet_id) are updated with the latest sheet_name.
 * - New rows are appended with default values from GCE_CONFIG.
 * - Dates are left blank for new rows so you can fill them in manually.
 *
 * @param {Array}  spreadsheets    - Array of {spreadsheetId, spreadsheetName, sheetName}
 * @param {String} configSheetName - Name of the config sheet tab
 */
function updateConfigSheet(spreadsheets, configSheetName) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var configSheet = ss.getSheetByName(configSheetName);

    // The canonical header row — order defines the column layout
    var HEADERS = [
      "sheet_id",
      "sheet_name",
      "title",
      "start_date",
      "end_date",
      "sort",
      "pdf",
      "pdf_folder_path",
      "pdf_alt_name",
      "process",
    ];

    if (!configSheet) {
      // Config sheet doesn't exist at all — create it with headers
      configSheet = ss.insertSheet(configSheetName);
      configSheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      configSheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
      Logger.log("Created new Config sheet: " + configSheetName);
    }

    var existingData = configSheet.getDataRange().getValues();

    // Sheet exists but is completely empty — write the header row
    var isEffectivelyEmpty =
      existingData.length === 0 ||
      (existingData.length === 1 &&
        existingData[0].every(function (cell) {
          return cell === "";
        }));

    if (isEffectivelyEmpty) {
      configSheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      configSheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
      existingData = configSheet.getDataRange().getValues();
      Logger.log("Wrote headers into empty Config sheet.");
    }

    var headers = existingData[0];

    // Locate column indexes
    var sheetIdIndex = headers.indexOf("sheet_id");
    var sheetNameIndex = headers.indexOf("sheet_name");
    var titleIndex = headers.indexOf("title");
    var startDateIndex = headers.indexOf("start_date");
    var endDateIndex = headers.indexOf("end_date");
    var sortIndex = headers.indexOf("sort");
    var pdfIndex = headers.indexOf("pdf");
    var pdfFolderIndex = headers.indexOf("pdf_folder_path");
    var pdfAltNameIndex = headers.indexOf("pdf_alt_name");
    var processIndex = headers.indexOf("process");

    if (sheetIdIndex === -1 || sheetNameIndex === -1) {
      // Sheet has data but the required columns are missing — don't overwrite, warn instead
      SpreadsheetApp.getUi().alert(
        "Config Sheet Has Unexpected Headers",
        "The '" +
          configSheetName +
          "' sheet exists but is missing the required 'sheet_id' " +
          "and 'sheet_name' columns.\n\n" +
          "To fix this:\n" +
          "1. Delete or rename the existing '" +
          configSheetName +
          "' sheet tab.\n" +
          "2. Run GCE → Populate Config again — it will create a fresh one automatically.",
        SpreadsheetApp.getUi().ButtonSet.OK,
      );
      return;
    }

    // Build a map of existing sheet_id values → row index
    var existingSheetIds = {};
    for (var i = 1; i < existingData.length; i++) {
      var existingId = existingData[i][sheetIdIndex];
      if (existingId) {
        existingSheetIds[existingId.toString()] = i;
      }
    }

    var updatedCount = 0;
    var addedCount = 0;
    var newRows = [];

    for (var j = 0; j < spreadsheets.length; j++) {
      var item = spreadsheets[j];
      var itemId = item.spreadsheetId;

      if (existingSheetIds.hasOwnProperty(itemId)) {
        // Update the sheet_name of the existing row
        var rowIndex = existingSheetIds[itemId];
        existingData[rowIndex][sheetNameIndex] = item.sheetName;
        updatedCount++;
        Logger.log(
          "Updated existing entry: " + itemId + " → " + item.sheetName,
        );
      } else {
        // Build a new row with defaults; leave dates blank for manual entry
        var newRow = new Array(headers.length).fill("");
        newRow[sheetIdIndex] = itemId;
        newRow[sheetNameIndex] = item.sheetName;

        if (titleIndex !== -1)
          newRow[titleIndex] = item.sheetName + GCE_CONFIG.titleSuffix;
        if (startDateIndex !== -1) newRow[startDateIndex] = ""; // leave blank — fill manually
        if (endDateIndex !== -1) newRow[endDateIndex] = ""; // leave blank — fill manually
        if (sortIndex !== -1) newRow[sortIndex] = GCE_CONFIG.defaultSort;
        if (pdfIndex !== -1) newRow[pdfIndex] = GCE_CONFIG.defaultPdf;
        if (pdfFolderIndex !== -1)
          newRow[pdfFolderIndex] = GCE_CONFIG.defaultPdfFolder;
        if (pdfAltNameIndex !== -1) newRow[pdfAltNameIndex] = ""; // leave blank — optional
        if (processIndex !== -1) newRow[processIndex] = "false";

        newRows.push(newRow);
        addedCount++;
        Logger.log("Added new entry: " + itemId + " → " + item.sheetName);
      }
    }

    // Write back updated rows
    if (updatedCount > 0) {
      configSheet
        .getRange(1, 1, existingData.length, existingData[0].length)
        .setValues(existingData);
    }

    // Append new rows
    if (newRows.length > 0) {
      var startRow = existingData.length + 1;
      configSheet
        .getRange(startRow, 1, newRows.length, headers.length)
        .setValues(newRows);
    }

    Logger.log(
      "Config sheet updated — updated: " +
        updatedCount +
        ", added: " +
        addedCount,
    );

    SpreadsheetApp.getUi().alert(
      "Populate Config Complete",
      "Folder scanned successfully.\n\n" +
        "• Updated existing entries: " +
        updatedCount +
        "\n" +
        "• Added new entries: " +
        addedCount +
        "\n" +
        "• Total sheets processed: " +
        spreadsheets.length +
        "\n\n" +
        "New rows have blank dates — please fill in start_date and end_date before running Process Attendance.",
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
  } catch (error) {
    Logger.log("Error updating config sheet: " + error.toString());
    throw error;
  }
}

/**
 * Debug: Searches for the parent folder and logs its name and ID.
 */
function testFolderSearch() {
  try {
    var folder = getAttendanceFolder();
    Logger.log("Parent folder name : " + folder.getName());
    Logger.log("Parent folder ID   : " + folder.getId());
    Logger.log("Parent folder URL  : " + folder.getUrl());
  } catch (error) {
    Logger.log("Error: " + error.toString());
  }
}

/**
 * Debug: Lists all files in the parent folder.
 */
function testFolderContents() {
  try {
    var folder = getAttendanceFolder();
    Logger.log("Contents of folder: " + folder.getName());

    var files = folder.getFiles();
    var count = 0;

    while (files.hasNext()) {
      var file = files.next();
      count++;
      Logger.log(
        "File " +
          count +
          ": " +
          file.getName() +
          " | Type: " +
          file.getMimeType() +
          " | ID: " +
          file.getId(),
      );
    }

    Logger.log("Total files found: " + count);
  } catch (error) {
    Logger.log("Error: " + error.toString());
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3 — BATCH PROCESSOR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Reads the Config sheet and processes each row where process = TRUE.
 * Called from GCE → Process Attendance.
 */
function processBatchFromActiveSpreadsheet() {
  processBatchAttendanceReports();
}

/**
 * Core batch processing function.
 *
 * @param {String} [configSpreadsheetId] - Defaults to the active spreadsheet
 * @param {String} [configSheetName]     - Defaults to GCE_CONFIG.configSheetName
 */
function processBatchAttendanceReports(configSpreadsheetId, configSheetName) {
  try {
    configSheetName = configSheetName || GCE_CONFIG.configSheetName;
    configSpreadsheetId =
      configSpreadsheetId || SpreadsheetApp.getActiveSpreadsheet().getId();

    Logger.log("Starting batch attendance report processing...");
    Logger.log("Config Spreadsheet ID : " + configSpreadsheetId);
    Logger.log("Config Sheet Name     : " + configSheetName);

    var configData = getConfigurationData(configSpreadsheetId, configSheetName);

    if (configData.length === 0) {
      Logger.log("No configuration data found. Exiting.");
      return;
    }

    Logger.log("Found " + configData.length + " configuration row(s)");

    var processedCount = 0;
    var skippedCount = 0;
    var errorCount = 0;

    for (var i = 0; i < configData.length; i++) {
      var config = configData[i];

      try {
        if (config.process) {
          Logger.log("Processing row " + (i + 2) + ": " + config.title);

          mainAttendanceController(
            config.title,
            { startDate: config.startDate, endDate: config.endDate },
            config.sort,
            config.pdf,
            config.sheetName,
            config.sheetId,
            config.pdfFolderPath,
            config.pdfAltName,
          );

          processedCount++;
          Logger.log("Successfully processed: " + config.title);
        } else {
          Logger.log(
            "Skipping row " + (i + 2) + " (process = false): " + config.title,
          );
          skippedCount++;
        }
      } catch (err) {
        errorCount++;
        Logger.log(
          "Error processing row " +
            (i + 2) +
            " (" +
            config.title +
            "): " +
            err.toString(),
        );
      }
    }

    Logger.log("Batch processing completed!");
    Logger.log("Processed : " + processedCount);
    Logger.log("Skipped   : " + skippedCount);
    Logger.log("Errors    : " + errorCount);
  } catch (error) {
    Logger.log("Error in batch processor: " + error.toString());
    throw error;
  }
}

/**
 * Reads and validates the Config sheet, returning an array of config objects.
 * If a title is missing or identical to sheet_name, it is auto-generated
 * by appending GCE_CONFIG.titleSuffix — no error is thrown.
 *
 * @param  {String} spreadsheetId - ID of the spreadsheet containing Config
 * @param  {String} sheetName     - Name of the config sheet tab
 * @return {Array}  Array of config objects
 */
function getConfigurationData(spreadsheetId, sheetName) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var configSheet = ss.getSheetByName(sheetName);

    if (!configSheet) {
      throw new Error(
        'Configuration sheet "' + sheetName + '" not found in spreadsheet.',
      );
    }

    var data = configSheet.getDataRange().getValues();

    if (data.length < 2) {
      Logger.log("No data rows found in configuration sheet.");
      return [];
    }

    var headers = data[0];
    var requiredColumns = [
      "sheet_id",
      "sheet_name",
      "title",
      "start_date",
      "end_date",
      "sort",
      "pdf",
      "pdf_folder_path",
      "process",
    ];
    var columnIndexes = {};

    for (var i = 0; i < requiredColumns.length; i++) {
      var colName = requiredColumns[i];
      var index = headers.indexOf(colName);
      if (index === -1) {
        throw new Error(
          'Required column "' + colName + '" not found in Config sheet.',
        );
      }
      columnIndexes[colName] = index;
    }

    // pdf_alt_name is optional — older Config sheets without it still work
    var pdfAltNameIndex = headers.indexOf("pdf_alt_name");

    var configData = [];

    for (var row = 1; row < data.length; row++) {
      var rowData = data[row];

      // Skip rows with no sheet_id
      if (!rowData[columnIndexes["sheet_id"]]) continue;

      var sourceSheetName = rowData[columnIndexes["sheet_name"]]
        .toString()
        .trim();
      var title = rowData[columnIndexes["title"]].toString().trim();

      // Auto-generate title if it is blank or identical to the source sheet name.
      // An identical title would cause the report to overwrite the source data.
      if (!title || title === sourceSheetName) {
        title = sourceSheetName + GCE_CONFIG.titleSuffix;
        Logger.log(
          "Auto-generated title for row " + (row + 1) + ': "' + title + '"',
        );
      }

      // pdf_alt_name is optional — blank means no alternate copy is made
      var pdfAltName =
        pdfAltNameIndex !== -1
          ? rowData[pdfAltNameIndex].toString().trim()
          : "";

      var config = {
        sheetId: rowData[columnIndexes["sheet_id"]].toString(),
        sheetName: sourceSheetName,
        title: title,
        startDate: formatDateForConfig(rowData[columnIndexes["start_date"]]),
        endDate: formatDateForConfig(rowData[columnIndexes["end_date"]]),
        sort: rowData[columnIndexes["sort"]].toString(),
        pdf: rowData[columnIndexes["pdf"]].toString(),
        pdfFolderPath: rowData[columnIndexes["pdf_folder_path"]].toString(),
        pdfAltName: pdfAltName,
        process: parseBoolean(rowData[columnIndexes["process"]]),
      };

      configData.push(config);
    }

    return configData;
  } catch (error) {
    Logger.log("Error reading configuration data: " + error.toString());
    throw error;
  }
}

/**
 * Converts a date value from the sheet into a YYYY-MM-DD string.
 *
 * @param  {*}      dateValue - Date object, string, or number from the sheet
 * @return {String} Formatted date string, or "" if the value is blank
 */
function formatDateForConfig(dateValue) {
  if (!dateValue) return "";

  var date;
  if (dateValue instanceof Date) {
    date = dateValue;
  } else if (typeof dateValue === "string") {
    date = new Date(dateValue);
  } else {
    return dateValue.toString();
  }

  if (isNaN(date.getTime())) return dateValue.toString();

  var year = date.getFullYear();
  var month = String(date.getMonth() + 1).padStart(2, "0");
  var day = String(date.getDate()).padStart(2, "0");

  return year + "-" + month + "-" + day;
}

/**
 * Parses a value from the sheet as a boolean.
 * Accepts: true/false (boolean), "true"/"yes"/"1" (string), non-zero (number).
 *
 * @param  {*}       value - Raw value from the sheet
 * @return {Boolean}
 */
function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    var lower = value.toLowerCase();
    return lower === "true" || lower === "yes" || lower === "1";
  }
  if (typeof value === "number") return value !== 0;
  return false;
}

/**
 * Debug: Logs all configuration rows to the Apps Script logger.
 */
function testConfigurationReading(configSpreadsheetId, configSheetName) {
  try {
    configSheetName = configSheetName || GCE_CONFIG.configSheetName;
    configSpreadsheetId =
      configSpreadsheetId || SpreadsheetApp.getActiveSpreadsheet().getId();

    var configData = getConfigurationData(configSpreadsheetId, configSheetName);

    Logger.log("Configuration test — total rows: " + configData.length);

    for (var i = 0; i < configData.length; i++) {
      var c = configData[i];
      Logger.log("Row " + (i + 2) + ":");
      Logger.log("  Sheet ID    : " + c.sheetId);
      Logger.log("  Sheet Name  : " + c.sheetName);
      Logger.log("  Title       : " + c.title);
      Logger.log("  Date Range  : " + c.startDate + " → " + c.endDate);
      Logger.log("  Sort        : " + c.sort);
      Logger.log("  PDF         : " + c.pdf);
      Logger.log("  PDF Folder  : " + c.pdfFolderPath);
      Logger.log("  PDF Alt Name: " + (c.pdfAltName || "(none)"));
      Logger.log("  Process     : " + c.process);
      Logger.log("---");
    }
  } catch (error) {
    Logger.log("Configuration test error: " + error.toString());
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4 — ATTENDANCE ENGINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Master controller: decides whether to generate sheets, PDFs, or both.
 * If pdfAltName is provided and PDFs were generated, creates renamed copies
 * in an "Alternate Reports" subfolder via createAltPDFCopies().
 *
 * @param {String} title           - Report title / sheet name
 * @param {Object} dateRange       - { startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD" }
 * @param {String} sort            - "seat" | "percentage" | "both"
 * @param {String} pdf             - "no" | "only" | "both"
 * @param {String} sourceSheetName - Sheet tab name inside the teacher's spreadsheet
 * @param {String} spreadsheetId   - Google Sheets ID of the teacher's spreadsheet
 * @param {String} pdfFolderPath   - Drive folder path for PDF output
 * @param {String} [pdfAltName]    - Optional alternate filename for a PDF copy
 */
function mainAttendanceController(
  title,
  dateRange,
  sort,
  pdf,
  sourceSheetName,
  spreadsheetId,
  pdfFolderPath,
  pdfAltName,
) {
  try {
    title = title || "Attendance Report";
    dateRange = dateRange || { startDate: "", endDate: "" };
    sort = sort || "both";
    pdf = pdf || "no";
    sourceSheetName = sourceSheetName || "Sheet1";
    spreadsheetId =
      spreadsheetId || SpreadsheetApp.getActiveSpreadsheet().getId();
    pdfFolderPath = pdfFolderPath || GCE_CONFIG.defaultPdfFolder;
    pdfAltName = pdfAltName || "";

    if (pdf !== "no" && pdf !== "only" && pdf !== "both") {
      throw new Error(
        'PDF parameter must be "no", "only", or "both". Got: "' + pdf + '"',
      );
    }

    var pdfsGenerated = [];

    if (pdf === "no") {
      mainGenerateAttendanceReport(
        title,
        dateRange,
        sort,
        sourceSheetName,
        spreadsheetId,
      );
    } else if (pdf === "only") {
      pdfsGenerated =
        mainGenerateAttendanceReportWithPDF(
          title,
          dateRange,
          sort,
          sourceSheetName,
          spreadsheetId,
          pdfFolderPath,
          true,
        ) || [];
    } else {
      // pdf === "both"
      mainGenerateAttendanceReport(
        title,
        dateRange,
        sort,
        sourceSheetName,
        spreadsheetId,
      );
      pdfsGenerated =
        mainGenerateAttendanceReportWithPDF(
          title,
          dateRange,
          sort,
          sourceSheetName,
          spreadsheetId,
          pdfFolderPath,
          false,
        ) || [];
    }

    // Create alternate-named copies if requested — entirely new function, nothing above changes
    if (pdfAltName && pdfsGenerated.length > 0) {
      createAltPDFCopies(pdfsGenerated, title, pdfAltName, pdfFolderPath);
    }

    Logger.log("Attendance report generation completed: " + title);
  } catch (error) {
    Logger.log("Error in attendance controller: " + error.toString());
    throw error;
  }
}

/**
 * Generates report sheet(s) without PDF.
 */
function mainGenerateAttendanceReport(
  title,
  dateRange,
  sort,
  sourceSheetName,
  spreadsheetId,
) {
  try {
    var rawData = getRawData(sourceSheetName, spreadsheetId);
    var processedData = processAttendanceData(rawData, dateRange);

    if (sort === "both") {
      writeReportToSheet(
        processedData,
        title + " - Seat",
        "seat",
        spreadsheetId,
      );
      writeReportToSheet(
        processedData,
        title + " - Percentage",
        "percentage",
        spreadsheetId,
      );
    } else {
      writeReportToSheet(processedData, title, sort, spreadsheetId);
    }

    Logger.log("Attendance report sheets generated successfully!");
  } catch (error) {
    Logger.log("Error generating attendance report: " + error.toString());
    throw error;
  }
}

/**
 * Generates report sheet(s) and exports PDF(s), optionally deleting sheets afterwards.
 */
function mainGenerateAttendanceReportWithPDF(
  title,
  dateRange,
  sort,
  sourceSheetName,
  spreadsheetId,
  pdfFolderPath,
  deleteSheets,
) {
  try {
    pdfFolderPath = pdfFolderPath || GCE_CONFIG.defaultPdfFolder;
    deleteSheets = deleteSheets || false;

    var rawData = getRawData(sourceSheetName, spreadsheetId);
    var processedData = processAttendanceData(rawData, dateRange);

    var pdfsGenerated = [];
    var sheetsToDelete = [];

    if (sort === "both") {
      var seatSheetName = title + " - Seat";
      var percentageSheetName = title + " - Percentage";

      writeReportToSheet(processedData, seatSheetName, "seat", spreadsheetId);
      writeReportToSheet(
        processedData,
        percentageSheetName,
        "percentage",
        spreadsheetId,
      );

      SpreadsheetApp.flush();

      if (deleteSheets) {
        sheetsToDelete.push(seatSheetName);
        sheetsToDelete.push(percentageSheetName);
      }

      pdfsGenerated.push(
        downloadSheetAsPDF(seatSheetName, pdfFolderPath, spreadsheetId),
      );
      pdfsGenerated.push(
        downloadSheetAsPDF(percentageSheetName, pdfFolderPath, spreadsheetId),
      );
    } else {
      writeReportToSheet(processedData, title, sort, spreadsheetId);

      SpreadsheetApp.flush();

      if (deleteSheets) sheetsToDelete.push(title);

      pdfsGenerated.push(
        downloadSheetAsPDF(title, pdfFolderPath, spreadsheetId),
      );
    }

    // Delete temporary sheets if in "only" mode
    if (deleteSheets && sheetsToDelete.length > 0) {
      var ss = SpreadsheetApp.openById(spreadsheetId);
      for (var i = 0; i < sheetsToDelete.length; i++) {
        var sheet = ss.getSheetByName(sheetsToDelete[i]);
        if (sheet) {
          ss.deleteSheet(sheet);
          Logger.log("Deleted temporary sheet: " + sheetsToDelete[i]);
        }
      }
    }

    Logger.log("Attendance report with PDF generated successfully!");
    Logger.log("PDFs generated: " + pdfsGenerated.length);

    return pdfsGenerated;
  } catch (error) {
    Logger.log(
      "Error generating attendance report with PDF: " + error.toString(),
    );
    throw error;
  }
}

/**
 * Reads all data from a sheet in the teacher's spreadsheet.
 *
 * @param  {String} sourceSheetName - Tab name to read from
 * @param  {String} spreadsheetId   - Google Sheets file ID
 * @return {Array}  2D array of all cell values
 */
function getRawData(sourceSheetName, spreadsheetId) {
  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sourceSheet = ss.getSheetByName(sourceSheetName);

  if (!sourceSheet) {
    throw new Error(
      'Source sheet "' + sourceSheetName + '" not found in spreadsheet.',
    );
  }

  var data = sourceSheet.getDataRange().getValues();

  if (data.length === 0) {
    throw new Error('No data found in source sheet "' + sourceSheetName + '".');
  }

  return data;
}

/**
 * Top-level processing pipeline: raw data → formatted report data.
 */
function processAttendanceData(rawData, dateRange) {
  var parsed = parseData(rawData, dateRange);
  var studentStats = calculateStatistics(
    parsed.studentRecords,
    parsed.validDates,
  );
  return formatReportData(studentStats, parsed.validDates);
}

/**
 * Parses the raw 2D array into structured student records and a list of valid dates.
 *
 * Valid dates are dates where at least one student has a Present or Leave status.
 * Dates where every student is blank/absent are filtered out.
 */
function parseData(rawData, dateRange) {
  var studentRecords = {};
  var allDates = new Set();

  var headers = rawData[0];
  var dateIndex = headers.indexOf("Date");
  var seatIndex = headers.indexOf("Seat");
  var nameIndex = headers.indexOf("Name");
  var statusIndex = headers.indexOf("Status");

  if (
    dateIndex === -1 ||
    seatIndex === -1 ||
    nameIndex === -1 ||
    statusIndex === -1
  ) {
    throw new Error(
      "Required columns (Date, Seat, Name, Status) not found in source sheet.",
    );
  }

  for (var i = 1; i < rawData.length; i++) {
    var row = rawData[i];
    var seat = row[seatIndex];
    var name = row[nameIndex];
    var status = row[statusIndex];

    if (!seat || !name) continue;

    var date = standardizeDate(row[dateIndex]);

    // Apply date range filter if provided
    if (dateRange && dateRange.startDate && dateRange.endDate) {
      if (date < dateRange.startDate || date > dateRange.endDate) continue;
    }

    allDates.add(date);

    if (!studentRecords[seat]) {
      studentRecords[seat] = {
        name: name,
        firstAppearance: date,
        attendance: {},
      };
    } else if (date < studentRecords[seat].firstAppearance) {
      studentRecords[seat].firstAppearance = date;
    }

    studentRecords[seat].attendance[date] = normalizeStatus(status);
  }

  // Sort all dates, then filter out dates with no Present/Leave entries
  var allDatesArray = Array.from(allDates).sort();
  var validDates = [];

  for (var d = 0; d < allDatesArray.length; d++) {
    var currentDate = allDatesArray[d];
    var hasValidAttendance = false;

    for (var seat in studentRecords) {
      if (currentDate >= studentRecords[seat].firstAppearance) {
        var s = studentRecords[seat].attendance[currentDate];
        if (s === "P" || s === "L") {
          hasValidAttendance = true;
          break;
        }
      }
    }

    if (hasValidAttendance) {
      validDates.push(currentDate);
    } else {
      // Remove invalid date from all records
      for (var seat in studentRecords) {
        delete studentRecords[seat].attendance[currentDate];
      }
    }
  }

  return { studentRecords: studentRecords, validDates: validDates };
}

/**
 * Converts a raw date value to a YYYY-MM-DD string.
 */
function standardizeDate(rawDate) {
  var date;

  if (rawDate instanceof Date) {
    date = rawDate;
  } else if (typeof rawDate === "string") {
    date = new Date(rawDate);
  } else {
    throw new Error("Invalid date format: " + rawDate);
  }

  if (isNaN(date.getTime())) {
    throw new Error("Invalid date: " + rawDate);
  }

  var year = date.getFullYear();
  var month = String(date.getMonth() + 1).padStart(2, "0");
  var day = String(date.getDate()).padStart(2, "0");

  return year + "-" + month + "-" + day;
}

/**
 * Normalizes a raw status string to "P", "L", or "A".
 */
function normalizeStatus(status) {
  if (!status) return "A";
  var s = status.toString().toLowerCase().trim();
  if (s === "present") return "P";
  if (s === "leave") return "L";
  return "A";
}

/**
 * Calculates per-student statistics (totals + daily status map).
 */
function calculateStatistics(studentRecords, validDates) {
  var studentStats = [];

  for (var seat in studentRecords) {
    var student = studentRecords[seat];
    var present = 0;
    var absent = 0;
    var leave = 0;
    var dailyStatus = {};

    for (var i = 0; i < validDates.length; i++) {
      var reportDate = validDates[i];

      if (reportDate < student.firstAppearance) {
        dailyStatus[reportDate] = "";
        continue;
      }

      var status = student.attendance[reportDate] || "A";

      if (status === "P") present++;
      else if (status === "L") leave++;
      else absent++;

      dailyStatus[reportDate] = status;
    }

    var totalActiveDays = present + absent;
    var percentage =
      totalActiveDays === 0 ? 0 : Math.round((present / totalActiveDays) * 100);

    studentStats.push({
      seat: seat,
      name: student.name,
      present: present,
      absent: absent,
      leave: leave,
      percentage: percentage,
      dailyStatus: dailyStatus,
      firstAppearance: student.firstAppearance,
    });
  }

  studentStats.sort(function (a, b) {
    return a.seat.localeCompare(b.seat);
  });
  return studentStats;
}

/**
 * Calculates per-date totals (present / absent / leave counts across all students).
 */
function calculateDailyStatistics(studentStats, validDates) {
  var dailyStats = {};

  for (var i = 0; i < validDates.length; i++) {
    dailyStats[validDates[i]] = {
      present: 0,
      absent: 0,
      leave: 0,
      hasData: false,
    };
  }

  for (var j = 0; j < studentStats.length; j++) {
    var student = studentStats[j];

    for (var k = 0; k < validDates.length; k++) {
      var date = validDates[k];
      var status = student.dailyStatus[date];

      if (status && status !== "") {
        dailyStats[date].hasData = true;
        if (status === "P") dailyStats[date].present++;
        else if (status === "A") dailyStats[date].absent++;
        else if (status === "L") dailyStats[date].leave++;
      }
    }
  }

  var totalDaysWithData = 0;
  for (var date in dailyStats) {
    if (dailyStats[date].hasData) totalDaysWithData++;
  }

  return { dailyStats: dailyStats, totalDays: totalDaysWithData };
}

/**
 * Builds the 4 summary rows that appear at the top of every report.
 * Rows: Total Days, Students Present (per day), Students Absent (per day), Students on Leave (per day).
 */
function createSummaryRows(dailyStatistics, validDates) {
  var summaryRows = [];
  var numDateCols = validDates.length;

  // Row 1: Total Days
  var totalDaysRow = [
    "",
    "Total Days",
    dailyStatistics.totalDays,
    "",
    "",
    "",
    "",
  ];
  for (var i = 0; i < numDateCols; i++) totalDaysRow.push("");
  summaryRows.push(totalDaysRow);

  // Row 2: Students Present per date
  var presentRow = ["", "Students Present", "", "", "", "", ""];
  for (var j = 0; j < numDateCols; j++) {
    var d = validDates[j];
    presentRow.push(
      dailyStatistics.dailyStats[d].hasData
        ? dailyStatistics.dailyStats[d].present
        : "",
    );
  }
  summaryRows.push(presentRow);

  // Row 3: Students Absent per date
  var absentRow = ["", "Students Absent", "", "", "", "", ""];
  for (var k = 0; k < numDateCols; k++) {
    var d = validDates[k];
    absentRow.push(
      dailyStatistics.dailyStats[d].hasData
        ? dailyStatistics.dailyStats[d].absent
        : "",
    );
  }
  summaryRows.push(absentRow);

  // Row 4: Students on Leave per date
  var leaveRow = ["", "Students on Leave", "", "", "", "", ""];
  for (var l = 0; l < numDateCols; l++) {
    var d = validDates[l];
    leaveRow.push(
      dailyStatistics.dailyStats[d].hasData
        ? dailyStatistics.dailyStats[d].leave
        : "",
    );
  }
  summaryRows.push(leaveRow);

  return summaryRows;
}

/**
 * Formats a YYYY-MM-DD date string into a compact 3-line column header.
 * Format: "Mon\n04\nAug"
 */
function formatCompactDate(dateString) {
  var date = new Date(dateString);
  var dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  return (
    dayNames[date.getDay()] +
    "\n" +
    String(date.getDate()).padStart(2, "0") +
    "\n" +
    monthNames[date.getMonth()]
  );
}

/**
 * Assembles the final 2D array for the report sheet
 * (summary rows + header row + student rows).
 */
function formatReportData(studentStats, validDates) {
  var reportData = [];
  var dailyStatistics = calculateDailyStatistics(studentStats, validDates);
  var summaryRows = createSummaryRows(dailyStatistics, validDates);

  for (var s = 0; s < summaryRows.length; s++) {
    reportData.push(summaryRows[s]);
  }

  // Header row
  var headers = ["#", "Seat", "Name", "Percent", "Present", "Absent", "Leave"];
  for (var i = 0; i < validDates.length; i++) {
    headers.push(formatCompactDate(validDates[i]));
  }
  reportData.push(headers);

  // Student rows
  for (var j = 0; j < studentStats.length; j++) {
    var student = studentStats[j];
    var row = [
      j + 1,
      student.seat,
      student.name,
      student.percentage,
      student.present,
      student.absent,
      student.leave,
    ];

    for (var k = 0; k < validDates.length; k++) {
      var status = student.dailyStatus[validDates[k]] || "";
      if (status === "P") row.push("Present");
      else if (status === "L") row.push("Leave");
      else if (status === "A") row.push("Absent");
      else row.push("");
    }

    reportData.push(row);
  }

  return reportData;
}

/**
 * Converts full-word status values in date columns to single letters (P / A / L).
 */
function transformAttendanceDisplay(reportData) {
  if (reportData.length === 0) return reportData;

  var transformedData = [reportData[0].slice()];

  for (var i = 1; i < reportData.length; i++) {
    var original = reportData[i];
    var transformedRow = original.slice(0, 7);

    for (var k = 7; k < original.length; k++) {
      var status = original[k];
      if (status === "Present") transformedRow.push("P");
      else if (status === "Absent") transformedRow.push("A");
      else if (status === "Leave") transformedRow.push("L");
      else transformedRow.push(status);
    }

    transformedData.push(transformedRow);
  }

  return transformedData;
}

/**
 * Sorts report data by the specified sort option, then renumbers the serial column.
 */
function sortReportData(reportData, sortOption) {
  if (reportData.length <= 5) return reportData;

  var sortedData = [];

  // Keep summary rows (1–4) and header row (5)
  for (var i = 0; i < 5; i++) {
    sortedData.push(reportData[i].slice());
  }

  var studentRows = [];
  for (var j = 5; j < reportData.length; j++) {
    studentRows.push(reportData[j].slice());
  }

  if (sortOption === "percentage") {
    studentRows.sort(function (a, b) {
      return (parseFloat(b[3]) || 0) - (parseFloat(a[3]) || 0);
    });
  }

  // Renumber serial column (index 0)
  for (var k = 0; k < studentRows.length; k++) {
    studentRows[k][0] = k + 1;
    sortedData.push(studentRows[k]);
  }

  return sortedData;
}

/**
 * Creates or clears the report sheet, writes the data, and applies formatting.
 *
 * @param {Array}  reportData    - 2D array of processed report data
 * @param {String} title         - Sheet tab name and report title
 * @param {String} sortOption    - "seat" or "percentage"
 * @param {String} spreadsheetId - ID of the spreadsheet to write to
 */
function writeReportToSheet(reportData, title, sortOption, spreadsheetId) {
  var ss = SpreadsheetApp.openById(spreadsheetId);
  var reportSheet = ss.getSheetByName(title);

  if (reportSheet) {
    reportSheet.clear();
  } else {
    reportSheet = ss.insertSheet(title);
  }

  var sortedData = sortReportData(reportData, sortOption);
  var transformedData = transformAttendanceDisplay(sortedData);

  if (transformedData.length > 0 && transformedData[0].length > 0) {
    // Write data starting at row 2 (row 1 is reserved for the title)
    var range = reportSheet.getRange(
      2,
      1,
      transformedData.length,
      transformedData[0].length,
    );
    range.setValues(transformedData);
    formatReportSheet(reportSheet, transformedData, title);
  }
}

/**
 * Applies all visual formatting to the report sheet.
 *
 * Layout (rows):
 *   Row 1   → Title (merged A1:G1, text-wrapped)
 *   Row 2   → Total Days summary
 *   Row 3   → Daily Present counts
 *   Row 4   → Daily Absent counts
 *   Row 5   → Daily Leave counts
 *   Row 6   → Column headers (#, Seat, Name, …, date columns)
 *   Row 7+  → Student data
 */
function formatReportSheet(reportSheet, reportData, title) {
  if (reportData.length === 0) return;

  var numRows = reportData.length;
  var numCols = reportData[0].length;

  // ── Title row (row 1) ──────────────────────────────────────────────────
  var titleCell = reportSheet.getRange(1, 2);
  titleCell.setValue(title);

  // Entire title row: bold, larger font
  reportSheet.getRange(1, 1, 1, numCols).setFontWeight("bold").setFontSize(12);

  // Enable text wrapping on the title row so long titles are never truncated
  reportSheet.getRange(1, 1, 1, numCols).setWrap(true);

  // ── Summary rows (rows 2–5) and header row (row 6) ────────────────────
  reportSheet.getRange(2, 1, 5, numCols).setFontWeight("bold");

  // Header row: black background, white text
  reportSheet
    .getRange(6, 1, 1, numCols)
    .setBackground("#000000")
    .setFontColor("#ffffff")
    .setVerticalAlignment("middle");

  // Wrap text in the Percent/Present/Absent/Leave header cells (columns 4–7)
  reportSheet.getRange(6, 4, 1, 4).setWrap(true);

  // ── Borders ───────────────────────────────────────────────────────────
  reportSheet
    .getRange(1, 1, numRows + 1, numCols)
    .setBorder(true, true, true, true, true, true);

  // ── Column widths ─────────────────────────────────────────────────────
  reportSheet.autoResizeColumns(1, 1); // #
  reportSheet.autoResizeColumns(2, 3); // Seat, Name, Percent
  reportSheet.setColumnWidths(5, 3, 33); // Present, Absent, Leave

  if (numCols > 7) {
    reportSheet.autoResizeColumns(8, numCols - 7); // Date columns
  }

  // ── Number formats ────────────────────────────────────────────────────
  reportSheet.getRange(2, 3, 1, 1).setNumberFormat("0"); // Total Days value

  if (numCols > 7) {
    reportSheet.getRange(3, 8, 3, numCols - 7).setNumberFormat("0"); // Daily counts
  }

  if (numRows > 5) {
    reportSheet.getRange(7, 4, numRows - 5, 1).setNumberFormat('0"%"'); // Percentage column
  }

  if (numCols > 7) {
    reportSheet.getRange(6, 8, 1, numCols - 7).setNumberFormat("ddd, mmm dd"); // Date headers
  }

  // ── Row banding on student data rows ─────────────────────────────────
  if (numRows > 5) {
    reportSheet
      .getRange(7, 1, numRows - 5, numCols)
      .applyRowBanding(SpreadsheetApp.BandingTheme.GREY, false, false);
  }

  // ── Freeze rows and columns ───────────────────────────────────────────
  reportSheet.setFrozenRows(6); // Freeze title + summary + header
  reportSheet.setFrozenColumns(7); // Freeze #, Seat, Name, %, Present, Absent, Leave

  // ── Merge and align (must come after column widths are set) ───────────
  reportSheet.getRange(1, 1, 1, 7).merge().setHorizontalAlignment("center"); // Title A1:G1
  reportSheet.autoResizeColumns(2, 2);

  // Merge label cells in summary rows
  reportSheet.getRange(2, 1, 1, 2).merge(); // Total Days
  reportSheet.getRange(3, 1, 1, 2).merge(); // Students Present
  reportSheet.getRange(4, 1, 1, 2).merge(); // Students Absent
  reportSheet.getRange(5, 1, 1, 2).merge(); // Students on Leave
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5 — PDF EXPORT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Exports a single sheet as a PDF and saves it to a Google Drive folder.
 *
 * @param  {String} sheetName      - Name of the sheet to export
 * @param  {String} folderPath     - Drive folder path (created if it doesn't exist)
 * @param  {String} spreadsheetId  - ID of the spreadsheet
 * @return {Object} { success, fileName, fileId, folderPath, downloadUrl }
 */
function downloadSheetAsPDF(sheetName, folderPath, spreadsheetId) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error('Sheet "' + sheetName + '" not found.');
    }

    var sheetId = sheet.getSheetId();
    var baseUrl =
      "https://docs.google.com/spreadsheets/d/" + ss.getId() + "/export?";
    var params = {
      format: "pdf",
      size: "A4",
      portrait: "false",
      fitw: "true",
      sheetnames: "false",
      printtitle: "false",
      pagenumbers: "true",
      gridlines: "false",
      fzr: "true",
      gid: sheetId,
      scale: "2",
      top_margin: "0.5",
      bottom_margin: "0.5",
      left_margin: "0.5",
      right_margin: "0.5",
      horizontal_alignment: "CENTER",
      vertical_alignment: "TOP",
    };

    var paramString = Object.keys(params)
      .map(function (key) {
        return key + "=" + params[key];
      })
      .join("&");

    var response = UrlFetchApp.fetch(baseUrl + paramString, {
      headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
    });

    var blob = response.getBlob();
    blob.setName(sheetName + ".pdf");

    var file;
    if (folderPath) {
      file = getOrCreateFolder(folderPath).createFile(blob);
    } else {
      file = DriveApp.createFile(blob);
    }

    Logger.log(
      "PDF created: " + file.getName() + " in " + (folderPath || "Root"),
    );

    return {
      success: true,
      fileName: file.getName(),
      fileId: file.getId(),
      folderPath: folderPath || "Root",
      downloadUrl: file.getDownloadUrl(),
    };
  } catch (error) {
    Logger.log("Error creating PDF: " + error.toString());
    throw error;
  }
}

/**
 * Navigates to (or creates) a nested folder path in Google Drive.
 * Uses "/" as the separator. Example: "2026 - 1 - GCE/Reports"
 *
 * @param  {String} folderPath - Slash-separated folder path relative to My Drive
 * @return {Folder} The deepest folder in the path
 */
function getOrCreateFolder(folderPath) {
  var folders = folderPath.split("/");
  var currentFolder = DriveApp.getRootFolder();

  for (var i = 0; i < folders.length; i++) {
    var folderName = folders[i].trim();
    if (folderName === "") continue;

    var subFolders = currentFolder.getFoldersByName(folderName);
    currentFolder = subFolders.hasNext()
      ? subFolders.next()
      : currentFolder.createFolder(folderName);
  }

  return currentFolder;
}

/**
 * Creates alternate-named copies of already-generated PDFs.
 *
 * Copies are saved in an "Alternate Reports" subfolder within the original
 * pdf_folder_path. The alternate filename is derived by replacing the base
 * title with pdfAltName in the original filename — this correctly handles
 * sort="both", which produces two PDFs suffixed with " - Seat" and
 * " - Percentage".
 *
 * Examples (sort="both"):
 *   Original : "Prof Mehdi - BEd 4 Sem 5 - English - Attendance Report - Seat.pdf"
 *   Alt copy : "BEd 4 Sem 5 - Prof Mehdi - English - Seat.pdf"
 *   (given pdfAltName = "BEd 4 Sem 5 - Prof Mehdi - English")
 *
 * This function is intentionally self-contained and orthogonal — it only
 * calls DriveApp and touches nothing in the report generation pipeline.
 *
 * @param {Array}  pdfsGenerated  - Array of PDF info objects returned by mainGenerateAttendanceReportWithPDF
 *                                  Each object must have: { fileId, fileName }
 * @param {String} title          - The base title used when generating the original PDFs
 * @param {String} pdfAltName     - The alternate base name for the copies
 * @param {String} baseFolderPath - The same pdf_folder_path used for the originals
 */
function createAltPDFCopies(pdfsGenerated, title, pdfAltName, baseFolderPath) {
  try {
    var altFolderPath = baseFolderPath + "/Alternate Reports";
    var altFolder = getOrCreateFolder(altFolderPath);

    Logger.log("Creating alt PDF copies in: " + altFolderPath);

    for (var i = 0; i < pdfsGenerated.length; i++) {
      var pdfInfo = pdfsGenerated[i];
      var originalFile = DriveApp.getFileById(pdfInfo.fileId);

      // Derive the alt filename by replacing only the base title portion.
      // pdfInfo.fileName is e.g. "title.pdf", "title - Seat.pdf", "title - Percentage.pdf"
      // We replace the first occurrence of title so suffixes like " - Seat" are preserved.
      var altFileName = pdfInfo.fileName.replace(title, pdfAltName);

      var copy = originalFile.makeCopy(altFileName, altFolder);

      Logger.log(
        "Alt copy created: " + altFileName + " (ID: " + copy.getId() + ")",
      );
    }

    Logger.log(
      "Alt PDF copies complete — " + pdfsGenerated.length + " file(s) copied.",
    );
  } catch (error) {
    Logger.log("Error creating alt PDF copies: " + error.toString());
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6 — LEGACY / BACKWARD COMPATIBILITY
// ═══════════════════════════════════════════════════════════════════════════

/** @deprecated Use mainAttendanceController() instead. */
function pivotAttendanceData() {
  mainGenerateAttendanceReport();
}

/** @deprecated Use mainAttendanceController() instead. */
function generateAttendanceReport() {
  mainGenerateAttendanceReport();
}
