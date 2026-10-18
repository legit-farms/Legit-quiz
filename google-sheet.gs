// Paste this into Extensions > Apps Script of your Google Sheet, then Deploy > New deployment > Web app
// (Execute as: Me, Who has access: Anyone). Put the web app URL in .env as VITE_SHEET_URL.
//
// Prize codes: in Apps Script go to Project Settings > Script properties and add
//   SHOPIFY_STORE          by1utd-fv.myshopify.com
//   SHOPIFY_CLIENT_ID      client ID of your Shopify app (Dev Dashboard, scopes: write_discounts, read_discounts)
//   SHOPIFY_CLIENT_SECRET  client secret of that app
// (or SHOPIFY_TOKEN instead of the client ID/secret if you have an old-style shpat_ admin token)
//
// OTP: players get a code on WhatsApp (Meta WhatsApp Cloud API) before the quiz. Add these script properties too:
//   WHATSAPP_TOKEN         permanent token of a System User with whatsapp_business_messaging
//                          (Business Settings > Users > System users > Generate token)
//   WHATSAPP_PHONE_ID      Phone number ID (developers.facebook.com > your app > WhatsApp > API Setup)
//   WHATSAPP_TEMPLATE      name of an approved Authentication template with a "Copy code" button, e.g. quiz_otp
//   WHATSAPP_LANG          optional, the template's language code (default en)
//   WHATSAPP_WABA_ID       optional, WhatsApp Business Account ID (API Setup page), only for checkWhatsAppAccount
// The WhatsApp account needs a payment method (WhatsApp Manager > Payment settings), or Meta accepts
// the message and then silently drops it. To check the setup, run testWhatsApp, checkWhatsAppAccount, then testOtp.
// After changing this file, use Deploy > Manage deployments > Edit > New version so the live URL picks it up.
//
// Stats: run setupStats once from the editor. It builds the "Stats" tab (live formulas + charts)
// and starts an hourly check that marks which coupon codes were used on the website.

const HEADERS = ['ID', 'Time', 'Name', 'Phone', 'Product', 'Score', 'Coupon code', 'Tour code', 'Codes expire', 'Coupon used']

const TOUR_SCORE = 3 // same as TOUR_SCORE in src/App.jsx
const CODE_HOURS = 24
const COUPON_AMOUNT = '303' // ₹ off the whole order, works on any products
const COUPON_MIN_ORDER = '500' // ₹ the cart must reach before the coupon works
const MAX_PRIZES_PER_HOUR = 50 // safety cap: the web app URL is public, so stop anyone farming coupons
const SHOPIFY_API = '2026-07'
const GRAPH_API = 'v23.0' // Meta Graph API version for WhatsApp
const OTP_REQUIRED = false // same as otpEnabled in src/leads.js; while false, prizes don't need a verified number

function doPost(e) {
  let lead
  try {
    lead = JSON.parse(e.postData.contents)
  } catch (err) {
    return json({ error: 'Bad request' })
  }
  if (lead.object === 'whatsapp_business_account') return logWhatsAppStatus(lead)
  // OTP calls don't touch the sheet, so they skip the lock
  try {
    // while OTP is off nobody should be able to trigger (paid) WhatsApp messages
    if (lead.action === 'otp-send') return json(OTP_REQUIRED ? sendOtp(lead.phone) : { error: 'OTP is turned off' })
    if (lead.action === 'otp-check') return json(checkOtp(lead.phone, lead.code))
    if (lead.action === 'played') return json({ ok: true, played: validPhone(lead.phone) && hasPlayed(lead.phone) })
  } catch (err) {
    return json({ error: String(err.message || err) })
  }

  // anything else must be a real quiz entry; the URL is public, so junk is dropped instead of saved
  const phone = String(lead.phone || '')
  const score = /^\d{1,2}\/\d{1,2}$/.test(String(lead.score || '')) ? String(lead.score) : ''
  if (!/^\d{10,16}$/.test(String(lead.id)) || !validPhone(phone) || !lead.name || !lead.quiz) {
    return json({ error: 'Invalid entry' })
  }
  if (score) {
    const [right, total] = score.split('/').map(Number)
    if (right > total) return json({ error: 'Invalid entry' })
  }

  const lock = LockService.getScriptLock()
  lock.waitLock(10000)
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])

    const time = new Date(lead.time)
    const row = [
      String(lead.id),
      isNaN(time) ? new Date() : time,
      asText(lead.name, 60),
      "'" + phone, // keep the number as text so Sheets doesn't mangle it
      asText(lead.quiz, 40),
      score ? "'" + score : '', // "3/5" would otherwise turn into a date
    ]

    // a quiz start adds a row; finishing the quiz fills in the score on that same row
    const rowNum = findRow(sheet, 1, String(lead.id))
    // an entry can only be updated by the same number, so nobody can overwrite someone else's row
    if (rowNum && digits(sheet.getRange(rowNum, 4).getValue()) !== digits(phone)) {
      return json({ error: 'Invalid entry' })
    }
    const at = rowNum || sheet.getLastRow() + 1
    sheet.getRange(at, 1, 1, row.length).setValues([row])

    if (lead.action !== 'prize') return ContentService.createTextOutput('ok')
    return json(givePrize(sheet, at, lead))
  } catch (err) {
    return json({ error: String(err.message || err) })
  } finally {
    lock.releaseLock()
  }
}

