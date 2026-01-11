// Configuration: Define prefixes and their output spreadsheet IDs
var CONFIG = {
  prefixes: [
    {
      prefix: "A",
      spreadsheetId: "PASTE_SPREADSHEET_ID_FOR_A_PREFIX_HERE",
    },
    {
      prefix: "T",
      spreadsheetId: "PASTE_SPREADSHEET_ID_FOR_T_PREFIX_HERE",
    },
  ],
};

function pivotAttendanceData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sourceSheet = ss.getSheetByName(
    "Prof Talha - BEd 4 Year Semester 1 - Applications of ICT"
  );
  if (!sourceSheet) {
    throw new Error("Source sheet not found");
  }

  var data = sourceSheet.getDataRange().getValues();
  var headers = data.shift();
  var dateIndex = headers.indexOf("Date");
  var seatIndex = headers.indexOf("Seat");
  var nameIndex = headers.indexOf("Name");
  var statusIndex = headers.indexOf("Status");

  // Process each prefix configuration
  CONFIG.prefixes.forEach(function (config) {
    processPrefix(data, dateIndex, seatIndex, nameIndex, statusIndex, config);
  });
}

function processPrefix(
  data,
  dateIndex,
  seatIndex,
  nameIndex,
  statusIndex,
  config
) {
  var pivotedData = {};
  var allDates = new Set();
  var dailyTotals = {};

  // Process the data
  data.forEach((row) => {
    var seat = row[seatIndex];

    // Filter by prefix
    if (!seat.toString().startsWith(config.prefix)) {
      return;
    }

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
        dates: {},
      };
    }

    if (!dailyTotals[date.getTime()]) {
      dailyTotals[date.getTime()] = { present: 0, leave: 0, absent: 0 };
    }

    if (status === "Present") {
      pivotedData[seat].present++;
      dailyTotals[date.getTime()].present++;
    } else if (status === "Leave") {
      pivotedData[seat].leave++;
      dailyTotals[date.getTime()].leave++;
    } else {
      pivotedData[seat].absent++;
      dailyTotals[date.getTime()].absent++;
    }

    pivotedData[seat].dates[date.getTime()] = status || "";
  });

  // Prepare the output
  var sortedDates = Array.from(allDates).sort((a, b) => a - b);
  var totalDays = sortedDates.length;
  var outputHeaders = [
    "Seat",
    "Name",
    "Percentage",
    "Present",
    "Leave",
    "Absent",
  ].concat(sortedDates.map((d) => new Date(d)));

  var totalDaysRow = ["Total Days", totalDays, "", "", "", ""].concat(
    Array(sortedDates.length).fill("")
  );
  var headerRow = outputHeaders;
  var totalPresentRow = ["Daily Present", "", "", "", "", ""].concat(
    sortedDates.map((date) => dailyTotals[date].present)
  );
  var totalLeaveRow = ["Daily Leave", "", "", "", "", ""].concat(
    sortedDates.map((date) => dailyTotals[date].leave)
  );
  var totalAbsentRow = ["Daily Absent", "", "", "", "", ""].concat(
    sortedDates.map((date) => dailyTotals[date].absent)
  );

  var outputData = [
    totalDaysRow,
    totalPresentRow,
    totalLeaveRow,
    totalAbsentRow,
    headerRow,
  ];

  Object.values(pivotedData).forEach((student) => {
    var percentage = (student.present + student.leave) / totalDays;
    var row = [
      student.seat,
      student.name,
      percentage,
      student.present,
      student.leave,
      student.absent,
    ];
    sortedDates.forEach((date) => {
      row.push(student.dates[date] || "");
    });
    outputData.push(row);
  });

  // Write to the output spreadsheet for this prefix
  var outputSpreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  var reportSheet = outputSpreadsheet.getSheetByName("Report");
  if (reportSheet) {
    reportSheet.clear();
  } else {
    reportSheet = outputSpreadsheet.insertSheet("Report");
  }

  var range = reportSheet.getRange(
    1,
    1,
    outputData.length,
    outputData[0].length
  );
  range.setValues(outputData);

  // Freeze first 5 rows and make them bold
  reportSheet.setFrozenRows(5);
  reportSheet.getRange(1, 1, 5, outputData[0].length).setFontWeight("bold");

  // Freeze columns A to F
  reportSheet.setFrozenColumns(6);

  // Apply formatting
  reportSheet
    .getRange(1, 1, outputData.length, outputData[0].length)
    .applyRowBanding();

  // Set gray background for header row
  reportSheet.getRange(5, 1, 1, outputData[0].length).setBackground("#d9d9d9");

  // Remove gray background from first row
  reportSheet.getRange(1, 1, 1, outputData[0].length).setBackground("#f3f3f3");

  // Color students with >=80% attendance
  for (var i = 6; i <= outputData.length; i++) {
    var percentage = reportSheet.getRange(i, 3).getValue();
    if (percentage >= 0.8) {
      reportSheet.getRange(i, 1, 1, 3).setBackground("#c6e0b4");
    }
  }

  // Set percentage format
  reportSheet.getRange(6, 3, outputData.length - 5, 1).setNumberFormat("0.00%");

  // Set date format
  reportSheet
    .getRange(5, 7, outputData.length - 4, sortedDates.length)
    .setNumberFormat("ddd, mmm dd");

  // Set number format for daily totals
  reportSheet.getRange(2, 7, 3, sortedDates.length).setNumberFormat("0");

  // Sort by Seat column (A) after the headers
  reportSheet
    .getRange(6, 1, outputData.length - 5, outputData[0].length)
    .sort({ column: 1, ascending: true });
}
