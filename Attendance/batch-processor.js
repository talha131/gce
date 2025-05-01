/**
 * Batch Attendance Report Processor
 * Reads configuration from a sheet and processes multiple attendance reports
 */

/**
 * Main function to process attendance reports based on configuration sheet
 * Reads from row 2 onwards and processes each row where 'process' is true
 * @param {String} configSpreadsheetId - ID of the spreadsheet containing configuration
 * @param {String} configSheetName - Name of the sheet containing configuration (default: "Config")
 */
function processBatchAttendanceReports(configSpreadsheetId, configSheetName) {
  try {
    // Default config sheet name if not provided
    configSheetName = configSheetName || "Config";

    // If no spreadsheet ID provided, use active spreadsheet
    configSpreadsheetId =
      configSpreadsheetId || SpreadsheetApp.getActiveSpreadsheet().getId();

    Logger.log("Starting batch attendance report processing...");
    Logger.log("Config Spreadsheet ID: " + configSpreadsheetId);
    Logger.log("Config Sheet Name: " + configSheetName);

    // Get configuration data (this will validate sheet_name vs title)
    var configData;
    try {
      configData = getConfigurationData(configSpreadsheetId, configSheetName);
    } catch (configError) {
      // If it's a validation error, don't continue processing
      if (configError.message.includes("Sheet name and title cannot be the same")) {
        Logger.log("Processing aborted due to configuration validation error.");
        return; // Exit gracefully
      }
      // Re-throw other errors
      throw configError;
    }

    if (configData.length === 0) {
      Logger.log("No configuration data found. Exiting.");
      return;
    }

    Logger.log("Found " + configData.length + " configuration row(s)");

    var processedCount = 0;
    var skippedCount = 0;
    var errorCount = 0;

    // Process each configuration row
    for (var i = 0; i < configData.length; i++) {
      var config = configData[i];

      try {
        if (config.process) {
          Logger.log("Processing row " + (i + 2) + ": " + config.title);

          // Call the main attendance controller with configuration parameters
          mainAttendanceController(
            config.title,
            {
              startDate: config.startDate,
              endDate: config.endDate,
            },
            config.sort,
            config.pdf, // Use configurable PDF option
            config.sheetName,
            config.sheetId,
            config.pdfFolderPath // Pass the PDF folder path from config
          );

          processedCount++;
          Logger.log("Successfully processed: " + config.title);
        } else {
          Logger.log(
            "Skipping row " + (i + 2) + " (process = false): " + config.title
          );
          skippedCount++;
        }
      } catch (error) {
        errorCount++;
        Logger.log(
          "Error processing row " +
            (i + 2) +
            " (" +
            config.title +
            "): " +
            error.toString()
        );
      }
    }

    // Summary log
    Logger.log("Batch processing completed!");
    Logger.log("Processed: " + processedCount);
    Logger.log("Skipped: " + skippedCount);
    Logger.log("Errors: " + errorCount);
  } catch (error) {
    Logger.log("Error in batch processor: " + error.toString());
    throw error;
  }
}

/**
 * Reads configuration data from the specified sheet
 * @param {String} spreadsheetId - ID of the spreadsheet containing configuration
 * @param {String} sheetName - Name of the sheet containing configuration
 * @return {Array} Array of configuration objects
 */
function getConfigurationData(spreadsheetId, sheetName) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var configSheet = ss.getSheetByName(sheetName);

    if (!configSheet) {
      throw new Error(
        'Configuration sheet "' + sheetName + '" not found in spreadsheet'
      );
    }

    var data = configSheet.getDataRange().getValues();

    if (data.length < 2) {
      Logger.log("No data rows found in configuration sheet");
      return [];
    }

    // Get headers from row 1
    var headers = data[0];
    var configData = [];

    // Validate required columns exist
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
          'Required column "' + colName + '" not found in configuration sheet'
        );
      }
      columnIndexes[colName] = index;
    }

    // Process data rows (starting from row 2)
    for (var row = 1; row < data.length; row++) {
      var rowData = data[row];

      // Skip empty rows
      if (
        !rowData[columnIndexes["sheet_id"]] ||
        !rowData[columnIndexes["title"]]
      ) {
        continue;
      }

      var sheetName = rowData[columnIndexes["sheet_name"]].toString();
      var title = rowData[columnIndexes["title"]].toString();

      // Validate that sheet_name and title are different
      if (sheetName === title) {
        var errorMessage = 
          "CONFIGURATION ERROR in row " + (row + 1) + ":\n\n" +
          "The 'sheet_name' and 'title' cannot be the same!\n\n" +
          "Current values:\n" +
          "• Sheet Name (source data): '" + sheetName + "'\n" +
          "• Title (report name): '" + title + "'\n\n" +
          "This would cause the report to overwrite your original data.\n\n" +
          "Please change the 'title' to something different like:\n" +
          "• '" + title + " - Report'\n" +
          "• '" + title + " - Attendance Report'\n" +
          "• '" + title + " - Summary'\n\n" +
          "Processing stopped to protect your data.";
        
        // Show error dialog in spreadsheet UI
        SpreadsheetApp.getUi().alert(
          "Configuration Error - Data Protection",
          errorMessage,
          SpreadsheetApp.getUi().ButtonSet.OK
        );
        
        // Also log the error
        Logger.log("ERROR: " + errorMessage);
        
        // Throw error to stop processing
        throw new Error("Sheet name and title cannot be the same. Row " + (row + 1) + ": '" + sheetName + "'");
      }

      var config = {
        sheetId: rowData[columnIndexes["sheet_id"]].toString(),
        sheetName: sheetName,
        title: title,
        startDate: formatDateForConfig(rowData[columnIndexes["start_date"]]),
        endDate: formatDateForConfig(rowData[columnIndexes["end_date"]]),
        sort: rowData[columnIndexes["sort"]].toString(),
        pdf: rowData[columnIndexes["pdf"]].toString(),
        pdfFolderPath: rowData[columnIndexes["pdf_folder_path"]].toString(),
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
 * Formats date for configuration (ensures YYYY-MM-DD format)
 * @param {*} dateValue - Date value from sheet
 * @return {String} Formatted date string
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

  if (isNaN(date.getTime())) {
    return dateValue.toString();
  }

  // Format as YYYY-MM-DD
  var year = date.getFullYear();
  var month = String(date.getMonth() + 1).padStart(2, "0");
  var day = String(date.getDate()).padStart(2, "0");

  return year + "-" + month + "-" + day;
}

/**
 * Parses boolean values from sheet data
 * @param {*} value - Value to parse as boolean
 * @return {Boolean} Parsed boolean value
 */
function parseBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    var lowerValue = value.toLowerCase();
    return lowerValue === "true" || lowerValue === "yes" || lowerValue === "1";
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  return false;
}

