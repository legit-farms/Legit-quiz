// Paste this into Extensions > Apps Script of your Google Sheet, then Deploy > New deployment > Web app
// (Execute as: Me, Who has access: Anyone). Put the web app URL in .env as VITE_SHEET_URL.
//
// Prize codes: in Apps Script go to Project Settings > Script properties and add
//   SHOPIFY_STORE          by1utd-fv.myshopify.com
//   SHOPIFY_CLIENT_ID      client ID of your Shopify app (Dev Dashboard, scopes: write_discounts, read_discounts)
//   SHOPIFY_CLIENT_SECRET  client secret of that app
// (or SHOPIFY_TOKEN instead of the client ID/secret if you have an old-style shpat_ admin token)
// After changing this file, use Deploy > Manage deployments > Edit > New version so the live URL picks it up.
//
// Stats: run setupStats once from the editor. It builds the "Stats" tab (live formulas + charts)
// and starts an hourly check that marks which egg codes were used on the website.

const HEADERS = ['ID', 'Time', 'Name', 'Phone', 'Product', 'Score', 'Egg code', 'Tour code', 'Codes expire', 'Egg code used']

const TOUR_SCORE = 3 // same as TOUR_SCORE in src/App.jsx
const CODE_HOURS = 24
const EGG_VARIANT = 'gid://shopify/ProductVariant/45718472196165' // Pasture Raised Legit Eggs, 6 pcs
const EGG_AMOUNT = '150' // price of the 6 pcs pack, so the pack becomes free
const SHOPIFY_API = '2026-07'

function doPost(e) {
  const lock = LockService.getScriptLock()
  lock.waitLock(10000)
  try {
    const lead = JSON.parse(e.postData.contents)
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])

    const row = [
      String(lead.id),
      new Date(lead.time),
      lead.name,
      "'" + lead.phone, // keep the number as text so Sheets doesn't mangle it
      lead.quiz,
      lead.score ? "'" + lead.score : '', // "3/5" would otherwise turn into a date
    ]

    // a quiz start adds a row; finishing the quiz fills in the score on that same row
    const rowNum = findRow(sheet, 1, String(lead.id))
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

  const [right] = String(lead.score).split('/').map(Number)
  const expires = new Date(Date.now() + CODE_HOURS * 3600 * 1000)
  const eggCode = 'EGG-' + randomCode()
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
    title: `Quiz prize: 6 eggs for ${lead.name} (${lead.phone})`,
    code,
    startsAt: new Date().toISOString(),
    endsAt: expires.toISOString(),
    usageLimit: 1,
    appliesOncePerCustomer: true,
    context: { all: 'ALL' },
    customerGets: {
      value: { discountAmount: { amount: EGG_AMOUNT, appliesOnEachItem: false } },
      items: { products: { productVariantsToAdd: [EGG_VARIANT] } },
    },
  }
  const result = shopify(query, { input })
  const errors = result.data && result.data.discountCodeBasicCreate.userErrors
  if (result.errors || (errors && errors.length)) {
    throw new Error('Shopify: ' + JSON.stringify(result.errors || errors))
  }
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
    ['Egg codes given', `=COUNTIF(${L}G2:G,"EGG-*")`],
    ['Farm tours won', `=COUNTIF(${L}H2:H,"TOUR-*")`],
    ['Egg codes used', `=COUNTIF(${L}J2:J,"Yes")`],
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

// Marks "Egg code used" = Yes once Shopify shows the code was used at checkout.
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
