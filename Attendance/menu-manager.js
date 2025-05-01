/**
 * Menu Manager for GCE Attendance System
 * Consolidates all menu items and handles the onOpen trigger
 */

/**
 * Creates custom menu when the spreadsheet is opened
 * This function is automatically called when the spreadsheet loads
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  
  ui.createMenu('GCE')
    .addItem('Process Attendance', 'processBatchFromActiveSpreadsheet')
    .addSeparator()
    .addItem('Scan Folder & Update Config', 'scanDefaultFolder')
    .addSeparator()
    .addItem('Test Configuration', 'testConfigurationReading')
    .addItem('Test Folder Search', 'testFolderSearch')
    .addItem('Test Folder Contents', 'testFolderContents')
    .addToUi();
}

/**
 * Alternative function name for the onOpen trigger
 * Some versions of Google Apps Script prefer this naming
 */
function onOpenTrigger() {
  onOpen();
}