function sendAssignmentEmails() {
  // ============================================================================
  // CONFIGURATION - Read from Config Sheet
  // ============================================================================
  const CONFIG_SHEET_NAME = "Config";

  const ui = SpreadsheetApp.getUi();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  // Get Config Sheet
  const configSheet = spreadsheet.getSheetByName(CONFIG_SHEET_NAME);

  if (!configSheet) {
    ui.alert(
      "❌ Error",
      `Config sheet "${CONFIG_SHEET_NAME}" not found!\n\nPlease create a sheet named "Config" with the following structure:\nA1: "Setting", B1: "Value"\nA2: "SHEET_NAME", B2: "Students"\nA3: "ASSIGNMENT_COLUMN", B3: "D"\nA4: "SEND_EMAILS", B4: "true"\nA5: "SENDER_NAME", B5: "Your Name"`,
      ui.ButtonSet.OK,
    );
    return;
  }

  // Read configuration values
  const configData = configSheet.getRange("A2:B10").getValues();
  const config = {};

  configData.forEach((row) => {
    if (row[0]) {
      config[row[0]] = row[1];
    }
  });

  // Extract config values
  const SHEET_NAME = config.SHEET_NAME || "Students";
  const assignmentColumn = (config.ASSIGNMENT_COLUMN || "")
    .toString()
    .trim()
    .toUpperCase();
  const SEND_EMAILS =
    config.SEND_EMAILS === true ||
    config.SEND_EMAILS === "true" ||
    config.SEND_EMAILS === "TRUE";
  const SENDER_NAME = config.SENDER_NAME || "";

  // Column indices (0-based)
  const COL_EMAIL = 0; // Column A
  const COL_NAME = 1; // Column B
  const COL_SEAT = 2; // Column C
  const COL_FIRST_ASSIGNMENT = 3; // Column D (first assignment column)
  const FIRST_DATA_ROW = 2; // Row 2 (row 1 has headers)

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  const sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    console.log(`⏸️ WAITING FOR USER: Sheet not found error dialog displayed`);
    ui.alert("❌ Error", `Sheet "${SHEET_NAME}" not found!`, ui.ButtonSet.OK);
    return;
  }

  // Validate assignment column
  if (!assignmentColumn) {
    console.log(
      `⏸️ WAITING FOR USER: Assignment column empty error dialog displayed`,
    );
    ui.alert(
      "❌ Error",
      `Config value "ASSIGNMENT_COLUMN" is empty! Please specify which assignment column to process (e.g., "D", "E", "F") in the Config sheet.`,
      ui.ButtonSet.OK,
    );
    return;
  }

  // Convert column letter to index (e.g., "D" -> 3, "E" -> 4)
  const assignmentColIndex = columnLetterToIndex(assignmentColumn);

  if (assignmentColIndex < COL_FIRST_ASSIGNMENT) {
    console.log(
      `⏸️ WAITING FOR USER: Invalid assignment column error dialog displayed`,
    );
    ui.alert(
      "❌ Error",
      `Invalid assignment column "${assignmentColumn}". Assignment columns should start from column D or later.`,
      ui.ButtonSet.OK,
    );
    return;
  }

  // ============================================================================
  // READ ASSIGNMENT HEADER (SUBJECT LINE)
  // ============================================================================
  const assignmentHeader = sheet.getRange(1, assignmentColIndex + 1).getValue(); // Row 1 contains headers

  if (!assignmentHeader) {
    console.log(
      `⏸️ WAITING FOR USER: Assignment header empty error dialog displayed`,
    );
    ui.alert(
      "❌ Error",
      `Assignment column ${assignmentColumn} (row 1) is empty! Please write the assignment name/subject in the header.`,
      ui.ButtonSet.OK,
    );
    return;
  }

  // ============================================================================
  // FIND MATCHING GMAIL DRAFT
  // ============================================================================
  const drafts = GmailApp.getDrafts();
  const matchingDrafts = drafts.filter(
    (d) => d.getMessage().getSubject() === assignmentHeader,
  );

  if (matchingDrafts.length === 0) {
    console.log(`⏸️ WAITING FOR USER: Draft not found dialog displayed`);
    ui.alert(
      "❌ Draft Not Found",
      `No Gmail draft found with subject:\n"${assignmentHeader}"\n\nPlease create a draft with this exact subject line.`,
      ui.ButtonSet.OK,
    );
    return;
  }

  if (matchingDrafts.length > 1) {
    console.log(`⏸️ WAITING FOR USER: Multiple drafts found dialog displayed`);
    ui.alert(
      "❌ Multiple Drafts Found",
      `Found ${matchingDrafts.length} drafts with subject:\n"${assignmentHeader}"\n\nPlease delete duplicate drafts and keep only one.`,
      ui.ButtonSet.OK,
    );
    return;
  }

  const draft = matchingDrafts[0];
  const msg = draft.getMessage();

  // Get the HTML content and convert emojis to HTML entities
  const rawBody = convertEmojisToEntities(msg.getBody());

  // Debug logging to verify conversion
  console.log(`📧 Draft subject: ${msg.getSubject()}`);
  console.log(
    `📝 Body preview (first 200 chars): ${rawBody.substring(0, 200)}`,
  );

  const { attachments, inlineImages } = extractDraftParts(msg); // Separates regular attachments from inline images

  // ============================================================================
  // GET STUDENT DATA
  // ============================================================================
  const lastRow = sheet.getLastRow();

  if (lastRow < FIRST_DATA_ROW) {
    console.log(`⏸️ WAITING FOR USER: No student data error dialog displayed`);
    ui.alert(
      "❌ Error",
      "No student data found in the sheet!",
      ui.ButtonSet.OK,
    );
    return;
  }

  const dataRange = sheet.getRange(
    FIRST_DATA_ROW,
    1,
    lastRow - FIRST_DATA_ROW + 1,
    assignmentColIndex + 1,
  );
  const data = dataRange.getValues();

  // Filter students who haven't been sent this assignment
  const studentsToEmail = [];
  const rowNumbers = [];

  data.forEach((row, index) => {
    const email = row[COL_EMAIL];
    const name = row[COL_NAME];
    const assignmentStatus = row[assignmentColIndex];

    // Skip if email is empty OR assignment already sent (true/TRUE)
    if (
      !email ||
      assignmentStatus === true ||
      assignmentStatus === "TRUE" ||
      assignmentStatus === "true"
    ) {
      return;
    }

    studentsToEmail.push({
      email: email,
      name: name,
      seat: row[COL_SEAT],
      originalRowNumber: FIRST_DATA_ROW + index,
    });
    rowNumbers.push(FIRST_DATA_ROW + index);
  });

  if (studentsToEmail.length === 0) {
    console.log(
      `⏸️ WAITING FOR USER: All students already sent dialog displayed`,
    );
    ui.alert(
      "✅ All Done",
      `All students have already received "${assignmentHeader}" or no valid email addresses found.`,
      ui.ButtonSet.OK,
    );
    return;
  }

  // ============================================================================
  // TEST REMINDER (LIVE MODE ONLY)
  // ============================================================================
  if (SEND_EMAILS) {
    console.log(
      `⏸️ WAITING FOR USER: Test reminder dialog displayed (LIVE MODE)`,
    );
    const testReminderResponse = ui.alert(
      "⚠️ Test Email Reminder",
      `Before sending to ${studentsToEmail.length} student(s), we recommend testing first.\n\n` +
        `Have you sent a test email to your alternate account to verify formatting, emojis, and placeholders?`,
      ui.ButtonSet.YES_NO,
    );

    if (testReminderResponse !== ui.Button.YES) {
      console.log("❌ User has not tested - operation cancelled");
      ui.alert(
        "❌ Cancelled",
        "Please send a test email to your alternate account first, then run the script again.",
        ui.ButtonSet.OK,
      );
      return;
    }
  }

  // ============================================================================
  // CONFIRMATION DIALOG
  // ============================================================================
  const modeText = SEND_EMAILS
    ? "LIVE MODE - Emails WILL be sent"
    : "TEST MODE - No emails will be sent";
  const confirmMessage =
    `${modeText}\n\n` +
    `You are about to ${SEND_EMAILS ? "send" : "simulate sending"}:\n\n` +
    `📧 Email Draft: "${assignmentHeader}"\n` +
    `👥 Recipients: ${studentsToEmail.length} student(s)\n` +
    `📝 Assignment Column: ${assignmentColumn}\n\n` +
    `Do you want to proceed?`;

  console.log(
    `⏸️ WAITING FOR USER: Confirmation dialog displayed (${modeText})`,
  );
  const response = ui.alert(
    SEND_EMAILS ? "⚠️ Confirm Email Send" : "🧪 Test Mode Confirmation",
    confirmMessage,
    ui.ButtonSet.YES_NO,
  );

  if (response !== ui.Button.YES) {
    console.log("❌ User cancelled the operation");
    ui.alert("❌ Cancelled", "Email sending cancelled.", ui.ButtonSet.OK);
    return;
  }

  // ============================================================================
  // SEND EMAILS
  // ============================================================================
  let successCount = 0;
  let failCount = 0;
  const errors = [];

  studentsToEmail.forEach((student, index) => {
    try {
      // PERSONALIZATION: Replace placeholders in Body and Subject (case-insensitive)
      let personalizedBody = rawBody;
      let personalizedSubject = assignmentHeader;

      // Replace {{Name}}, {{name}}, {{NAME}}, etc.
      personalizedBody = personalizedBody.replace(
        /\{\{name\}\}/gi,
        student.name || "Student",
      );
      personalizedBody = personalizedBody.replace(
        /\{\{seat\}\}/gi,
        student.seat || "N/A",
      );
      personalizedBody = personalizedBody.replace(
        /\{\{seatnumber\}\}/gi,
        student.seat || "N/A",
      );

      personalizedSubject = personalizedSubject.replace(
        /\{\{name\}\}/gi,
        student.name || "Student",
      );
      personalizedSubject = personalizedSubject.replace(
        /\{\{seat\}\}/gi,
        student.seat || "N/A",
      );
      personalizedSubject = personalizedSubject.replace(
        /\{\{seatnumber\}\}/gi,
        student.seat || "N/A",
      );

      // SENDING LOGIC
      if (SEND_EMAILS) {
        const emailOptions = {
          htmlBody: personalizedBody,
          attachments: attachments,
          inlineImages: inlineImages,
        };

        // Add sender name if specified in config
        if (SENDER_NAME) {
          emailOptions.name = SENDER_NAME;
        }

        GmailApp.sendEmail(student.email, personalizedSubject, "", emailOptions);

        // Mark as sent in the sheet (set to true)
        sheet
          .getRange(student.originalRowNumber, assignmentColIndex + 1)
          .setValue(true);

        successCount++;
        console.log(
          `✅ Sent to: ${student.name} (${student.email}) - ${index + 1}/${studentsToEmail.length}`,
        );

        // SAFETY DELAY: Wait between 2 to 6 seconds to avoid Gmail flagging
        if (index < studentsToEmail.length - 1) {
          // Don't delay after last email
          const delay = Math.floor(Math.random() * 4000) + 2000;
          Utilities.sleep(delay);
        }
      } else {
        console.log(
          `[TEST MODE] Would send to: ${student.name} (${student.email})`,
        );
        successCount++;
      }
    } catch (e) {
      failCount++;
      const errorMsg = `${student.name} (${student.email}): ${e.toString()}`;
      errors.push(errorMsg);
      console.error(`❌ Failed: ${errorMsg}`);
    }
  });

  // ============================================================================
  // COMPLETION SUMMARY
  // ============================================================================
  const completionTitle = SEND_EMAILS ? "🎉 Complete" : "🧪 Test Complete";
  let summaryMessage = SEND_EMAILS
    ? `📧 Email Sending Complete!\n\n`
    : `🧪 TEST MODE - No actual emails were sent!\n\nSimulation Complete:\n\n`;

  summaryMessage += `✅ Successful: ${successCount}\n❌ Failed: ${failCount}`;

  if (errors.length > 0) {
    summaryMessage += `\n\nErrors:\n${errors.slice(0, 5).join("\n")}`;
    if (errors.length > 5) {
      summaryMessage += `\n... and ${errors.length - 5} more (check logs)`;
    }
  }

  if (!SEND_EMAILS) {
    summaryMessage += `\n\n💡 To send real emails, set SEND_EMAILS to true in the Config sheet.`;
  }

  console.log(`⏸️ WAITING FOR USER: Completion dialog displayed`);
  ui.alert(completionTitle, summaryMessage, ui.ButtonSet.OK);
}

