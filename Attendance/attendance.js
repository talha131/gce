/**
 * Google Apps Script for Attendance Report
 * Main function that orchestrates the entire process of reading, processing, and writing attendance data
 * This is the entry point for the attendance report generation
 */
function mainGenerateAttendanceReport(
  title,
  dateRange,
  sort,
  sourceSheetName,
  spreadsheetId
) {
  try {
    // Step 1: Get raw data from the source sheet
    var rawData = getRawData(sourceSheetName, spreadsheetId);

    // Step 2: Process the attendance data
    var processedData = processAttendanceData(rawData, dateRange);

    // Step 3: Write the report to sheet(s) based on sort option
    if (sort === "both") {
      // Generate two sheets
      writeReportToSheet(
        processedData,
        title + " - Seat",
        "seat",
        spreadsheetId
      );
      writeReportToSheet(
        processedData,
        title + " - Percentage",
        "percentage",
        spreadsheetId
      );
    } else {
      // Generate single sheet
      writeReportToSheet(processedData, title, sort, spreadsheetId);
    }

    Logger.log("Attendance report generated successfully!");
  } catch (error) {
    Logger.log("Error generating attendance report: " + error.toString());
    throw error;
  }
}

/**
 * Reads all data from the source sheet
 * @param {String} sourceSheetName - Name of the source sheet to read from
 * @param {String} spreadsheetId - ID of the spreadsheet to open
 * @return {Array} 2D array containing all sheet data
 */
function getRawData(sourceSheetName, spreadsheetId) {
  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sourceSheet = ss.getSheetByName(sourceSheetName);

  if (!sourceSheet) {
    throw new Error(
      'Source sheet "' + sourceSheetName + '" not found in spreadsheet'
    );
  }

  var data = sourceSheet.getDataRange().getValues();

  if (data.length === 0) {
    throw new Error("No data found in source sheet");
  }

  return data;
}

/**
 * Master processing function that takes raw data and returns formatted report data
 * @param {Array} rawData - 2D array of raw attendance data
 * @return {Array} 2D array formatted for the report sheet
 */
function processAttendanceData(rawData, dateRange) {
  // Parse the raw data into structured format
  var parsedResult = parseData(rawData, dateRange);
  var studentRecords = parsedResult.studentRecords;
  var validDates = parsedResult.validDates;

  // Calculate statistics for each student
  var studentStats = calculateStatistics(studentRecords, validDates);

  // Format the data for the report sheet
  var reportData = formatReportData(studentStats, validDates);

  return reportData;
}

/**
 * Parses raw 2D array and organizes it into a structured format
 * @param {Array} rawData - 2D array of raw attendance data
 * @return {Object} Object containing studentRecords and validDates
 */