// One prize per phone number: playing again returns the codes they already got.
function givePrize(sheet, at, lead) {
  const data = sheet.getRange(1, 1, sheet.getLastRow(), HEADERS.length).getValues()
  const phone = String(lead.phone).replace(/\D/g, '')
  const earlier = data.find((r) => r[6] && String(r[3]).replace(/\D/g, '') === phone)
  if (earlier) {
    return { eggCode: earlier[6], tourCode: earlier[7] || '', expires: new Date(earlier[8]).toISOString(), repeat: true }
  }

  if (OTP_REQUIRED && !isVerified(phone)) return { error: 'Phone number not verified' }

  // codes expire CODE_HOURS after they're made, so "expires more than CODE_HOURS - 1 from now" = made in the last hour
  const hourAgo = Date.now() + (CODE_HOURS - 1) * 3600 * 1000
  const lastHour = data.filter((r) => r[6] && new Date(r[8]).getTime() > hourAgo).length
  if (lastHour >= MAX_PRIZES_PER_HOUR) return { error: 'Too many prizes right now, please try again later' }

  const [right] = String(lead.score).split('/').map(Number)
  const expires = new Date(Date.now() + CODE_HOURS * 3600 * 1000)
  const eggCode = 'LF303-' + randomCode()
  const tourCode = right >= TOUR_SCORE ? 'TOUR-' + randomCode() : ''

  createEggDiscount(eggCode, expires, lead)
  sheet.getRange(at, 7, 1, 3).setValues([[eggCode, tourCode, expires]])
  return { eggCode, tourCode, expires: expires.toISOString() }
}

function createEggDiscount(code, expires, lead) {
  const query = `mutation EggCode($input: DiscountCodeBasicInput!) {
    discountCodeBasicCreate(basicCodeDiscount: $input) {
      codeDiscountNode { id }
      userErrors { field message }
    }
  }`
  const input = {
    title: `Quiz prize: ₹303 off for ${lead.name} (${lead.phone})`,
    code,
    startsAt: new Date().toISOString(),
    endsAt: expires.toISOString(),
    usageLimit: 1,
    appliesOncePerCustomer: true,
    context: { all: 'ALL' },
    minimumRequirement: { subtotal: { greaterThanOrEqualToSubtotal: COUPON_MIN_ORDER } },
    customerGets: {
      value: { discountAmount: { amount: COUPON_AMOUNT, appliesOnEachItem: false } },
      items: { all: true },
    },
  }
  const result = shopify(query, { input })
  const errors = result.data && result.data.discountCodeBasicCreate.userErrors
  if (result.errors || (errors && errors.length)) {
    throw new Error('Shopify: ' + JSON.stringify(result.errors || errors))
  }
}

// ---------- OTP (WhatsApp Cloud API) ----------
// Meta only delivers the message, so the code is made, kept and checked here.

const OTP_MINUTES = 10
const OTP_TRIES = 5 // wrong guesses before the code is thrown away
const OTP_RESEND_SECONDS = 30 // same as the resend countdown in src/App.jsx

// One quiz per number: once a number has a coupon, it can't get another OTP to play again.
function sendOtp(phone) {
  if (hasPlayed(phone)) return { error: 'already-played' }
  const cache = CacheService.getScriptCache()
  const key = 'otp:' + digits(phone)
  const old = JSON.parse(cache.get(key) || 'null')
  if (old && Date.now() - old.sent < OTP_RESEND_SECONDS * 1000) return { error: 'Please wait a few seconds before asking again' }

  const code = String(Math.floor(100000 + Math.random() * 900000))
  const res = whatsappOtp(phone, code)
  if (!res.messages) return { error: (res.error && res.error.message) || 'Could not send the code' }
  cache.put(key, JSON.stringify({ code, tries: 0, sent: Date.now() }), OTP_MINUTES * 60)
  return { ok: true }
}

