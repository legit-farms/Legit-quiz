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

// Saves the final score and asks the sheet for this player's prize codes.
// Resolves to { eggCode, tourCode, expires } or throws if the codes could not be made.
export async function claimPrize(id, score) {
  const lead = readLeads().find((l) => l.id === id)
  if (!SHEET_URL || !lead) throw new Error('No sheet set up')
  const res = await fetch(SHEET_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...lead, score, action: 'prize' }),
  })
  const prize = await res.json()
  if (!prize.eggCode) throw new Error(prize.error || 'No code')
  const patch = { score, eggCode: prize.eggCode, tourCode: prize.tourCode }
  writeLeads(readLeads().map((l) => (l.id === id ? { ...l, ...patch } : l)))
  return prize
}

// One quiz per device: once someone finishes, their result (and prize) is kept here
// and shown again instead of letting them play another round.
const PLAYED_KEY = 'legit-quiz-played'

export function readPlayed() {
  try {
    return JSON.parse(localStorage.getItem(PLAYED_KEY))
  } catch {
    return null
  }
}

export function savePlayed(patch) {
  try {
    localStorage.setItem(PLAYED_KEY, JSON.stringify({ ...readPlayed(), ...patch }))
  } catch {
    // storage blocked: the lock just won't survive a reload
  }
}

export function clearLeads() {
  writeLeads([])
}

export function leadsCsv() {
  const cell = (value) => `"${String(value).replaceAll('"', '""')}"`
  const rows = readLeads().map((l) => [
    l.name,
    l.phone,
    l.quiz,
    l.score,
    l.eggCode || '',
    l.tourCode || '',
    new Date(l.time).toLocaleString(),
  ])
  return [['Name', 'Phone', 'Quiz', 'Score', 'Egg code', 'Tour code', 'Time'], ...rows].map((row) => row.map(cell).join(',')).join('\r\n')
}
