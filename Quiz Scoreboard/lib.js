// =============================================================================
// HELPERS
// =============================================================================

function processSheetData(data, quizName, emailMap, settings) {
  let studentScores = {};

  // Sort rows chronologically so the time-gap rule is applied correctly
  // regardless of the order rows appear in the source sheet
  const rows = data.slice(1).sort((a, b) => new Date(a[0]) - new Date(b[0]));

  for (let i = 0; i < rows.length; i++) {
    let timestamp = new Date(rows[i][0]);
    let email = rows[i][1];
    let score = parseInt(rows[i][2], 10);
    let studentId = emailMap[email] ? emailMap[email].seat : "Unknown";
    let studentName = emailMap[email] ? emailMap[email].name : "Unknown";

    if (!studentScores[email]) {
      studentScores[email] = [];
    }

    // Detect malformed or missing score cells
    if (isNaN(score)) {
      Logger.log(
        `Malformed score in "${quizName}" for ${email} at ${timestamp}: "${rows[i][2]}"`,
      );
      studentScores[email].push({
        studentId,
        studentName,
        email,
        quizName,
        timestamp,
        score: 0,
        isValid: false,
        reason: "Score missing or malformed",
      });
      continue;
    }

    let isValid = score >= settings.minimumScore;
    let reason = isValid ? "" : "Score below minimum";

    if (isValid && studentScores[email].length > 0) {
      const lastValidAttempt = studentScores[email]
        .filter((attempt) => attempt.isValid)
        .pop();

      if (
        lastValidAttempt &&
        timestamp - lastValidAttempt.timestamp < settings.timeBetweenAttempts
      ) {
        isValid = false;
        reason = "Valid attempt too soon after previous valid attempt";
      }
    }

    studentScores[email].push({
      studentId,
      studentName,
      email,
      quizName,
      timestamp,
      score,
      isValid,
      reason,
    });
  }

  return studentScores;
}

function transformData(originalData, settings) {
  const transformedData = {};
  const allSheetNames = Object.keys(originalData);

  allSheetNames.forEach((sheetName) => {
    Object.keys(originalData[sheetName]).forEach((email) => {
      if (!transformedData[email]) {
        transformedData[email] = {};
      }

      const validScores = originalData[sheetName][email]
        .filter((entry) => entry.isValid)
        .map((entry) => entry.score)
        .sort((a, b) => b - a); // highest scores first

      const sum = validScores
        .slice(0, settings.requiredAttempts)
        .reduce((total, score) => total + score, 0);

      transformedData[email][sheetName] = sum;
    });
  });

  // Add missing sheets to emails
  Object.keys(transformedData).forEach((email) => {
    allSheetNames.forEach((sheetName) => {
      if (!transformedData[email][sheetName]) {
        transformedData[email][sheetName] = 0;
      }
    });
  });

  return transformedData;
}

function sheetDataToJson(sheetId, sheetName) {
  const spreadsheet = SpreadsheetApp.openById(sheetId);
  const sheet = spreadsheet.getSheetByName(sheetName);
  const range = sheet.getDataRange();
  let values = range.getValues();

  values.shift(); // Remove header row
  values.sort((a, b) => a[1].localeCompare(b[1])); // Sort by name

  const jsonData = {};

  values.forEach((row) => {
    const [email, name, seatNumber, className] = row;
    jsonData[email] = {
      name: name,
      seat: seatNumber,
      class: className,
      email: email,
    };
  });

  return jsonData;
}

function naturalSort(a, b) {
  const collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
  });
  return collator.compare(a, b);
}

function ensureColumns(sheet, columnIndex, numColumns) {
  const totalColumnsNeeded = columnIndex + numColumns - 1;
  const currentColumnCount = sheet.getMaxColumns();

  if (totalColumnsNeeded > currentColumnCount) {
    const columnsToAdd = totalColumnsNeeded - currentColumnCount;
    sheet.insertColumnsAfter(currentColumnCount, columnsToAdd);
  }

  return sheet.getRange(1, columnIndex, 1, numColumns);
}

// =============================================================================
// WRITE RESULT TO SHEETS
// =============================================================================

