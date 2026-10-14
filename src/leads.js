// Visitor details are kept in this browser's storage (this device only).
// Open the site with #leads at the end of the address to see and download them.
// If VITE_SHEET_URL is set, every entry is also sent to the Google Sheet (see google-sheet.gs).

const KEY = 'legit-quiz-leads'
const SHEET_URL = import.meta.env.VITE_SHEET_URL

// text/plain + no-cors keeps this a "simple" request, which Apps Script accepts without CORS setup
function sendToSheet(lead) {
  if (!SHEET_URL) return
  fetch(SHEET_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(lead),
    keepalive: true,
  }).catch(() => {
    // offline or blocked: the entry is still kept on this device
  })
}

export function readLeads() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || []
  } catch {
    return []
  }
}

function writeLeads(leads) {
  try {
    localStorage.setItem(KEY, JSON.stringify(leads))
  } catch {
    // storage blocked or full: the quiz still works, the entry is just not kept
  }
}

export function addLead(name, phone, quiz) {
  const lead = { id: Date.now(), name, phone, time: new Date().toISOString(), quiz, score: '' }
  writeLeads([...readLeads(), lead])
  sendToSheet(lead)
  return lead
}

export function updateLead(id, patch) {
  const leads = readLeads().map((lead) => (lead.id === id ? { ...lead, ...patch } : lead))
  writeLeads(leads)
  const lead = leads.find((l) => l.id === id)
  if (lead) sendToSheet(lead)
}

export function clearLeads() {
  writeLeads([])
}

export function leadsCsv() {
  const cell = (value) => `"${String(value).replaceAll('"', '""')}"`
  const rows = readLeads().map((l) => [l.name, l.phone, l.quiz, l.score, new Date(l.time).toLocaleString()])
  return [['Name', 'Phone', 'Quiz', 'Score', 'Time'], ...rows].map((row) => row.map(cell).join(',')).join('\r\n')
}