/**
 * Convenience function to process batch reports using active spreadsheet
 * Uses the active spreadsheet as the configuration source
 */
function processBatchFromActiveSpreadsheet() {
  processBatchAttendanceReports();
}

/**
 * Test function to validate configuration reading
 * @param {String} configSpreadsheetId - ID of the spreadsheet containing configuration
 * @param {String} configSheetName - Name of the sheet containing configuration
 */
function testConfigurationReading(configSpreadsheetId, configSheetName) {
  try {
    configSheetName = configSheetName || "Config";
    configSpreadsheetId =
      configSpreadsheetId || SpreadsheetApp.getActiveSpreadsheet().getId();

    var configData = getConfigurationData(configSpreadsheetId, configSheetName);

    Logger.log("Configuration test results:");
    Logger.log("Total rows: " + configData.length);

    for (var i = 0; i < configData.length; i++) {
      var config = configData[i];
      Logger.log("Row " + (i + 2) + ":");
      Logger.log("  Sheet ID: " + config.sheetId);
      Logger.log("  Sheet Name: " + config.sheetName);
      Logger.log("  Title: " + config.title);
      Logger.log("  Date Range: " + config.startDate + " to " + config.endDate);
      Logger.log("  Sort: " + config.sort);
      Logger.log("  PDF: " + config.pdf);
      Logger.log("  PDF Folder: " + config.pdfFolderPath);
      Logger.log("  Process: " + config.process);
      Logger.log("---");
    }
  } catch (error) {
    Logger.log("Configuration test error: " + error.toString());
  }
}

/**
 * Debug function to check if a sheet exists in a spreadsheet
 * @param {String} spreadsheetId - ID of the spreadsheet to check
 * @param {String} sheetName - Name of the sheet to look for
 */
function debugSheetExistence(spreadsheetId, sheetName) {
  try {
    Logger.log("=== DEBUG: Checking sheet existence ===");
    Logger.log("Spreadsheet ID: " + spreadsheetId);
    Logger.log("Looking for sheet: '" + sheetName + "'");
    Logger.log("Sheet name length: " + sheetName.length);
    
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheets = ss.getSheets();
    
    Logger.log("Available sheets in spreadsheet:");
    for (var i = 0; i < sheets.length; i++) {
      var currentSheetName = sheets[i].getName();
      Logger.log("  - '" + currentSheetName + "' (length: " + currentSheetName.length + ")");
      
      // Check for exact match
      if (currentSheetName === sheetName) {
        Logger.log("    ✓ EXACT MATCH FOUND");
      }
      
      // Check for trimmed match (in case of extra spaces)
      if (currentSheetName.trim() === sheetName.trim()) {
        Logger.log("    ✓ TRIMMED MATCH FOUND");
      }
    }
    
    var targetSheet = ss.getSheetByName(sheetName);
    if (targetSheet) {
      Logger.log("✓ Sheet found successfully: " + sheetName);
      return true;
    } else {
      Logger.log("✗ Sheet NOT found: " + sheetName);
      return false;
    }
  } catch (error) {
    Logger.log("Error checking sheet existence: " + error.toString());
    return false;
  }
}

/**
 * Test function to debug the specific sheet issue
 */
function testSheetExistence() {
  // Use the values from your configuration
  var spreadsheetId = "1NoUcaDXFoQfEN_iCyMxKi07V2Y1KiZM1OZ7TFDGBs2o";
  var sheetName = "BEd 4 Semester 4 - Prof Saeed Fatima - Classroom Assessment";
  
  debugSheetExistence(spreadsheetId, sheetName);
}