function checkOtp(phone, code) {
  const cache = CacheService.getScriptCache()
  const key = 'otp:' + digits(phone)
  const saved = JSON.parse(cache.get(key) || 'null')
  if (!saved) return { error: 'Code expired' }
  if (saved.code !== String(code)) {
    saved.tries++
    if (saved.tries >= OTP_TRIES) cache.remove(key)
    else cache.put(key, JSON.stringify(saved), OTP_MINUTES * 60)
    return { error: 'Wrong code' }
  }
  cache.remove(key)
  // remembered for good, so a player can reload the result page and still get their coupon
  PropertiesService.getScriptProperties().setProperty('verified:' + digits(phone), String(Date.now()))
  return { ok: true }
}

// 10-digit Indian mobile, not an obvious fake like 9999999999 (same rules as looksFake in src/App.jsx)
function validPhone(phone) {
  const p = String(phone || '')
  if (!/^[6-9]\d{9}$/.test(p)) return false
  if (new Set(p).size < 3 || /(\d)\1{5}/.test(p)) return false
  if (/^(\d\d)\1{4}$/.test(p) || /^(\d{5})\1$/.test(p)) return false
  let up = 1
  let down = 1
  for (let i = 1; i < p.length; i++) {
    const step = p[i] - p[i - 1]
    up = step === 1 || step === -9 ? up + 1 : 1
    down = step === -1 || step === 9 ? down + 1 : 1
    if (up >= 7 || down >= 7) return false
  }
  return true
}

// player-typed text: trimmed, capped, and never run as a formula (=, +, -, @ at the start)
function asText(value, max) {
  const text = String(value).trim().slice(0, max)
  return /^[=+\-@]/.test(text) ? "'" + text : text
}

function hasPlayed(phone) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]
  const last = sheet.getLastRow()
  if (last < 2) return false
  const rows = sheet.getRange(2, 4, last - 1, 4).getValues() // Phone .. Coupon code
  return rows.some((r) => r[3] && digits(r[0]) === digits(phone))
}

function isVerified(phone) {
  return Boolean(PropertiesService.getScriptProperties().getProperty('verified:' + digits(phone)))
}

// Sends an Authentication template; the code fills the body and the "Copy code" button.
function whatsappOtp(phone, code) {
  const props = PropertiesService.getScriptProperties()
  const res = UrlFetchApp.fetch(`https://graph.facebook.com/${GRAPH_API}/${prop('WHATSAPP_PHONE_ID').trim()}/messages`, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + whatsappToken() },
    payload: JSON.stringify({
      messaging_product: 'whatsapp',
      to: '91' + digits(phone),
      type: 'template',
      template: {
        name: prop('WHATSAPP_TEMPLATE').trim(),
        language: { code: props.getProperty('WHATSAPP_LANG') || 'en' },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: code }] },
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
        ],
      },
    }),
    muteHttpExceptions: true,
  })
  return JSON.parse(res.getContentText())
}

const digits = (phone) => String(phone).replace(/\D/g, '').slice(-10)

const TEST_PHONE = '8105369922' // number the editor tests below send to

// Sends a dummy code (123456) to TEST_PHONE and logs Meta's full answer, skipping the one-quiz check.
// "accepted" only means Meta took it; whether it arrived shows up in the "WhatsApp log" tab (webhook below).
function testOtp() {
  Logger.log(JSON.stringify(whatsappOtp(TEST_PHONE, '123456')))
}

// Checks the token and phone ID without sending a message: logs the WhatsApp number's name,
// or Meta's exact error (code 190 = token expired or wrong, 100 = phone ID wrong or not shared with the token).
function testWhatsApp() {
  const token = whatsappToken()
  // a Meta token starts with EAA; anything else is the wrong value pasted in
  Logger.log(`token length: ${token.length}, starts with: ${token.slice(0, 4)}${/^EAA/.test(token) ? '' : '  <- not a Meta token, should start with EAA'}`)
  const res = UrlFetchApp.fetch(`https://graph.facebook.com/${GRAPH_API}/${prop('WHATSAPP_PHONE_ID').trim()}?fields=display_phone_number,verified_name`, {
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true,
  })
  Logger.log(res.getContentText())
}

