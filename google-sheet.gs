// Paste this into Extensions > Apps Script of your Google Sheet, then Deploy > New deployment > Web app
// (Execute as: Me, Who has access: Anyone). Put the web app URL in .env as VITE_SHEET_URL.

const HEADERS = ['ID', 'Time', 'Name', 'Phone', 'Product', 'Score']

function doPost(e) {
  const lock = LockService.getScriptLock()
  lock.waitLock(10000)
  try {
    const lead = JSON.parse(e.postData.contents)
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]
    if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS)

    const row = [
      String(lead.id),
      new Date(lead.time),
      lead.name,
      "'" + lead.phone, // keep the number as text so Sheets doesn't mangle it
      lead.quiz,
      lead.score ? "'" + lead.score : '', // "3/5" would otherwise turn into a date
    ]

    // a quiz start adds a row; finishing the quiz fills in the score on that same row
    const ids = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues().map((r) => String(r[0]))
    const index = ids.indexOf(String(lead.id))
    if (index === -1) sheet.appendRow(row)
    else sheet.getRange(index + 1, 1, 1, row.length).setValues([row])

    return ContentService.createTextOutput('ok')
  } finally {
    lock.releaseLock()
  }
}