function parseData(rawData, dateRange) {
  var studentRecords = {};
  var allDates = new Set();

  // Skip header row
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
      "Required columns (Date, Seat, Name, Status) not found in data"
    );
  }

  // Process each row (skip header)
  for (var i = 1; i < rawData.length; i++) {
    var row = rawData[i];
    var seat = row[seatIndex];
    var name = row[nameIndex];
    var rawDate = row[dateIndex];
    var status = row[statusIndex];

    // Skip rows with empty seat or name
    if (!seat || !name) {
      continue;
    }

    // Standardize date format (YYYY-MM-DD)
    var date = standardizeDate(rawDate);

    // Filter dates based on date range if provided
    if (dateRange && dateRange.startDate && dateRange.endDate) {
      if (date < dateRange.startDate || date > dateRange.endDate) {
        continue; // Skip dates outside the range
      }
    }

    allDates.add(date);

    // Initialize student record if it doesn't exist
    if (!studentRecords[seat]) {
      studentRecords[seat] = {
        name: name,
        firstAppearance: date,
        attendance: {},
      };
    } else {
      // Update first appearance if current date is earlier
      if (date < studentRecords[seat].firstAppearance) {
        studentRecords[seat].firstAppearance = date;
      }
    }

    // Normalize status: "Present" -> 'P', "Leave" -> 'L', empty/other -> 'A'
    var normalizedStatus = normalizeStatus(status);
    studentRecords[seat].attendance[date] = normalizedStatus;
  }

  // Convert Set to sorted array
  var allDatesArray = Array.from(allDates).sort();
  
  // Filter out dates where all students are absent or have blank status
  var validDates = [];
  
  for (var d = 0; d < allDatesArray.length; d++) {
    var currentDate = allDatesArray[d];
    var hasValidAttendance = false;
    
    // Check if any student has Present or Leave status for this date
    for (var seat in studentRecords) {
      var student = studentRecords[seat];
      
      // Only check students who were active on this date (date >= firstAppearance)
      if (currentDate >= student.firstAppearance) {
        var status = student.attendance[currentDate];
        
        // If student has Present or Leave status, this date is valid
        if (status === 'P' || status === 'L') {
          hasValidAttendance = true;
          break;
        }
      }
    }
    
    // Only include dates that have at least one Present or Leave status
    if (hasValidAttendance) {
      validDates.push(currentDate);
    } else {
      // Remove this date from all student records since it's invalid
      for (var seat in studentRecords) {
        delete studentRecords[seat].attendance[currentDate];
      }
    }
  }

  return {
    studentRecords: studentRecords,
    validDates: validDates,
  };
}

/**
 * Standardizes date format to YYYY-MM-DD
 * @param {*} rawDate - Raw date value from sheet
 * @return {String} Standardized date string
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

  // Format as YYYY-MM-DD
  var year = date.getFullYear();
  var month = String(date.getMonth() + 1).padStart(2, "0");
  var day = String(date.getDate()).padStart(2, "0");

  return year + "-" + month + "-" + day;
}

/**
 * Normalizes attendance status
 * @param {String} status - Raw status value
 * @return {String} Normalized status ('P', 'L', or 'A')
 */
function normalizeStatus(status) {
  if (!status) return "A";

  var statusStr = status.toString().toLowerCase();

  if (statusStr === "present") return "P";
  if (statusStr === "leave") return "L";

  return "A"; // Default to absent for any other value
}

/**
 * Calculates statistics for each student
 * @param {Object} studentRecords - Object containing student attendance records
 * @param {Array} validDates - Sorted array of valid dates
 * @return {Array} Array of student statistics objects
 */
