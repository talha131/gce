const CONFIG = {
  // --- Global settings ---
  // These apply to all classes unless a class defines its own value below.

  minimumScore: 16, // Score a student must reach for an attempt to count as valid (out of maximumScore)
  maximumScore: 20, // Highest possible score on a single quiz attempt
  requiredAttempts: 3, // Number of valid attempts a student needs to complete a quiz
  timeBetweenAttempts: 4 * 24 * 60 * 60 * 1000, // Minimum gap between two valid attempts (in milliseconds — currently 4 days)

  // --- Classes ---
  // Each entry represents one class with its own output Google Spreadsheet.
  // Add or remove entries here to manage classes. No other file needs to change.
  classes: [
    {
      name: "BEd 4 Year", // Shown in execution logs to identify which class is being processed
      outputSpreadsheetId: "1qntnqmchk81jz79Ega1k-y02h1ouSkCG0kZ0WY-MrDE", // ID of this class's output Google Spreadsheet (from its URL)
      mapSheetName: "Email Map", // Tab name of the sheet listing student emails, names, and seat numbers
      quizResultSheetName: "Quiz Result", // Tab name where the scoreboard will be written
      attemptDetailsSheetName: "Quiz Attempt Details", // Tab name where the detailed attempt log will be written
      attemptCountSheetName: "Attempt Report", // Tab name for the attempt count summary (currently unused)

      // Per-class overrides (optional):
      // If a class has different rules, uncomment the relevant lines and set the values.
      // Any value set here takes precedence over the global setting above.
      // minimumScore: 14,
      // maximumScore: 20,
      // requiredAttempts: 3,
      // timeBetweenAttempts: 3 * 24 * 60 * 60 * 1000,
    },

    // To add a new class, copy the block below, uncomment it, and fill in the values:
    // {
    //   name: "...",                               // Shown in execution logs to identify which class is being processed
    //   outputSpreadsheetId: "SPREADSHEET_ID_HERE", // ID of this class's output Google Spreadsheet (from its URL)
    //   mapSheetName: "Email Map",                 // Tab name of the sheet listing student emails, names, and seat numbers
    //   quizResultSheetName: "Quiz Result",        // Tab name where the scoreboard will be written
    //   attemptDetailsSheetName: "Quiz Attempt Details", // Tab name where the detailed attempt log will be written
    //   attemptCountSheetName: "Attempt Report",   // Tab name for the attempt count summary (currently unused)
    //
    //   // Per-class overrides (optional — remove any line you don't need to override):
    //   // minimumScore: 14,
    //   // maximumScore: 20,
    //   // requiredAttempts: 3,
    //   // timeBetweenAttempts: 3 * 24 * 60 * 60 * 1000,
    // },
  ],
};