/**
 * Helper function to convert column letter to 0-based index
 * Examples: "A" -> 0, "B" -> 1, "D" -> 3, "Z" -> 25, "AA" -> 26
 */
function columnLetterToIndex(column) {
  let index = 0;
  for (let i = 0; i < column.length; i++) {
    index = index * 26 + (column.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Helper function to convert emojis and special characters to HTML entities
 * This fixes the issue where emojis appear as ������ in sent emails
 * Examples: 🎓 -> &#127891;, 🌐 -> &#127760;
 */
function convertEmojisToEntities(html) {
  let converted = "";
  let i = 0;

  while (i < html.length) {
    const code = html.codePointAt(i);

    // Convert characters outside standard ASCII range (likely emojis or special chars)
    // Normal ASCII is 0-127, extended range up to 255 can be kept
    // Anything above 255 should be converted to HTML entity
    if (code > 255) {
      converted += `&#${code};`;
      // Handle surrogate pairs (emojis use 2 characters in JavaScript strings)
      if (code > 0xffff) {
        i += 2;
      } else {
        i += 1;
      }
    } else {
      converted += html[i];
      i += 1;
    }
  }

  return converted;
}

/**
 * Extracts regular attachments and inline images separately from a Gmail draft message.
 *
 * The problem this solves: msg.getAttachments() returns everything (regular files AND
 * inline images) as one flat list. If you pass all of them as `attachments` in
 * GmailApp.sendEmail(), inline images lose their cid: binding in the HTML body and
 * render as broken placeholders. They also appear as unwanted file attachments.
 *
 * The fix: split them, then pass inline images via the `inlineImages` option instead,
 * which maps each content ID to its blob so the HTML <img src="cid:..."> references
 * resolve correctly in the recipient's email client.
 *
 * How cid: mapping works:
 *   - The draft HTML body contains <img src="cid:ii_abc123"> references.
 *   - The raw MIME source has a Content-ID: <ii_abc123> header on each inline part.
 *   - We extract those IDs from the raw MIME and map them to the blobs in order.
 *   - GmailApp.sendEmail() then wires them back into the HTML correctly.
 */
function extractDraftParts(msg) {
  const regularAttachments = msg.getAttachments({
    includeInlineImages: false,
    includeAttachments: true,
  });

  const inlineImageBlobs = msg.getAttachments({
    includeInlineImages: true,
    includeAttachments: false,
  });

  const inlineImages = {};

  if (inlineImageBlobs.length > 0) {
    // Extract Content-IDs from the raw MIME source.
    // Standard format is:  Content-ID: <some_id>
    // We strip the angle brackets to get the bare ID, which matches the cid: value in HTML.
    const rawMime = msg.getRawContent();
    const contentIds = [];
    const cidRegex = /Content-Id:\s*<([^>]+)>/gi;
    let match;
    while ((match = cidRegex.exec(rawMime)) !== null) {
      contentIds.push(match[1]);
    }

    // Map each inline blob to its content ID by position.
    // The order returned by getAttachments() matches the order of MIME parts.
    inlineImageBlobs.forEach((blob, index) => {
      if (index < contentIds.length) {
        inlineImages[contentIds[index]] = blob;
      } else {
        // Fallback: if Content-ID extraction misses one, use the blob name.
        // This is a safety net and should rarely be needed.
        inlineImages[blob.getName()] = blob;
      }
    });
  }

  return { attachments: regularAttachments, inlineImages };
}

/**
 * Creates a custom menu when the spreadsheet is opened
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("📧 Email Automation")
    .addItem("Send Assignment Emails", "sendAssignmentEmails")
    .addToUi();
}
