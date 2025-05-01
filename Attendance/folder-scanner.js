/**
 * Google Drive Folder Scanner for Attendance Sheets
 * Scans a specified folder and populates configuration sheet with found spreadsheets
 */

/**
 * Main function to scan folder and populate config sheet
 * @param {String} folderName - Name of the folder to scan (default: "2025 - 2 - GCE Attendance")
 * @param {String} configSheetName - Name of the config sheet (default: "Config")
 */
function scanFolderAndPopulateConfig(folderName, configSheetName) {
  try {
    // Default values
    folderName = folderName || "2025 - 2 - GCE Attendance";
    configSheetName = configSheetName || "Config";
    
    Logger.log("Starting folder scan...");
    Logger.log("Target folder: " + folderName);
    Logger.log("Config sheet: " + configSheetName);
    
    // Find the target folder
    var folders = DriveApp.getFoldersByName(folderName);
    if (!folders.hasNext()) {
      throw new Error("Folder '" + folderName + "' not found in Google Drive");
    }
    
    var targetFolder = folders.next();
    Logger.log("Found folder: " + targetFolder.getName());
    
    // Get all files in the folder
    var files = targetFolder.getFiles();
    var spreadsheets = [];
    
    // Filter for Google Sheets, excluding specific files
    while (files.hasNext()) {
      var file = files.next();
      var fileName = file.getName();
      var mimeType = file.getMimeType();
      
      // Check if it's a Google Sheets file
      if (mimeType === MimeType.GOOGLE_SHEETS) {
        // Skip the controller sheet and report folder (though report folder should be a folder, not a sheet)
        if (fileName !== "2025 - 2 - GCE Attendance Controller") {
          Logger.log("Found spreadsheet: " + fileName);
          
          try {
            // Open the spreadsheet to get sheet names
            var spreadsheet = SpreadsheetApp.openById(file.getId());
            var sheets = spreadsheet.getSheets();
            
            // Get all sheet names in this spreadsheet
            for (var i = 0; i < sheets.length; i++) {
              var sheet = sheets[i];
              var sheetName = sheet.getName();
              
              spreadsheets.push({
                spreadsheetId: file.getId(),
                spreadsheetName: fileName,
                sheetName: sheetName
              });
              
              Logger.log("  - Sheet: " + sheetName);
            }
          } catch (error) {
            Logger.log("Error processing spreadsheet '" + fileName + "': " + error.toString());
          }
        } else {
          Logger.log("Skipping controller sheet: " + fileName);
        }
      }
    }
    
    Logger.log("Found " + spreadsheets.length + " sheets across all spreadsheets");
    
    if (spreadsheets.length === 0) {
      Logger.log("No spreadsheets found to process");
      return;
    }
    
    // Update the config sheet
    updateConfigSheet(spreadsheets, configSheetName);
    
    Logger.log("Folder scan and config update completed successfully!");
    
  } catch (error) {
    Logger.log("Error in folder scanner: " + error.toString());
    throw error;
  }
}

/**
 * Updates the config sheet with found spreadsheets
 * @param {Array} spreadsheets - Array of spreadsheet objects with id, name, and sheet names
 * @param {String} configSheetName - Name of the config sheet
 */