function writeResultToSheets(
  data,
  studentMap,
  outputSpreadsheetId,
  outputSheetName,
  settings,
  quizNames,
) {
  Logger.log(`Writing output to ${outputSheetName}`);
  try {
    const spreadsheet = SpreadsheetApp.openById(outputSpreadsheetId);
    const sheet =
      spreadsheet.getSheetByName(outputSheetName) ||
      spreadsheet.insertSheet(outputSheetName);

    sheet.clear();

    // Quiz names come from the source sheet tabs so that quizzes with zero
    // attempts still appear as columns
    const quizzes = quizNames.slice().sort(naturalSort);
    const headerTitle = ["Name", "Seat", "Status", "Total"];
    const totalCols = headerTitle.length + quizzes.length;

    // --- Header row ---
    ensureColumns(sheet, 1, totalCols);
    const headerRange = sheet.getRange(1, 1, 1, totalCols);
    headerRange.setValues([[...headerTitle, ...quizzes]]);
    headerRange.setFontWeight("bold");
    headerRange.setHorizontalAlignment("center");

    // Set quiz column widths and enable text wrapping on their headers
    for (let i = headerTitle.length + 1; i <= totalCols; i++) {
      sheet.setColumnWidth(i, 80);
    }
    sheet.getRange(1, headerTitle.length + 1, 1, quizzes.length).setWrap(true);

    // --- Build all student rows in memory before touching the sheet ---
    const students = Object.values(studentMap);
    const quizColFmt = `0" / ${settings.maximumScore * settings.requiredAttempts}"`;
    const totalFmt = `0" / ${settings.maximumScore * settings.requiredAttempts * quizzes.length}"`;

    const valueGrid = [];
    const bgGrid = [];
    const fmtGrid = [];

    students.forEach((student) => {
      const studentRecord = data[student.email];
      let maxAttempt = 0,
        mediumAttempt = 0,
        zeroAttempt = 0,
        marks = 0;
      const quizValues = [];
      const quizBgs = [];

      quizzes.forEach((quiz) => {
        const value = !studentRecord ? 0 : studentRecord[quiz] || 0;
        marks += value;

        let bg = null;
        if (value >= settings.minimumScore * settings.requiredAttempts) {
          bg = "#90ee90";
          maxAttempt++;
        } else if (value >= settings.minimumScore) {
          bg = "#ffff99";
          mediumAttempt++;
        } else {
          zeroAttempt++;
        }

        quizValues.push(value);
        quizBgs.push(bg);
      });

      // Determine status label and colour
      let status = "",
        statusBg = null;
      if (maxAttempt === quizzes.length) {
        status = "Perfect";
        statusBg = "#90ee90";
      } else if (maxAttempt + mediumAttempt === quizzes.length) {
        status = "Almost there";
        statusBg = "#C39BD3";
      } else if (zeroAttempt === quizzes.length) {
        status = "🤡";
        statusBg = "#FFCCCC";
      } else if (maxAttempt + mediumAttempt >= zeroAttempt) {
        status = "Attempt all quizzes";
        statusBg = "#F8C471";
      } else {
        status = "Put in more efforts";
        statusBg = "#ffff99";
      }

      valueGrid.push([
        student.name,
        student.seat,
        status,
        marks,
        ...quizValues,
      ]);
      bgGrid.push([null, null, statusBg, null, ...quizBgs]);
      fmtGrid.push([
        null,
        null,
        null,
        totalFmt,
        ...quizzes.map(() => quizColFmt),
      ]);
    });

    // --- Write all rows with three batched API calls ---
    if (valueGrid.length > 0) {
      const dataRange = sheet.getRange(2, 1, valueGrid.length, totalCols);
      dataRange.setValues(valueGrid);
      dataRange.setBackgrounds(bgGrid);
      dataRange.setNumberFormats(fmtGrid);
    }

    // --- Sort by Total (column 4) descending ---
    sheet.getDataRange().sort({ column: 4, ascending: false });

    // --- Auto-resize fixed columns ---
    for (let i = 1; i <= headerTitle.length; i++) {
      sheet.autoResizeColumn(i);
    }

    // --- Insert timestamp row at the very top ---
    sheet.insertRowBefore(1);
    sheet.getRange("A1").setValue("Result Calculated at:");
    sheet.getRange("B1").setValue(new Date());
    sheet.getRange("B1").setNumberFormat("MM/dd/yyyy HH:mm:ss");
    sheet
      .getRange("C1")
      .setFormula(`=TEXT(NOW()-B1, "[h] \\hour mm \\min a\\go")`);

    // --- Freeze timestamp row + header row together ---
    sheet.setFrozenRows(2);
  } catch (error) {
    Logger.log("Failed to open or write to spreadsheet: " + error.toString());
  }
}

