function generateAttendanceReport() {
  // Constants for reuse across different sheets
  const teacherName = 'Prof Safdar Abbas';
  const classLabel = '2025 Evening - 2½Yr - Semester 1';
  const sourceSheetName = '2025 - 2½E - 1 - Prof Safdar - Teaching Literacy';
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sourceSheet = ss.getSheetByName(sourceSheetName);
  if (!sourceSheet) {
    throw new Error('Source sheet not found');
  }
  
  var data = sourceSheet.getDataRange().getValues();
  var headers = data.shift();
  var dateIndex = headers.indexOf('Date');
  var seatIndex = headers.indexOf('Seat');
  var nameIndex = headers.indexOf('Name');
  var statusIndex = headers.indexOf('Status');
  
  var pivotedData = {};
  var allDates = new Set();
  var dailyTotals = {};
  
  // Process the data
  data.forEach(row => {
    var seat = row[seatIndex];
    var name = row[nameIndex];
    var date = new Date(row[dateIndex]);
    var status = row[statusIndex];
    
    allDates.add(date.getTime());
    
    if (!pivotedData[seat]) {
      pivotedData[seat] = {
        seat: seat,
        name: name,
        present: 0,
        leave: 0,
        absent: 0,
        dates: {}
      };
    }
    
    if (!dailyTotals[date.getTime()]) {
      dailyTotals[date.getTime()] = { present: 0, leave: 0, absent: 0 };
    }
    
    if (status === 'Present') {
      pivotedData[seat].present++;
      dailyTotals[date.getTime()].present++;
    } else if (status === 'Leave') {
      pivotedData[seat].leave++;
      dailyTotals[date.getTime()].leave++;
    } else {
      pivotedData[seat].absent++;
      dailyTotals[date.getTime()].absent++;
    }
    
    pivotedData[seat].dates[date.getTime()] = status || '';
  });
  
  // Prepare the output
  var sortedDates = Array.from(allDates).sort((a, b) => a - b);
  var totalDays = sortedDates.length;
  var outputHeaders = ['Seat', 'Name', 'Percentage', 'Present', 'Leave', 'Absent'].concat(sortedDates.map(d => new Date(d)));
  
  var totalDaysRow = ['Total Days', totalDays, '', '', '', ''].concat(Array(sortedDates.length).fill(''));
  var headerRow = outputHeaders;
  var totalPresentRow = ['Daily Present', '', '', '', '', ''].concat(sortedDates.map(date => dailyTotals[date].present));
  var totalLeaveRow = ['Daily Leave', '', '', '', '', ''].concat(sortedDates.map(date => dailyTotals[date].leave));
  var totalAbsentRow = ['Daily Absent', '', '', '', '', ''].concat(sortedDates.map(date => dailyTotals[date].absent));
  
  var outputData = [totalDaysRow, totalPresentRow, totalLeaveRow, totalAbsentRow, headerRow];
  
  // Student data for full report
  var studentData = [];
  Object.values(pivotedData).forEach(student => {
    var percentage = (student.present + student.leave) / (student.present + student.leave + student.absent);
    var row = [
      student.seat,
      student.name,
      percentage,
      student.present,
      student.leave,
      student.absent
    ];
    sortedDates.forEach(date => {
      row.push(student.dates[date] || '');
    });
    studentData.push(row);
  });
  
  // Full report data with days
  var fullReportData = [...outputData, ...studentData];
  
  // Create Report-0 (full report with days)
  createDetailedReport('Report-0', fullReportData, teacherName, classLabel, totalDays, sortedDates.length);
  
  // Create Report-1 (summary without daily details)
  var report1Headers = ['Seat', 'Name', 'Percentage', 'Present', 'Leave', 'Absent'];
  var report1Data = [
    ['Teacher', teacherName, '', '', '', ''],
    ['Class', classLabel, '', '', '', ''],
    ['Total Days', totalDays, '', '', '', ''],
    report1Headers
  ];
  
  // Add student summary data without daily columns
  var summaryStudentData = studentData.map(row => row.slice(0, 6));
  report1Data = [...report1Data, ...summaryStudentData];
  
  // Create Report-1
  var report1Sheet = ss.getSheetByName('Report-1');
  if (report1Sheet) {
    report1Sheet.clear();
  } else {
    report1Sheet = ss.insertSheet('Report-1');
  }
  report1Sheet.getRange(1, 1, report1Data.length, report1Data[0].length).setValues(report1Data);
  applyBasicFormatting(report1Sheet, report1Data.length, 6, 4);
  
  // Create Report-2 (sorted by percentage)
  var report2Data = [...report1Data];
  var report2Sheet = ss.getSheetByName('Report-2');
  if (report2Sheet) {
    report2Sheet.clear();
  } else {
    report2Sheet = ss.insertSheet('Report-2');
  }
  report2Sheet.getRange(1, 1, report2Data.length, report2Data[0].length).setValues(report2Data);
  applyBasicFormatting(report2Sheet, report2Data.length, 6, 4);
  
  // Sort by percentage descending
  report2Sheet.getRange(5, 1, report2Data.length - 4, report2Data[0].length)
    .sort({column: 3, ascending: false});
}