// Checks the WhatsApp account end to end and logs anything that would stop delivery.
// Needs one more script property: WHATSAPP_WABA_ID (WhatsApp Business Account ID, shown on the
// API Setup page next to the Phone number ID). Also subscribes this app to the account so webhooks arrive.
function checkWhatsAppAccount() {
  const waba = prop('WHATSAPP_WABA_ID').trim()
  const graph = (method, path) => {
    const res = UrlFetchApp.fetch(`https://graph.facebook.com/${GRAPH_API}/${path}`, {
      method,
      headers: { Authorization: 'Bearer ' + whatsappToken() },
      muteHttpExceptions: true,
    })
    return JSON.parse(res.getContentText())
  }

  const phone = graph('get', `${prop('WHATSAPP_PHONE_ID').trim()}?fields=display_phone_number,verified_name,status,name_status,quality_rating,messaging_limit_tier,account_mode,code_verification_status`)
  Logger.log('PHONE NUMBER: ' + JSON.stringify(phone))
  Logger.log('  want status CONNECTED, name_status APPROVED, account_mode LIVE')

  const name = prop('WHATSAPP_TEMPLATE').trim()
  const templates = graph('get', `${waba}/message_templates?name=${encodeURIComponent(name)}&fields=name,status,category,language,components`)
  Logger.log('TEMPLATE: ' + JSON.stringify(templates))
  Logger.log(`  want status APPROVED, category AUTHENTICATION, language = WHATSAPP_LANG (now "${PropertiesService.getScriptProperties().getProperty('WHATSAPP_LANG') || 'en'}")`)

  Logger.log('SUBSCRIBE APP FOR WEBHOOKS: ' + JSON.stringify(graph('post', `${waba}/subscribed_apps`)))
  Logger.log('SUBSCRIBED APPS: ' + JSON.stringify(graph('get', `${waba}/subscribed_apps`)))
}

// ---------- WhatsApp webhook ----------
// Meta reports delivery (sent / delivered / read / failed + reason) only through a webhook.
// In developers.facebook.com > your app > WhatsApp > Configuration > Webhook, set
//   Callback URL   this web app's URL (same as VITE_SHEET_URL)
//   Verify token   legitfarms
// then subscribe to the "messages" field. Every status lands in the "WhatsApp log" tab.

function doGet(e) {
  const p = (e && e.parameter) || {}
  if (p['hub.mode'] === 'subscribe' && p['hub.verify_token'] === 'legitfarms') {
    return ContentService.createTextOutput(p['hub.challenge'])
  }
  return ContentService.createTextOutput('ok')
}

function logWhatsAppStatus(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const sheet = ss.getSheetByName('WhatsApp log') || ss.insertSheet('WhatsApp log', ss.getNumSheets())
  if (sheet.getLastRow() === 0) sheet.appendRow(['Time', 'To', 'Status', 'Error code', 'Error', 'Details', 'Message ID'])
  ;(body.entry || []).forEach((entry) =>
    (entry.changes || []).forEach((change) =>
      ((change.value && change.value.statuses) || []).forEach((s) => {
        const err = (s.errors && s.errors[0]) || {}
        sheet.appendRow([
          new Date(Number(s.timestamp) * 1000),
          "'" + s.recipient_id,
          s.status,
          err.code || '',
          err.title || err.message || '',
          (err.error_data && err.error_data.details) || '',
          s.id,
        ])
      })
    )
  )
  return ContentService.createTextOutput('ok')
}