// =============================================================================
// WRITE DETAILED RESULT TO SHEETS
// =============================================================================

function writeDetailedResultToSheets(
  data,
  outputSpreadsheetId,
  outputSheetName,
) {
  const spreadsheet = SpreadsheetApp.openById(outputSpreadsheetId);
  const sheet =
    spreadsheet.getSheetByName(outputSheetName) ||
    spreadsheet.insertSheet(outputSheetName);

  sheet.clear();

  const headers = [
    "Student ID",
    "Student Name",
    "Email",
    "Quiz Name",
    "Timestamp",
    "Score",
    "Valid",
    "Reason",
    "Last Attempt",
    "Time Since Last Attempt",
  ];

  // Set headers and format them
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight("bold");
  headerRange.setHorizontalAlignment("center");

  // Freeze only the first row
  sheet.setFrozenRows(1);

  let rowData = [];
  let lastAttempts = {};

  Object.keys(data).forEach((quizName) => {
    Object.keys(data[quizName]).forEach((email) => {
      // Sort attempts by timestamp
      const sortedAttempts = data[quizName][email].sort(
        (a, b) => a.timestamp - b.timestamp,
      );

      sortedAttempts.forEach((attempt, index) => {
        const lastAttemptTimestamp =
          index > 0 ? sortedAttempts[index - 1].timestamp : "";

        // Validate timestamp
        if (!attempt.timestamp) {
          Logger.log(
            `Empty timestamp found for ${attempt.email} in ${attempt.quizName}`,
          );
        }

        rowData.push([
          attempt.studentId,
          attempt.studentName,
          attempt.email,
          attempt.quizName,
          attempt.timestamp,
          attempt.score,
          attempt.isValid ? "Yes" : "No",
          attempt.reason,
          lastAttemptTimestamp,
          "", // Placeholder for Time Since Last Attempt
        ]);
      });

      // Update last attempt for this quiz and email
      lastAttempts[`${quizName}-${email}`] =
        sortedAttempts[sortedAttempts.length - 1].timestamp;
    });
  });

  if (rowData.length > 0) {
    const dataRange = sheet.getRange(2, 1, rowData.length, headers.length);
    dataRange.setValues(rowData);

    // Set number format for Score column
    sheet.getRange(2, 6, rowData.length, 1).setNumberFormat("#,##0");

    // Set date format for Timestamp and Last Attempt columns
    const timestampFormat = "ddd, yyyy-mm-dd hh:mm:ss";
    sheet.getRange(2, 5, rowData.length, 1).setNumberFormat(timestampFormat);
    sheet.getRange(2, 9, rowData.length, 1).setNumberFormat(timestampFormat);

    // Set formula for Time Since Last Attempt column
    for (let i = 2; i <= rowData.length + 1; i++) {
      sheet.getRange(i, 10).setFormula(
        `=IF(I${i}<>"",
          TEXT(INT((E${i}-I${i})), "0 ""days"", ") &
          TEXT(HOUR(E${i}-I${i}), "0 ""hours"", ") &
          TEXT(MINUTE(E${i}-I${i}), "0 ""min"""),
          "")`,
      );
    }
  }

  // Set all column widths to 150
  for (let i = 1; i <= headers.length; i++) {
    sheet.setColumnWidth(i, 150);
  }
}

// =============================================================================
// WRITE ATTEMPTS SUMMARY TO SHEET
// =============================================================================

function transformDataForAttempts(originalData) {
  const transformedData = {};
  const allSheetNames = Object.keys(originalData);

  allSheetNames.forEach((quizName) => {
    Object.keys(originalData[quizName]).forEach((email) => {
      if (!transformedData[email]) {
        transformedData[email] = {};
      }

      const attempts = originalData[quizName][email];
      const totalAttempts = attempts.length;
      const validAttempts = attempts.filter(
        (attempt) => attempt.isValid,
      ).length;

      // Store both total and valid attempts
      transformedData[email][quizName] = {
        total: totalAttempts,
        valid: validAttempts,
      };
    });
  });

  return transformedData;
}

