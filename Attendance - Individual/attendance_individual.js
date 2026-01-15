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

  var pivotedData = {};
  var allDates = new Set();
  var dailyTotals = {};

  // Process the data
  data.forEach((row) => {
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
        dates: {},
        firstAppearance: date.getTime(),
      };
    } else {
      // Update first appearance if current date is earlier
      if (date.getTime() < pivotedData[seat].firstAppearance) {
        pivotedData[seat].firstAppearance = date.getTime();
      }
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
    var totalActiveDays = student.present + student.absent;
    var percentage =
      totalActiveDays === 0 ? 0 : student.present / totalActiveDays;
    var row = [
      student.seat,
      student.name,
      percentage,
      student.present,
      student.leave,
      student.absent,
    ];
    sortedDates.forEach((date) => {
      // Skip dates before student's first appearance
      if (date < student.firstAppearance) {
        row.push("");
      } else {
        row.push(student.dates[date] || "");
      }
    });
    outputData.push(row);
  });

  // Write to the "Report" sheet
  var reportSheet = ss.getSheetByName("Report");
  if (reportSheet) {
    reportSheet.clear();
  } else {
    reportSheet = ss.insertSheet("Report");
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
