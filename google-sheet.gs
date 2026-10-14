// Paste this into Extensions > Apps Script of your Google Sheet, then Deploy > New deployment > Web app
// (Execute as: Me, Who has access: Anyone). Put the web app URL in .env as VITE_SHEET_URL.
//
// Prize codes: in Apps Script go to Project Settings > Script properties and add
//   SHOPIFY_STORE          by1utd-fv.myshopify.com
//   SHOPIFY_CLIENT_ID      client ID of your Shopify app (Dev Dashboard, scopes: write_discounts, read_discounts)
//   SHOPIFY_CLIENT_SECRET  client secret of that app
// (or SHOPIFY_TOKEN instead of the client ID/secret if you have an old-style shpat_ admin token)
// After changing this file, use Deploy > Manage deployments > Edit > New version so the live URL picks it up.

const HEADERS = ['ID', 'Time', 'Name', 'Phone', 'Product', 'Score', 'Egg code', 'Tour code', 'Codes expire']

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