// Helper function for creating the detailed report
function createDetailedReport(sheetName, outputData, teacherName, classLabel, totalDays, datesCount) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Insert teacher and class info at the top
  outputData.unshift(['Class', classLabel, '', '', '', ''].concat(Array(datesCount).fill('')));
  outputData.unshift(['Teacher', teacherName, '', '', '', ''].concat(Array(datesCount).fill('')));
  
  var reportSheet = ss.getSheetByName(sheetName);
  if (reportSheet) {
    reportSheet.clear();
  } else {
    reportSheet = ss.insertSheet(sheetName);
  }
  
  var range = reportSheet.getRange(1, 1, outputData.length, outputData[0].length);
  range.setValues(outputData);
  
  // Freeze first 7 rows (2 new rows + 5 existing) and make them bold
  reportSheet.setFrozenRows(7);
  reportSheet.getRange(1, 1, 7, outputData[0].length).setFontWeight('bold');
  
  // Freeze columns A to F
  reportSheet.setFrozenColumns(6);
  
  // Apply formatting
  reportSheet.getRange(1, 1, outputData.length, outputData[0].length).applyRowBanding();
  
  // Set gray background for header row
  reportSheet.getRange(7, 1, 1, outputData[0].length).setBackground('#d9d9d9');
  
  // Remove gray background from first rows
  reportSheet.getRange(1, 1, 2, outputData[0].length).setBackground('#f3f3f3');
  reportSheet.getRange(3, 1, 4, outputData[0].length).setBackground('#f3f3f3');
  
  // Color students with >=80% attendance
  for (var i = 8; i <= outputData.length; i++) {
    var percentage = reportSheet.getRange(i, 3).getValue();
    if (percentage >= 0.8) {
      reportSheet.getRange(i, 1, 1, 3).setBackground('#c6e0b4');
    }
  }
  
  // Set percentage format
  reportSheet.getRange(8, 3, outputData.length - 7, 1).setNumberFormat('0.00%');
  
  // Set date format
  reportSheet.getRange(7, 7, outputData.length - 6, datesCount).setNumberFormat('ddd, mmm dd');
  
  // Set number format for daily totals
  reportSheet.getRange(4, 7, 3, datesCount).setNumberFormat('0');

  // Sort by Seat column (A) after the headers
  reportSheet.getRange(8, 1, outputData.length - 7, outputData[0].length)
    .sort({column: 1, ascending: true});

console.log(sheetName)
  reportSheet.autoResizeColumn(2); // Auto-resize column B to fit content
}

// Helper function for basic formatting of summary reports
function applyBasicFormatting(sheet, rowCount, colCount, headerRow) {
  // Freeze header row and make it bold
  sheet.setFrozenRows(headerRow);
  sheet.getRange(1, 1, headerRow, colCount).setFontWeight('bold');
  
  // Freeze columns A to F
  sheet.setFrozenColumns(6);
  
  // Apply banding
  sheet.getRange(1, 1, rowCount, colCount).applyRowBanding();
  
  // Set gray background for header row
  sheet.getRange(headerRow, 1, 1, colCount).setBackground('#d9d9d9');
  
  // Remove gray background from info rows
  sheet.getRange(1, 1, headerRow-1, colCount).setBackground('#f3f3f3');
  
  // Color students with >=80% attendance
  for (var i = headerRow+1; i <= rowCount; i++) {
    var percentage = sheet.getRange(i, 3).getValue();
    if (percentage >= 0.8) {
      sheet.getRange(i, 1, 1, 3).setBackground('#c6e0b4');
    }
  }
  
  // Set percentage format
  sheet.getRange(headerRow+1, 3, rowCount - headerRow, 1).setNumberFormat('0.00%');
  sheet.autoResizeColumn(2); // Auto-resize column B to fit content
}