function calculateStatistics(studentRecords, validDates) {
  var studentStats = [];

  for (var seat in studentRecords) {
    var student = studentRecords[seat];
    var present = 0;
    var absent = 0;
    var leave = 0;
    var dailyStatus = {};

    // Process each valid date
    for (var i = 0; i < validDates.length; i++) {
      var reportDate = validDates[i];

      // Skip dates before student's first appearance
      if (reportDate < student.firstAppearance) {
        dailyStatus[reportDate] = ""; // No status for dates before first appearance
        continue;
      }

      // Get student's status for this date (default to 'A' if not found)
      var status = student.attendance[reportDate] || "A";

      // Update counters
      if (status === "P") {
        present++;
      } else if (status === "L") {
        leave++;
      } else {
        absent++;
      }

      dailyStatus[reportDate] = status;
    }

    // Calculate percentage (present / total active days) and round to nearest integer
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

  // Sort by seat number
  studentStats.sort(function (a, b) {
    return a.seat.localeCompare(b.seat);
  });

  return studentStats;
}

/**
 * Formats the processed data for the report sheet
 * @param {Array} studentStats - Array of student statistics
 * @param {Array} validDates - Sorted array of valid dates
 * @return {Array} 2D array formatted for the report sheet
 */
/**
 * Calculates daily attendance statistics for each date
 * Purpose: Generates summary statistics showing total present, absent, and leave counts per day
 * @param {Array} studentStats - Array of student statistics objects
 * @param {Array} validDates - Sorted array of valid dates
 * @return {Object} Object containing daily statistics and total days count
 */
function calculateDailyStatistics(studentStats, validDates) {
  var dailyStats = {};
  var totalDaysWithData = 0;

  // Initialize daily stats for each date
  for (var i = 0; i < validDates.length; i++) {
    var date = validDates[i];
    dailyStats[date] = {
      present: 0,
      absent: 0,
      leave: 0,
      hasData: false,
    };
  }

  // Count attendance for each date across all students
  for (var j = 0; j < studentStats.length; j++) {
    var student = studentStats[j];

    for (var k = 0; k < validDates.length; k++) {
      var date = validDates[k];
      var status = student.dailyStatus[date];

      // Only count if student has a status for this date (not empty)
      if (status && status !== "") {
        dailyStats[date].hasData = true;

        if (status === "P") {
          dailyStats[date].present++;
        } else if (status === "A") {
          dailyStats[date].absent++;
        } else if (status === "L") {
          dailyStats[date].leave++;
        }
      }
    }
  }

  // Count total days that have at least one entry
  for (var date in dailyStats) {
    if (dailyStats[date].hasData) {
      totalDaysWithData++;
    }
  }

  return {
    dailyStats: dailyStats,
    totalDays: totalDaysWithData,
  };
}

/**
 * Creates summary rows for the report (Total Days, Daily Present, Daily Leave, Daily Absent)
 * Purpose: Generates the top 4 summary rows that show overall statistics and daily breakdowns
 * @param {Object} dailyStatistics - Object containing daily statistics and total days
 * @param {Array} validDates - Sorted array of valid dates
 * @return {Array} Array of 4 summary rows to be inserted at the top of the report
 */
function createSummaryRows(dailyStatistics, validDates) {
  var summaryRows = [];

  // Row 1: Total Days - add empty string for serial number column, value should be in column C (index 2)
  var totalDaysRow = [
    "",
    "Total Days",
    dailyStatistics.totalDays,
    "",
    "",
    "",
    "",
  ];
  // Fill remaining columns with empty strings for date columns
  for (var i = 0; i < validDates.length; i++) {
    totalDaysRow.push("");
  }
  summaryRows.push(totalDaysRow);

  // Row 2: Daily Present - add empty string for serial number column
  var dailyPresentRow = ["", "Students Present", "", "", "", "", ""];
  for (var j = 0; j < validDates.length; j++) {
    var date = validDates[j];
    var presentCount = dailyStatistics.dailyStats[date].hasData
      ? dailyStatistics.dailyStats[date].present
      : "";
    dailyPresentRow.push(presentCount);
  }
  summaryRows.push(dailyPresentRow);

  // Row 3: Daily Absent - add empty string for serial number column
  var dailyAbsentRow = ["", "Students Absent", "", "", "", "", ""];
  for (var k = 0; k < validDates.length; k++) {
    var date = validDates[k];
    var absentCount = dailyStatistics.dailyStats[date].hasData
      ? dailyStatistics.dailyStats[date].absent
      : "";
    dailyAbsentRow.push(absentCount);
  }
  summaryRows.push(dailyAbsentRow);

  // Row 4: Daily Leave - add empty string for serial number column
  var dailyLeaveRow = ["", "Students on Leave", "", "", "", "", ""];
  for (var l = 0; l < validDates.length; l++) {
    var date = validDates[l];
    var leaveCount = dailyStatistics.dailyStats[date].hasData
      ? dailyStatistics.dailyStats[date].leave
      : "";
    dailyLeaveRow.push(leaveCount);
  }
  summaryRows.push(dailyLeaveRow);

  return summaryRows;
}

/**
 * Formats date for compact column headers with line breaks
 * Format: Day\nDate\nMonth (e.g., "Mon\n04\nAug")
 * @param {String} dateString - Date string in YYYY-MM-DD format
 * @return {String} Formatted date string with line breaks
 */
function formatCompactDate(dateString) {
  var date = new Date(dateString);

  // Get day of week (Mon, Tue, etc.)
  var dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var dayOfWeek = dayNames[date.getDay()];

  // Get day of month with leading zero if needed
  var dayOfMonth = String(date.getDate()).padStart(2, "0");

  // Get month abbreviation
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
  var month = monthNames[date.getMonth()];

  // Return formatted string with line breaks
  return dayOfWeek + "\n" + dayOfMonth + "\n" + month;
}

function formatReportData(studentStats, validDates) {
  var reportData = [];

  // Calculate daily statistics
  var dailyStatistics = calculateDailyStatistics(studentStats, validDates);

  // Add summary rows at the very top
  var summaryRows = createSummaryRows(dailyStatistics, validDates);
  for (var s = 0; s < summaryRows.length; s++) {
    reportData.push(summaryRows[s]);
  }

  // Create header row with serial number column: #, Seat, Name, Percent, Present, Absent, Leave
  var headers = ["#", "Seat", "Name", "Percent", "Present", "Absent", "Leave"];

  // Add date columns with compact formatting
  for (var i = 0; i < validDates.length; i++) {
    headers.push(formatCompactDate(validDates[i]));
  }

  reportData.push(headers);

  // Add student rows with serial number column
  for (var j = 0; j < studentStats.length; j++) {
    var student = studentStats[j];
    var row = [
      j + 1, // Serial number starting from 1
      student.seat,
      student.name,
      student.percentage,
      student.present,
      student.absent, // Moved before leave
      student.leave, // Moved after absent
    ];

    // Add daily status for each date
    for (var k = 0; k < validDates.length; k++) {
      var date = validDates[k];
      var status = student.dailyStatus[date] || "";

      // Convert status codes to readable format for display
      if (status === "P") {
        row.push("Present");
      } else if (status === "L") {
        row.push("Leave");
      } else if (status === "A") {
        row.push("Absent");
      } else {
        row.push(""); // Empty for dates before first appearance
      }
    }

    reportData.push(row);
  }

  return reportData;
}

/**
 * Transforms attendance status display format for date columns
 * Converts full words to single letters: Present -> P, Absent -> A, Leave -> L
 * @param {Array} reportData - 2D array of report data
 * @return {Array} Transformed 2D array with single letter status codes in date columns
 */
function transformAttendanceDisplay(reportData) {
  if (reportData.length === 0) return reportData;

  var transformedData = [];

  // Copy header row as-is
  transformedData.push(reportData[0].slice());

  // Transform student rows (skip header row)
  for (var i = 1; i < reportData.length; i++) {
    var originalRow = reportData[i];
    var transformedRow = [];

    // Copy first 7 columns as-is (#, Seat, Name, Percentage, Present, Absent, Leave)
    for (var j = 0; j < 7; j++) {
      transformedRow.push(originalRow[j]);
    }

    // Transform date columns (columns 8 onwards) - convert full words to single letters
    for (var k = 7; k < originalRow.length; k++) {
      var status = originalRow[k];

      if (status === "Present") {
        transformedRow.push("P");
      } else if (status === "Absent") {
        transformedRow.push("A");
      } else if (status === "Leave") {
        transformedRow.push("L");
      } else {
        transformedRow.push(status); // Keep empty strings or other values as-is
      }
    }

    transformedData.push(transformedRow);
  }

  return transformedData;
}

/**
 * Writes the report data to a new sheet named "Report"
 * @param {Array} reportData - 2D array of formatted report data
 * @param {String} title - Title for the sheet
 * @param {String} sortOption - Sort option for the data
 * @param {String} spreadsheetId - ID of the spreadsheet to write to
 */
function writeReportToSheet(reportData, title, sortOption, spreadsheetId) {
  var ss = SpreadsheetApp.openById(spreadsheetId);

  // Get or create the report sheet using title as sheet name
  var reportSheet = ss.getSheetByName(title);
  if (reportSheet) {
    reportSheet.clear();
  } else {
    reportSheet = ss.insertSheet(title);
  }

  // Sort the data based on sortOption before transforming
  var sortedData = sortReportData(reportData, sortOption);

  // Transform the data to show single letters in date columns
  var transformedData = transformAttendanceDisplay(sortedData);

  // Write the data starting from row 2 to leave space for title
  if (transformedData.length > 0 && transformedData[0].length > 0) {
    var range = reportSheet.getRange(
      2,
      1,
      transformedData.length,
      transformedData[0].length
    );
    range.setValues(transformedData);

    // Apply formatting
    formatReportSheet(reportSheet, transformedData, title);
  }
}

/**
 * Applies formatting to the report sheet
 * @param {Sheet} reportSheet - The report sheet object
 * @param {Array} reportData - The report data for reference
 */
function formatReportSheet(reportSheet, reportData, title) {
  if (reportData.length === 0) return;

  var numRows = reportData.length;
  var numCols = reportData[0].length;

  // Add title in row 1, column B (will be merged later)
  reportSheet.getRange(1, 2).setValue(title);
  reportSheet.getRange(1, 1, 1, numCols).setFontWeight("bold");
  reportSheet.getRange(1, 1, 1, numCols).setFontSize(12);

  // Make rows 2-6 bold (4 summary rows + 1 header row, adjusted for title)
  reportSheet.getRange(2, 1, 5, numCols).setFontWeight("bold");

  // Set header background color (row 6) - black background with white text
  reportSheet.getRange(6, 1, 1, numCols).setBackground("#000000");
  reportSheet.getRange(6, 1, 1, numCols).setFontColor("#ffffff");

  // Set text wrapping for header row 6, columns 4-7 (Percent, Present, Absent, Leave)
  reportSheet.getRange(6, 4, 1, 4).setWrap(true);

  // Set vertical alignment to middle for header row 6
  reportSheet.getRange(6, 1, 1, numCols).setVerticalAlignment("middle");

  // Add borders to all cells (including title row and data)
  reportSheet
    .getRange(1, 1, numRows + 1, numCols)
    .setBorder(true, true, true, true, true, true);

  // Set column widths FIRST - this is critical!
  // Column A (#): auto-resize to fit text
  reportSheet.autoResizeColumns(1, 1);

  // Columns B-D (Seat, Name, Percent): auto-resize to fit text
  reportSheet.autoResizeColumns(2, 3);

  // Columns E-G (Present, Absent, Leave): width of 33
  reportSheet.setColumnWidths(5, 3, 33);

  // Remaining columns (date columns): auto-resize to fit text
  if (numCols > 7) {
    reportSheet.autoResizeColumns(8, numCols - 7);
  }

  // Format summary rows (rows 2-5) as integers for numeric values
  // Total Days value in C2 (now column 3 due to serial number column)
  reportSheet.getRange(2, 3, 1, 1).setNumberFormat("0");

  // Daily Present, Absent, Leave values in date columns (columns 8 onwards)
  if (numCols > 7) {
    reportSheet.getRange(3, 8, 3, numCols - 7).setNumberFormat("0");
  }

  // Format percentage column with % sign (column 4, starting from row 7)
  if (numRows > 5) {
    reportSheet.getRange(7, 4, numRows - 5, 1).setNumberFormat('0"%"');
  }

  // Format date columns in header
  if (numCols > 7) {
    reportSheet.getRange(6, 8, 1, numCols - 7).setNumberFormat("ddd, mmm dd");
  }

  // Apply row banding only to student data rows (starting from row 7)
  if (numRows > 5) {
    reportSheet
      .getRange(7, 1, numRows - 5, numCols)
      .applyRowBanding(SpreadsheetApp.BandingTheme.GREY, false, false);
  }

  // Set frozen rows and columns AFTER all other formatting
  // Freeze header row (now at row 6 since we have title + 4 summary rows)
  reportSheet.setFrozenRows(6);

  // Freeze first 7 columns (#, Seat, Name, Percent, Present, Absent, Leave)
  reportSheet.setFrozenColumns(7);

  // NOW do the final steps: merge cells and set alignment
  // IMPORTANT: Do this AFTER all column widths are set!

  // Merge title from A1 to G1 (columns 1-7) and center align
  reportSheet.getRange(1, 1, 1, 7).merge(); // A1:G1 - Title (6 columns: B,C,D,E,F,G)
  reportSheet.getRange(1, 1, 1, 7).setHorizontalAlignment("center");

  // Merge cells for summary rows (keep existing A-B merges)
  reportSheet.getRange(2, 1, 1, 2).merge(); // A2:B2 - Total Days
  reportSheet.getRange(3, 1, 1, 2).merge(); // A3:B3 - Students Present
  reportSheet.getRange(4, 1, 1, 2).merge(); // A4:B4 - Students Absent
  reportSheet.getRange(5, 1, 1, 2).merge(); // A5:B5 - Students on Leave

  reportSheet.autoResizeColumns(2, 2);
}

// Legacy function for backward compatibility
function pivotAttendanceData() {
  mainGenerateAttendanceReport();
}

// Backward compatibility - keep the old function name as well
function generateAttendanceReport() {
  mainGenerateAttendanceReport();
}

/**
 * Sorts report data based on the specified sort option
 * @param {Array} reportData - 2D array of report data
 * @param {String} sortOption - Sort option: "seat", "percentage", or default to seat
 * @return {Array} Sorted 2D array of report data
 */
function sortReportData(reportData, sortOption) {
  if (reportData.length <= 5) return reportData; // No student data to sort

  var sortedData = [];

  // Copy summary rows (first 4 rows) and header row (5th row)
  for (var i = 0; i < 5; i++) {
    sortedData.push(reportData[i].slice());
  }

  // Extract student rows (from row 6 onwards)
  var studentRows = [];
  for (var j = 5; j < reportData.length; j++) {
    studentRows.push(reportData[j].slice());
  }

  // Sort student rows based on sortOption
  if (sortOption === "percentage") {
    // Sort by percentage column (index 3, was 2 before serial number column) in descending order
    studentRows.sort(function (a, b) {
      var percentageA = parseFloat(a[3]) || 0;
      var percentageB = parseFloat(b[3]) || 0;
      return percentageB - percentageA; // Descending order
    });
  }
  // For "seat" or any other option, keep original order (already sorted by seat)

  // Re-number the serial numbers after sorting
  for (var k = 0; k < studentRows.length; k++) {
    studentRows[k][0] = k + 1; // Update serial number column (index 0)
  }

  // Add sorted student rows back to the data
  for (var l = 0; l < studentRows.length; l++) {
    sortedData.push(studentRows[l]);
  }

  return sortedData;
}

/**
 * Downloads the attendance report sheet as a PDF
 * @param {String} sheetName - Name of the sheet to download as PDF
 * @param {String} folderPath - Optional: Google Drive folder path to save PDF (e.g., "Reports/2025")
 */
/**
 * Downloads a specific sheet as PDF and saves it to Google Drive
 * @param {String} sheetName - Name of the sheet to export as PDF
 * @param {String} folderPath - Path where to save the PDF (creates folders if they don't exist)
 * @param {String} spreadsheetId - ID of the spreadsheet containing the sheet
 * @return {Object} Object containing PDF file information
 */
function downloadSheetAsPDF(sheetName, folderPath, spreadsheetId) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error('Sheet "' + sheetName + '" not found');
    }

    // Get the sheet ID
    var sheetId = sheet.getSheetId();

    // Set up PDF export parameters
    var url =
      "https://docs.google.com/spreadsheets/d/" + ss.getId() + "/export?";
    var params = {
      format: "pdf",
      size: "A4", // Page size A4
      portrait: "false", // Landscape orientation
      fitw: "true", // Fit to width
      sheetnames: "false", // Don't show sheet names
      printtitle: "false", // Don't print title
      pagenumbers: "true", // Show page numbers
      gridlines: "false", // Don't show gridlines (we have borders)
      fzr: "true", // Repeat frozen rows on each page
      gid: sheetId, // Specific sheet ID
      scale: "2", // Scale: 1=Normal, 2=Fit to width, 3=Fit to height, 4=Fit to page
      top_margin: "0.5", // Narrow margins
      bottom_margin: "0.5",
      left_margin: "0.5",
      right_margin: "0.5",
      horizontal_alignment: "CENTER",
      vertical_alignment: "TOP",
    };

    // Build the URL with parameters
    var paramString = Object.keys(params)
      .map(function (key) {
        return key + "=" + params[key];
      })
      .join("&");

    var fullUrl = url + paramString;

    // Get the PDF blob
    var response = UrlFetchApp.fetch(fullUrl, {
      headers: {
        Authorization: "Bearer " + ScriptApp.getOAuthToken(),
      },
    });

    var blob = response.getBlob();
    blob.setName(sheetName + ".pdf");

    // Save to specified folder or root folder
    var file;
    if (folderPath) {
      var folder = getOrCreateFolder(folderPath);
      file = folder.createFile(blob);
    } else {
      // Save to Drive root folder (default behavior)
      file = DriveApp.createFile(blob);
    }

    Logger.log("PDF created successfully: " + file.getName());
    Logger.log("File ID: " + file.getId());
    Logger.log("Folder: " + (folderPath || "Root"));
    Logger.log("Download URL: " + file.getDownloadUrl());

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
 * Helper function to get or create a folder path in Google Drive
 * @param {String} folderPath - Folder path (e.g., "Reports/2025" or "My Folder/Subfolder")
 * @return {Folder} Google Drive folder object
 */