// tolerate a token pasted with spaces, line breaks, quotes, "WHATSAPP_TOKEN=" or a leading "Bearer"
function whatsappToken() {
  return prop('WHATSAPP_TOKEN')
    .replace(/^\s*WHATSAPP_TOKEN\s*=/i, '')
    .replace(/^\s*Bearer\s+/i, '')
    .replace(/["'\s]/g, '')
}

function shopify(query, variables) {
  const store = prop('SHOPIFY_STORE')
  const res = UrlFetchApp.fetch(`https://${store}/admin/api/${SHOPIFY_API}/graphql.json`, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Shopify-Access-Token': shopifyToken(store) },
    payload: JSON.stringify({ query, variables }),
    muteHttpExceptions: true,
  })
  return JSON.parse(res.getContentText())
}

// Dev Dashboard apps get a token via client credentials; it lasts ~24h, so keep it cached.
function shopifyToken(store) {
  const fixed = PropertiesService.getScriptProperties().getProperty('SHOPIFY_TOKEN')
  if (fixed) return fixed
  const cache = CacheService.getScriptCache()
  const cached = cache.get('shopify-token')
  if (cached) return cached
  const res = UrlFetchApp.fetch(`https://${store}/admin/oauth/access_token`, {
    method: 'post',
    payload: {
      grant_type: 'client_credentials',
      client_id: prop('SHOPIFY_CLIENT_ID'),
      client_secret: prop('SHOPIFY_CLIENT_SECRET'),
    },
    muteHttpExceptions: true,
  })
  const body = JSON.parse(res.getContentText())
  if (!body.access_token) throw new Error('Shopify login failed: ' + res.getContentText())
  cache.put('shopify-token', body.access_token, 6 * 3600)
  return body.access_token
}

// Run this once from the editor: it asks Google for permission to reach Shopify and checks the login.
function testShopify() {
  const result = shopify('{ shop { name } }', {})
  Logger.log(JSON.stringify(result))
}

function prop(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name)
  if (!value) throw new Error(`Script property ${name} is not set`)
  return value
}

function findRow(sheet, col, value) {
  const last = sheet.getLastRow()
  if (last < 2) return 0
  const values = sheet.getRange(2, col, last - 1, 1).getValues()
  const i = values.findIndex((r) => String(r[0]) === value)
  return i === -1 ? 0 : i + 2
}

// no 0/O or 1/I so codes are easy to read out and type
function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}

// ---------- Stats ----------

const GREEN = '#004d30'
const YOLK = '#f2a325'
const TINT = '#ffedcf'

function setupStats() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const leads = ss.getSheets()[0]
  leads.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
  styleLeads(leads)

  let stats = ss.getSheetByName('Stats')
  if (stats) {
    stats.getCharts().forEach((c) => stats.removeChart(c))
    stats.clear()
  } else {
    stats = ss.insertSheet('Stats', ss.getNumSheets()) // keep the leads tab first
  }

  const L = `'${leads.getName()}'!`
  const right = `IFERROR(VALUE(REGEXEXTRACT(${L}F2:F,"^\d+")),"")` // "4/5" -> 4
  const outOf = `IFERROR(VALUE(REGEXEXTRACT(${L}F2:F,"\d+$")),"")` // "4/5" -> 5

  stats.setHiddenGridlines(true)
  stats.setColumnWidth(1, 24)
  stats.setColumnWidths(2, 8, 150)

  stats.getRange('B2').setValue('Legit Farms quiz: stats').setFontSize(20).setFontWeight('bold').setFontColor(GREEN)
  stats.getRange('B3').setFormula('="Updated live · last checked "&TEXT(NOW(),"d mmm, h:mm am/pm")').setFontColor('#777')

  // KPI cards: label on top, big number under it
  const cards = [
    ['Players', `=COUNTA(${L}C2:C)`],
    ['Unique numbers', `=COUNTUNIQUE(${L}D2:D)`],
    ['Finished quiz', `=COUNTIF(${L}F2:F,"?*")`],
    ['Finish rate', '=IFERROR(F6/B6,0)', '0%'],
    ['Average score', `=IFERROR(AVERAGE(ARRAYFORMULA(${right})),0)`, '0.0'],
    ['Perfect scores', `=SUMPRODUCT((ARRAYFORMULA(${right})<>"")*(ARRAYFORMULA(${right})=ARRAYFORMULA(${outOf})))`],
    ['Played today', `=COUNTIFS(${L}B2:B,">="&TODAY())`],
    ['Coupons given', `=COUNTIF(${L}G2:G,"?*")`],
    ['Farm tours won', `=COUNTIF(${L}H2:H,"TOUR-*")`],
    ['Coupons used', `=COUNTIF(${L}J2:J,"Yes")`],
    ['Code use rate', '=IFERROR(D12/H9,0)', '0%'],
    ['Codes still live', `=COUNTIFS(${L}I2:I,">"&NOW(),${L}J2:J,"<>Yes")`],
  ]
  cards.forEach(([label, formula, format], i) => {
    const col = 2 + (i % 4) * 2
    const row = 5 + Math.floor(i / 4) * 3
    const labelCell = stats.getRange(row, col, 1, 2).merge()
    const valueCell = stats.getRange(row + 1, col, 1, 2).merge()
    labelCell.setValue(label).setFontColor(GREEN).setFontWeight('bold').setFontSize(10)
    valueCell.setFormula(formula).setFontSize(22).setFontWeight('bold').setFontColor(GREEN)
    if (format) valueCell.setNumberFormat(format)
    stats.getRange(row, col, 2, 2).setBackground(TINT).setHorizontalAlignment('center')
      .setBorder(true, true, true, true, false, false, YOLK, SpreadsheetApp.BorderStyle.SOLID_MEDIUM)
  })
  // rates above read B6 (players), F6 (finished), H9 (codes given), D12 (codes used)

  // score breakdown 0..5
  header(stats.getRange('B15:C15'), ['Score', 'Players'])
  const scores = [0, 1, 2, 3, 4, 5].map((n) => [`${n} right`, `=COUNTIF(${L}F2:F,"${n}/*")`])
  stats.getRange(16, 2, scores.length, 2).setValues(scores)

  // players per day
  header(stats.getRange('E15:F15'), ['Day', 'Players'])
  stats.getRange('E16').setFormula(
    `=IFERROR(QUERY({ARRAYFORMULA(IF(${L}B2:B="",,INT(${L}B2:B)))},` +
      `"select Col1, count(Col1) where Col1 is not null group by Col1 label Col1 '', count(Col1) ''",0),"No players yet")`
  )
  stats.getRange('E16:E400').setNumberFormat('d mmm')

  // quizzes played
  header(stats.getRange('H15:I15'), ['Quiz', 'Players'])
  stats.getRange('H16').setFormula(
    `=IFERROR(QUERY({${L}E2:E},"select Col1, count(Col1) where Col1 <> '' group by Col1 label Col1 '', count(Col1) ''",0),"No players yet")`
  )

  addChart(stats, Charts.ChartType.COLUMN, stats.getRange('B15:C21'), 'Score breakdown', 23, 2, YOLK)
  addChart(stats, Charts.ChartType.COLUMN, stats.getRange('E15:F60'), 'Players per day', 23, 6, GREEN)

  installSyncTrigger()
  syncRedemptions()
}