function writeAttemptsSummaryToSheet(
  data,
  studentMap,
  outputSpreadsheetId,
  outputSheetName,
  settings,
  quizNames,
) {
  Logger.log(`Writing attempts to ${outputSheetName}`);
  try {
    const spreadsheet = SpreadsheetApp.openById(outputSpreadsheetId);
    const sheet =
      spreadsheet.getSheetByName(outputSheetName) ||
      spreadsheet.insertSheet(outputSheetName);

    sheet.clear();

    let columnIndex = 1;

    const headerTitle = ["Name", "Seat", "Status", "Total"];
    let headers = sheet.getRange(1, columnIndex, 1, headerTitle.length);
    headers.setValues([headerTitle]);
    headers.setFontWeight("bold");
    headers.setHorizontalAlignment("center");
    columnIndex += headerTitle.length;

    const quizzes = quizNames.slice().sort(naturalSort);

    headers = ensureColumns(sheet, columnIndex, quizzes.length);
    headers.setValues([quizzes]);
    headers.setFontWeight("bold");
    headers.setHorizontalAlignment("center");
    columnIndex += quizzes.length;

    let row = 2;

    Object.values(studentMap).forEach((student) => {
      sheet.getRange(row, 1).setValue(student.name);
      sheet.getRange(row, 2).setValue(student.seat);

      const studentRecord = data[student.email];
      let column = headerTitle.length + 1;

      let maxAttempt = 0;
      let mediumAttempt = 0;
      let zeroAttempt = 0;
      let totalValidAttempts = 0;
      let totalAttempts = 0;

      quizzes.forEach((quiz) => {
        if (!studentRecord || !studentRecord[quiz]) {
          sheet
            .getRange(row, column)
            .setValue(0)
            .setNumberFormat(`0" / ${settings.requiredAttempts}"`);
          zeroAttempt++;
          column++;
          return;
        }

        const quizData = studentRecord[quiz];
        const cell = sheet.getRange(row, column);
        cell.setValue(quizData.total);
        cell.setNumberFormat(`0" / ${settings.requiredAttempts}"`);

        if (quizData.valid >= settings.requiredAttempts) {
          cell.setBackground("#90ee90");
          maxAttempt++;
        } else if (quizData.valid > 1) {
          cell.setBackground("#ffff99");
          mediumAttempt++;
        } else {
          zeroAttempt++;
        }

        totalAttempts += quizData.total;
        totalValidAttempts += quizData.valid;
        column++;
      });

      // Set Status
      let statusCell = sheet.getRange(row, 3);
      if (maxAttempt === quizzes.length) {
        statusCell.setValue("Perfect");
        statusCell.setBackground("#90ee90");
      } else if (maxAttempt + mediumAttempt === quizzes.length) {
        statusCell.setValue("Almost there");
        statusCell.setBackground("#C39BD3");
      } else if (zeroAttempt === quizzes.length) {
        statusCell.setValue("🤡");
        statusCell.setBackground("#FFCCCC");
      } else if (
        maxAttempt + mediumAttempt + zeroAttempt === quizzes.length &&
        maxAttempt + mediumAttempt >= zeroAttempt
      ) {
        statusCell.setValue("Attempt all quizzes");
        statusCell.setBackground("#F8C471");
      } else if (
        maxAttempt + mediumAttempt + zeroAttempt === quizzes.length &&
        maxAttempt + mediumAttempt < zeroAttempt
      ) {
        statusCell.setValue("Put in more efforts");
        statusCell.setBackground("#ffff99");
      }

      // Set Total
      let totalCell = sheet.getRange(row, 4);
      totalCell.setValue(totalAttempts);
      totalCell.setNumberFormat(`0" / ${totalValidAttempts}"`);

      row++;
    });

    // Add timestamp
    sheet.insertRowBefore(1);
    sheet.getRange("A1").setValue("Attempts Calculated at:");
    sheet
      .getRange("B1")
      .setValue(new Date())
      .setNumberFormat("MM/dd/yyyy HH:mm:ss");
    sheet
      .getRange("C1")
      .setFormula(`=TEXT(NOW()-B1, "[h] \\hour mm \\min a\\go")`);
    sheet.setFrozenRows(2);

    // Sort by the total column in descending order
    let range = sheet.getRange(
      2,
      1,
      sheet.getLastRow() - 1,
      sheet.getLastColumn(),
    );
    range.sort({ column: 4, ascending: false });
  } catch (error) {
    Logger.log("Failed to open or write to spreadsheet: " + error.toString());
  }
}