function getOrCreateFolder(folderPath) {
  var folders = folderPath.split("/");
  var currentFolder = DriveApp.getRootFolder();

  for (var i = 0; i < folders.length; i++) {
    var folderName = folders[i].trim();
    if (folderName === "") continue; // Skip empty folder names

    var subFolders = currentFolder.getFoldersByName(folderName);
    if (subFolders.hasNext()) {
      // Folder exists, use it
      currentFolder = subFolders.next();
    } else {
      // Folder doesn't exist, create it
      currentFolder = currentFolder.createFolder(folderName);
    }
  }

  return currentFolder;
}

/**
 * Enhanced main function that also generates PDFs
 */
function mainGenerateAttendanceReportWithPDF(
  title,
  dateRange,
  sort,
  sourceSheetName,
  spreadsheetId,
  pdfFolderPath,
  deleteSheets
) {
  try {
    // Default PDF folder path if not provided
    pdfFolderPath = pdfFolderPath || "Attendance Reports";
    deleteSheets = deleteSheets || false;

    // Step 1: Get raw data from the source sheet
    var rawData = getRawData(sourceSheetName, spreadsheetId);

    // Step 2: Process the attendance data
    var processedData = processAttendanceData(rawData, dateRange);

    var pdfsGenerated = [];
    var sheetsToDelete = [];

    // Step 3: Write the report to sheet(s) and apply all formatting FIRST
    if (sort === "both") {
      // Generate two sheets with complete formatting
      var seatSheetName = title + " - Seat";
      var percentageSheetName = title + " - Percentage";

      writeReportToSheet(processedData, seatSheetName, "seat", spreadsheetId);
      writeReportToSheet(
        processedData,
        percentageSheetName,
        "percentage",
        spreadsheetId
      );

      // Force Google Sheets to complete all formatting operations
      SpreadsheetApp.flush();

      // Track sheets for potential deletion
      if (deleteSheets) {
        sheetsToDelete.push(seatSheetName);
        sheetsToDelete.push(percentageSheetName);
      }

      // Generate PDFs AFTER formatting is complete
      var seatPdf = downloadSheetAsPDF(
        seatSheetName,
        pdfFolderPath,
        spreadsheetId
      );
      var percentagePdf = downloadSheetAsPDF(
        percentageSheetName,
        pdfFolderPath,
        spreadsheetId
      );

      pdfsGenerated.push(seatPdf);
      pdfsGenerated.push(percentagePdf);
    } else {
      // Generate single sheet with complete formatting
      writeReportToSheet(processedData, title, sort, spreadsheetId);

      // Force Google Sheets to complete all formatting operations
      SpreadsheetApp.flush();

      // Track sheet for potential deletion
      if (deleteSheets) {
        sheetsToDelete.push(title);
      }

      // Generate PDF AFTER formatting is complete
      var pdf = downloadSheetAsPDF(title, pdfFolderPath, spreadsheetId);
      pdfsGenerated.push(pdf);
    }

    // Delete sheets if requested (PDF only mode)
    if (deleteSheets && sheetsToDelete.length > 0) {
      var ss = SpreadsheetApp.openById(spreadsheetId);

      for (var i = 0; i < sheetsToDelete.length; i++) {
        var sheetName = sheetsToDelete[i];
        var sheet = ss.getSheetByName(sheetName);

        if (sheet) {
          ss.deleteSheet(sheet);
          Logger.log("Deleted sheet: " + sheetName);
        }
      }

      Logger.log("Deleted " + sheetsToDelete.length + " temporary sheet(s)");
    }

    Logger.log("Attendance report with PDF generated successfully!");
    Logger.log("PDFs generated: " + pdfsGenerated.length);

    return pdfsGenerated;
  } catch (error) {
    Logger.log(
      "Error generating attendance report with PDF: " + error.toString()
    );
    throw error;
  }
}