function updateConfigSheet(spreadsheets, configSheetName) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var configSheet = ss.getSheetByName(configSheetName);
    
    if (!configSheet) {
      throw new Error("Config sheet '" + configSheetName + "' not found");
    }
    
    // Get existing data
    var existingData = configSheet.getDataRange().getValues();
    var headers = existingData[0];
    
    // Find column indexes
    var sheetIdIndex = headers.indexOf("sheet_id");
    var sheetNameIndex = headers.indexOf("sheet_name");
    var titleIndex = headers.indexOf("title");
    var startDateIndex = headers.indexOf("start_date");
    var endDateIndex = headers.indexOf("end_date");
    var sortIndex = headers.indexOf("sort");
    var pdfIndex = headers.indexOf("pdf");
    var pdfFolderIndex = headers.indexOf("pdf_folder_path");
    var processIndex = headers.indexOf("process");
    
    if (sheetIdIndex === -1 || sheetNameIndex === -1) {
      throw new Error("Required columns 'sheet_id' and 'sheet_name' not found in config sheet");
    }
    
    // Create a map of existing sheet IDs to row numbers
    var existingSheetIds = {};
    for (var i = 1; i < existingData.length; i++) {
      var sheetId = existingData[i][sheetIdIndex];
      if (sheetId) {
        existingSheetIds[sheetId.toString()] = i;
      }
    }
    
    var updatedCount = 0;
    var addedCount = 0;
    var newRows = [];
    
    // Process each found spreadsheet
    for (var i = 0; i < spreadsheets.length; i++) {
      var item = spreadsheets[i];
      var sheetId = item.spreadsheetId;
      var sheetName = item.sheetName;
      
      if (existingSheetIds.hasOwnProperty(sheetId)) {
        // Update existing row
        var rowIndex = existingSheetIds[sheetId];
        existingData[rowIndex][sheetNameIndex] = sheetName;
        updatedCount++;
        Logger.log("Updated existing entry: " + sheetId + " -> " + sheetName);
      } else {
        // Create new row
        var newRow = new Array(headers.length).fill("");
        newRow[sheetIdIndex] = sheetId;
        newRow[sheetNameIndex] = sheetName;
        
        // Set default values for new entries
        if (titleIndex !== -1) newRow[titleIndex] = sheetName + " - Report";
        if (startDateIndex !== -1) newRow[startDateIndex] = "2025-02-01";
        if (endDateIndex !== -1) newRow[endDateIndex] = "2025-02-28";
        if (sortIndex !== -1) newRow[sortIndex] = "percentage";
        if (pdfIndex !== -1) newRow[pdfIndex] = "both";
        if (pdfFolderIndex !== -1) newRow[pdfFolderIndex] = "Attendance Reports";
        if (processIndex !== -1) newRow[processIndex] = "false";
        
        newRows.push(newRow);
        addedCount++;
        Logger.log("Added new entry: " + sheetId + " -> " + sheetName);
      }
    }
    
    // Write back existing data (with updates)
    if (updatedCount > 0) {
      configSheet.getRange(1, 1, existingData.length, existingData[0].length).setValues(existingData);
    }
    
    // Add new rows
    if (newRows.length > 0) {
      var startRow = existingData.length + 1;
      configSheet.getRange(startRow, 1, newRows.length, headers.length).setValues(newRows);
    }
    
    Logger.log("Config sheet updated:");
    Logger.log("  - Updated existing entries: " + updatedCount);
    Logger.log("  - Added new entries: " + addedCount);
    
    // Show success message to user
    SpreadsheetApp.getUi().alert(
      "Folder Scan Complete",
      "Successfully scanned folder and updated config sheet:\n\n" +
      "• Updated existing entries: " + updatedCount + "\n" +
      "• Added new entries: " + addedCount + "\n" +
      "• Total sheets processed: " + spreadsheets.length + "\n\n" +
      "Please review the config sheet and adjust settings as needed.",
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
  } catch (error) {
    Logger.log("Error updating config sheet: " + error.toString());
    throw error;
  }
}

/**
 * Convenience function to scan the default folder
 */
function scanDefaultFolder() {
  scanFolderAndPopulateConfig();
}

/**
 * Test function to list folders matching the name
 */
function testFolderSearch() {
  var folderName = "2025 - 2 - GCE Attendance";
  
  Logger.log("Searching for folders named: " + folderName);
  
  var folders = DriveApp.getFoldersByName(folderName);
  var count = 0;
  
  while (folders.hasNext()) {
    var folder = folders.next();
    count++;
    Logger.log("Found folder " + count + ":");
    Logger.log("  Name: " + folder.getName());
    Logger.log("  ID: " + folder.getId());
    Logger.log("  URL: " + folder.getUrl());
  }
  
  if (count === 0) {
    Logger.log("No folders found with name: " + folderName);
  }
}

/**
 * Test function to list files in the target folder
 */
function testFolderContents() {
  var folderName = "2025 - 2 - GCE Attendance";
  
  try {
    var folders = DriveApp.getFoldersByName(folderName);
    if (!folders.hasNext()) {
      Logger.log("Folder not found: " + folderName);
      return;
    }
    
    var folder = folders.next();
    Logger.log("Contents of folder: " + folder.getName());
    
    var files = folder.getFiles();
    var count = 0;
    
    while (files.hasNext()) {
      var file = files.next();
      count++;
      Logger.log("File " + count + ":");
      Logger.log("  Name: " + file.getName());
      Logger.log("  Type: " + file.getMimeType());
      Logger.log("  ID: " + file.getId());
      
      if (file.getMimeType() === MimeType.GOOGLE_SHEETS) {
        Logger.log("  ✓ This is a Google Sheets file");
      }
    }
    
    Logger.log("Total files found: " + count);
    
  } catch (error) {
    Logger.log("Error: " + error.toString());
  }
}