function header(range, labels) {
  range.setValues([labels]).setBackground(GREEN).setFontColor('#ffffff').setFontWeight('bold')
}

function addChart(sheet, type, range, title, row, col, color) {
  sheet.insertChart(
    sheet.newChart()
      .setChartType(type)
      .addRange(range)
      .setNumHeaders(1)
      .setPosition(row, col, 0, 0)
      .setOption('title', title)
      .setOption('legend', { position: 'none' })
      .setOption('colors', [color])
      .setOption('width', 520)
      .setOption('height', 300)
      .build()
  )
}

function styleLeads(sheet) {
  sheet.setFrozenRows(1)
  sheet.getRange(1, 1, 1, HEADERS.length).setBackground(GREEN).setFontColor('#ffffff').setFontWeight('bold')
  sheet.getRange('B2:B').setNumberFormat('d mmm yyyy, h:mm am/pm')
  sheet.getRange('I2:I').setNumberFormat('d mmm, h:mm am/pm')
  sheet.hideColumns(1) // the ID is only for matching rows
}

function installSyncTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'syncRedemptions')
    .forEach((t) => ScriptApp.deleteTrigger(t))
  ScriptApp.newTrigger('syncRedemptions').timeBased().everyHours(1).create()
}

// Marks "Coupon used" = Yes once Shopify shows the code was used at checkout.
// Only looks at codes from the last 3 days, since older ones have expired.
function syncRedemptions() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]
  const last = sheet.getLastRow()
  if (last < 2) return
  const rows = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues()
  const since = Date.now() - 3 * 24 * 3600 * 1000
  const todo = []
  rows.forEach((r, i) => {
    if (r[6] && r[9] !== 'Yes' && new Date(r[8]).getTime() > since) todo.push({ row: i + 2, code: r[6] })
  })

  for (let i = 0; i < todo.length; i += 25) {
    const chunk = todo.slice(i, i + 25)
    const fields = chunk
      .map((t, j) => `c${j}: codeDiscountNodeByCode(code: ${JSON.stringify(t.code)}) { codeDiscount { ... on DiscountCodeBasic { asyncUsageCount } } }`)
      .join('\n')
    const data = shopify(`{ ${fields} }`, {}).data || {}
    chunk.forEach((t, j) => {
      const node = data['c' + j]
      const used = node && node.codeDiscount && node.codeDiscount.asyncUsageCount > 0
      sheet.getRange(t.row, 10).setValue(used ? 'Yes' : 'No')
    })
  }
}