/**
 * Master controller function for attendance report generation
 * Controls whether to generate sheets only, PDFs only, or both
 * @param {String} title - Title for the report
 * @param {Object} dateRange - Object with startDate and endDate
 * @param {String} sort - Sort option: "seat", "percentage", or "both"
 * @param {String} pdf - PDF option: "no", "only", or "both"
 * @param {String} sourceSheetName - Name of the source sheet to read data from
 * @param {String} spreadsheetId - ID of the spreadsheet to work with
 * @param {String} pdfFolderPath - Optional: Google Drive folder path to save PDF
 */
function mainAttendanceController(
  title,
  dateRange,
  sort,
  pdf,
  sourceSheetName,
  spreadsheetId,
  pdfFolderPath
) {
  try {
    // Default values if not provided
    title = title || "Attendance Report";
    dateRange = dateRange || {
      startDate: "2025-09-01",
      endDate: "2025-09-30",
    };
    sort = sort || "both";
    pdf = pdf || "no";
    sourceSheetName = sourceSheetName || "Sheet1";
    spreadsheetId =
      spreadsheetId || SpreadsheetApp.getActiveSpreadsheet().getId();
    pdfFolderPath = pdfFolderPath || "Attendance Reports";

    // Validate pdf parameter
    if (pdf !== "no" && pdf !== "only" && pdf !== "both") {
      throw new Error('PDF parameter must be "no", "only", or "both"');
    }

    // Execute based on pdf option
    if (pdf === "no") {
      // Generate sheets only
      mainGenerateAttendanceReport(
        title,
        dateRange,
        sort,
        sourceSheetName,
        spreadsheetId
      );
    } else if (pdf === "only") {
      // Generate PDFs only and delete sheets after
      mainGenerateAttendanceReportWithPDF(
        title,
        dateRange,
        sort,
        sourceSheetName,
        spreadsheetId,
        pdfFolderPath, // Use the provided PDF folder path
        true // deleteSheets - new parameter
      );
    } else if (pdf === "both") {
      // Generate both sheets and PDFs
      mainGenerateAttendanceReport(
        title,
        dateRange,
        sort,
        sourceSheetName,
        spreadsheetId
      );
      mainGenerateAttendanceReportWithPDF(
        title,
        dateRange,
        sort,
        sourceSheetName,
        spreadsheetId,
        pdfFolderPath // Use the provided PDF folder path
      );
    }

    Logger.log("Attendance report generation completed successfully!");
  } catch (error) {
    Logger.log("Error in attendance controller: " + error.toString());
    throw error;
  }
}
