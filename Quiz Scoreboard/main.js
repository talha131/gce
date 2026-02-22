function main() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = spreadsheet.getSheets();

  // Load the email map for each class from its own output spreadsheet
  const classConfigs = CONFIG.classes.map((cls) => ({
    ...cls,
    emailMap: sheetDataToJson(cls.outputSpreadsheetId, cls.mapSheetName),
  }));

  // Merge all class email maps — used only to identify truly unknown emails
  const mergedEmailMap = {};
  classConfigs.forEach((cls) => {
    Object.assign(mergedEmailMap, cls.emailMap);
  });

  // Collect all output sheet names so we don't treat them as quiz attempt sheets
  const outputSheetNames = new Set();
  CONFIG.classes.forEach((cls) => {
    outputSheetNames.add(cls.attemptDetailsSheetName);
    outputSheetNames.add(cls.quizResultSheetName);
  });

  // Read all quiz attempt sheets once to avoid re-reading for each class
  const rawSheetData = {};
  sheets.forEach((sh) => {
    const sheetName = sh.getName();
    if (!outputSheetNames.has(sheetName)) {
      rawSheetData[sheetName] = sh.getDataRange().getValues();
    }
  });

  // Derive quiz names from the source sheet tabs (not from attempt data) so that
  // quizzes with zero attempts still appear as columns on the scoreboard
  const quizNames = Object.keys(rawSheetData).sort(naturalSort);

  // Find emails not in any class's email map (truly unknown students)
  const unknownEmails = new Set();
  Object.values(rawSheetData).forEach((sheetData) => {
    for (let i = 1; i < sheetData.length; i++) {
      const email = sheetData[i][1];
      if (email && !mergedEmailMap[email]) unknownEmails.add(email);
    }
  });

  // Process and write results for each class separately
  classConfigs.forEach((cls) => {
    Logger.log(`Writing results for ${cls.name}...`);

    // Resolve effective settings: class-specific value wins, global is the fallback
    const settings = resolveSettings(cls);

    // Process all quiz sheets using this class's email map and settings
    const classCompiledResult = {};
    Object.keys(rawSheetData).forEach((sheetName) => {
      classCompiledResult[sheetName] = processSheetData(
        rawSheetData[sheetName],
        sheetName,
        cls.emailMap,
        settings,
      );
    });

    // Scoreboard: registered students of this class only
    const scoreboardData = filterData(
      classCompiledResult,
      (email) => !!cls.emailMap[email],
    );
    const transformedData = transformData(scoreboardData, settings);

    // Detailed log: registered students + truly unknown emails (in every class)
    const detailData = filterData(
      classCompiledResult,
      (email) => !!cls.emailMap[email] || unknownEmails.has(email),
    );

    writeDetailedResultToSheets(
      detailData,
      cls.outputSpreadsheetId,
      cls.attemptDetailsSheetName,
    );

    writeResultToSheets(
      transformedData,
      cls.emailMap,
      cls.outputSpreadsheetId,
      cls.quizResultSheetName,
      settings,
      quizNames,
    );
  });
}

// Merges per-class settings with global defaults; class-specific values take precedence
function resolveSettings(cls) {
  return {
    minimumScore: cls.minimumScore ?? CONFIG.minimumScore,
    maximumScore: cls.maximumScore ?? CONFIG.maximumScore,
    requiredAttempts: cls.requiredAttempts ?? CONFIG.requiredAttempts,
    timeBetweenAttempts: cls.timeBetweenAttempts ?? CONFIG.timeBetweenAttempts,
  };
}

// Returns a copy of compiledResult containing only emails that pass the predicate
function filterData(compiledResult, emailPredicate) {
  const filtered = {};
  Object.keys(compiledResult).forEach((sheetName) => {
    filtered[sheetName] = {};
    Object.keys(compiledResult[sheetName]).forEach((email) => {
      if (emailPredicate(email)) {
        filtered[sheetName][email] = compiledResult[sheetName][email];
      }
    });
  });
  return filtered;
}
