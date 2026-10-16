// Builds the print files for the 16 x 13 ft quiz arch (run: node poster/arch/build.mjs).
// Output: top-beam.html (10 x 3 ft, fits between the pillars) and pillar.html (3 x 13 ft, print it twice),
// sized in real inches,
// plus preview.html showing the whole arch. Turn them into PDFs/PNGs with Chrome (see README.md).
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const b64 = (p) => readFileSync(join(root, p)).toString('base64')

const logo = `data:image/png;base64,${b64('src/assets/logo-cream.png')}`
// same QR as the A4 poster (points to the quiz site)
const qr = readFileSync(join(root, 'poster/poster.html'), 'utf8').match(/<svg[^>]*viewBox="0 0 33 33"[\s\S]*?<\/svg>/)[0]

// the website's floating farm motifs (vector symbols from the live Shopify theme)
const sprite = readFileSync(join(root, '../lf-branded-live/snippets/lf-motion.liquid'), 'utf8').match(
  /<svg width="0"[\s\S]*?<\/defs>\s*<\/svg>/
)[0]
const motif = (id, cls) => `<svg class="motif ${cls}" aria-hidden="true"><use href="#lf-${id}"/></svg>`

const fonts = [500, 600, 700, 800]
  .flatMap((w) =>
    ['latin', 'latin-ext'].map(
      (s) => `@font-face { font-family: Poppins; font-weight: ${w};
  src: url(data:font/woff2;base64,${b64(`node_modules/@fontsource/poppins/files/poppins-${s}-${w}-normal.woff2`)}) format('woff2') }`
    )
  )
  .join('\n')

// 1 unit = 1 inch everywhere below
const base = `
${fonts}
:root { --green:#004d30; --deep:#16352a; --yolk:#f2a325; --tint:#ffedcf }
* { box-sizing: border-box; margin: 0 }
html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact }
body { font-family: Poppins, 'Segoe UI', sans-serif; color: var(--tint); background: var(--green) }
.egg { position: absolute; border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
  background: radial-gradient(circle at 35% 30%, #fffdf7, #f3e2c2 60%, #d9bd8c);
  box-shadow: 0 1.2in 1.6in -0.9in rgba(0,0,0,.6) }
.motif { position: absolute; overflow: visible }
`

const beam = `<!doctype html><html><head><meta charset="utf-8"><title>Arch top beam 10x3 ft</title><style>
${base}
@page { size: 120in 36in; margin: 0 }
html, body { width: 120in; height: 36in; overflow: hidden }
.beam { position: relative; width: 120in; height: 36in; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  background:
    radial-gradient(55% 90% at 50% 50%, rgba(0,110,66,.55), transparent 70%),
    linear-gradient(180deg, #00663f 0%, var(--green) 55%, #00391f 100%) }
.beam::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1.6in; background: var(--yolk) }
.logo { position: relative; height: 27in }
</style></head><body>
<div class="beam">
  <img class="logo" src="${logo}" alt="Legit Farms - Guaranteed Goodness">
</div>
</body></html>`

const pillar = `<!doctype html><html><head><meta charset="utf-8"><title>Arch pillar 3x13 ft</title><style>
${base}
@page { size: 36in 156in; margin: 0 }
html, body { width: 36in; height: 156in; overflow: hidden }
.pillar { position: relative; width: 36in; height: 156in; overflow: hidden; padding: 44in 3in 0;
  display: flex; flex-direction: column; align-items: center; text-align: center;
  background:
    radial-gradient(90% 30% at 0% 100%, rgba(242,163,37,.22), transparent 70%),
    linear-gradient(170deg, #00663f 0%, var(--green) 45%, #00321e 100%) }
/* prize badge: sits in the top 3 ft, level with the top bar */
.yolk { position: absolute; top: 4.5in; left: 50%; translate: -50% 0; width: 27in; height: 27in; border-radius: 50%;
  display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--deep);
  background: radial-gradient(circle at 35% 30%, #ffd27a, var(--yolk) 55%, #d98a12);
  box-shadow: 0 0 0 1.4in rgba(255,237,207,.09), 0 0 0 3in rgba(255,237,207,.04), 0 1.5in 3in -1in rgba(0,0,0,.5) }
.yolk small { font-size: 2.5in; font-weight: 700; line-height: 1 }
.yolk b { font-size: 9.4in; font-weight: 800; line-height: 1; letter-spacing: -.04em; margin-top: .4in }
.yolk em { font-style: normal; font-size: 3.6in; font-weight: 800; line-height: 1; letter-spacing: .2em; margin-left: .2em }
h1 { position: relative; font-size: 4.5in; line-height: 1.04; font-weight: 800; letter-spacing: -.03em; text-wrap: balance }
h1 span { display: block; color: var(--yolk); text-wrap: balance }
.sub { position: relative; margin-top: 1.4in; font-size: 1.9in; font-weight: 500; opacity: .9 }
.qr-wrap { position: relative; margin-top: 2.6in; padding: 1.8in 1.8in 2.8in; background: #fff; border-radius: 2.6in;
  box-shadow: 0 0 0 .6in var(--yolk), 0 2.4in 4.4in -1.6in rgba(0,0,0,.7) }
.qr-wrap svg { display: block; width: 23in; height: 23in }
.qr-badge { position: absolute; left: 50%; top: calc(50% - .5in); width: 4.6in; height: 4.6in; translate: -50% -50%;
  display: grid; place-items: center; background: var(--green); border: .45in solid #fff; border-radius: 1.3in }
.qr-badge .egg { position: static; width: 1.9in; height: 2.4in; box-shadow: none }
.scan { position: absolute; left: 50%; bottom: -1.6in; translate: -50% 0; padding: .6in 2.2in; white-space: nowrap;
  background: var(--deep); color: var(--yolk); font-weight: 800; font-size: 1.9in; letter-spacing: .14em; border-radius: 9in;
  border: .25in solid var(--yolk) }
.prizes { position: relative; display: grid; gap: 1.2in; width: 100%; margin-top: 4.4in }
.prize { display: flex; align-items: center; gap: 1.4in; padding: 1.4in 1.8in; text-align: left; border-radius: 1.8in }
.prize .ic { font-size: 3.4in; line-height: 1; flex: none }
.prize b { display: block; font-size: 2.4in; line-height: 1.12 }
.prize small { display: block; margin-top: .3in; font-size: 1.4in; font-weight: 600; opacity: .8 }
.prize .egg.coupon { position: static; display: block; width: 2.8in; height: 3.5in; box-shadow: 0 .6in .9in -.5in rgba(0,0,0,.5) }
.p1 { background: linear-gradient(150deg, #fff7e8, #ffe3a8 60%, #f9c867); color: var(--deep) }
.p2 { background: rgba(255,237,207,.1); border: .18in solid rgba(255,237,207,.25) }
.steps { position: relative; display: grid; gap: .9in; margin-top: 2.6in; font-size: 1.8in; font-weight: 600; text-align: left }
.steps span { display: flex; align-items: center; gap: .9in }
.steps i { font-style: normal; flex: none; width: 2.6in; height: 2.6in; display: grid; place-items: center; border-radius: 50%;
  background: var(--yolk); color: var(--deep); font-weight: 800 }
.pillar .bee { left: 1.2in; top: 2in; width: 6in; height: 4.9in; rotate: -12deg; z-index: 1 }
.pillar .cow { left: .6in; bottom: 14.5in; width: 6in; height: 5in }
.pillar .quail { right: .6in; bottom: 14.5in; width: 5.6in; height: 4.6in; transform: scaleX(-1) }
.foot { position: absolute; left: 0; right: 0; bottom: 0; height: 13in; padding: 0 2in 1.5in; text-align: center;
  display: flex; flex-direction: column; justify-content: center; gap: .4in;
  background: var(--deep); font-size: 1.6in; font-weight: 600 }
.foot b { color: var(--yolk); font-size: 3.6in; font-weight: 800; line-height: 1.1; letter-spacing: -.02em }
</style></head><body>
${sprite}
<div class="pillar">
  <div class="yolk"><small>Play &amp; win</small><b>₹303</b><em>OFF</em></div>
  ${motif('bee3d', 'bee')}${motif('cow', 'cow')}${motif('quail', 'quail')}
  <h1>How much do you know <span>about your food?</span></h1>
  <p class="sub">5 quick questions · 1 minute</p>
  <div class="qr-wrap">${qr}<div class="qr-badge"><span class="egg"></span></div><div class="scan">SCAN TO PLAY</div></div>
  <div class="prizes">
    <div class="prize p1"><span class="ic"><span class="egg coupon"></span></span><div><b>₹303 off coupon</b><small>On all products · everyone who plays wins</small></div></div>
    <div class="prize p2"><span class="ic">🚜</span><div><b>Free farm tour</b><small>Score 3 or more</small></div></div>
  </div>
  <div class="steps"><span><i>1</i>Scan the QR code</span><span><i>2</i>Answer 5 questions</span><span><i>3</i>Claim your prize</span></div>
  <div class="foot"><span>Buy honest food at</span><b>legitfarms.com</b></div>
</div>
</body></html>`

// Mockup of the whole arch in a room with dimensions, to show the printer/team. Not for printing.
// Scene is 1600 x 1000 px; FT = px per foot. The real print files are scaled down into it.
const FT = 56
const X0 = (1600 - 16 * FT) / 2 // arch left edge
const Y0 = 130 // arch top edge
const S = FT / (12 * 96) // CSS inch -> scene px
const px = (ft) => ft * FT
const dim = (x1, y1, x2, y2, label, side) => {
  const v = x1 === x2
  const tx = v ? x1 + (side === 'left' ? -14 : 14) : (x1 + x2) / 2
  const ty = v ? (y1 + y2) / 2 : y1 + (side === 'below' ? 26 : -12)
  const anchor = v ? (side === 'left' ? 'end' : 'start') : 'middle'
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-start="url(#a)" marker-end="url(#a)"/>
  <text x="${tx}" y="${ty}" text-anchor="${anchor}" dominant-baseline="${v ? 'middle' : 'auto'}">${label}</text>`
}
const bottom = Y0 + px(13)
const preview = `<!doctype html><html><head><meta charset="utf-8"><title>Arch preview</title><style>
${fonts}
html, body { margin: 0; width: 1600px; height: 1000px; overflow: hidden }
body { position: relative; font-family: Poppins, 'Segoe UI', sans-serif;
  background: linear-gradient(180deg, #eeebe4 0%, #e2ded5 ${bottom - 60}px, #cfc8bb ${bottom - 60}px, #b9b1a3 100%) }
.skirting { position: absolute; left: 0; right: 0; top: ${bottom - 66}px; height: 6px; background: #c9c2b5 }
.glow { position: absolute; left: ${X0 - 200}px; top: ${Y0 - 80}px; width: ${px(16) + 400}px; height: ${px(13) + 120}px;
  background: radial-gradient(50% 50% at 50% 45%, rgba(255,255,255,.75), transparent 70%) }
.shadow { position: absolute; top: ${bottom - 14}px; height: 34px; border-radius: 50%;
  background: radial-gradient(50% 50% at 50% 50%, rgba(30,24,14,.45), transparent 75%) }
.panel { position: absolute; overflow: hidden; box-shadow: 0 18px 30px -12px rgba(0,0,0,.35) }
.panel iframe { position: absolute; left: 0; top: 0; border: 0; transform-origin: 0 0; transform: scale(${S}) }
.side { position: absolute; background: linear-gradient(90deg, #002b1a, #00422a) }
.under { position: absolute; left: ${X0 + px(3)}px; top: ${Y0 + px(3)}px; width: ${px(10)}px; height: 14px;
  background: linear-gradient(180deg, #002416, rgba(0,36,22,0)) }
svg.dims { position: absolute; inset: 0; overflow: visible }
.dims line { stroke: #4b5a50; stroke-width: 1.6 }
.dims text { fill: #33423a; font-size: 19px; font-weight: 600 }
.cap { position: absolute; left: 40px; top: 30px; color: #33423a }
.cap b { display: block; font-size: 24px; font-weight: 800; color: #004d30 }
.cap span { font-size: 15px; font-weight: 500; opacity: .8 }
</style></head><body>
<div class="glow"></div>
<div class="skirting"></div>
<div class="shadow" style="left:${X0 - 30}px;width:${px(3) + 60}px"></div>
<div class="shadow" style="left:${X0 + px(13) - 30}px;width:${px(3) + 60}px"></div>
<div class="side" style="left:${X0 + px(3)}px;top:${Y0 + px(3)}px;width:16px;height:${px(10)}px;clip-path:polygon(0 0,100% 2%,100% 100%,0 100%)"></div>
<div class="side" style="left:${X0 + px(13) - 16}px;top:${Y0 + px(3)}px;width:16px;height:${px(10)}px;clip-path:polygon(0 2%,100% 0,100% 100%,0 100%);transform:scaleX(-1)"></div>
<div class="under"></div>
<div class="panel" style="left:${X0 + px(3)}px;top:${Y0}px;width:${px(10)}px;height:${px(3)}px"><iframe src="top-beam.html" style="width:120in;height:36in"></iframe></div>
<div class="panel" style="left:${X0}px;top:${Y0}px;width:${px(3)}px;height:${px(13)}px"><iframe src="pillar.html" style="width:36in;height:156in"></iframe></div>
<div class="panel" style="left:${X0 + px(13)}px;top:${Y0}px;width:${px(3)}px;height:${px(13)}px"><iframe src="pillar.html" style="width:36in;height:156in"></iframe></div>
<svg class="dims" viewBox="0 0 1600 1000"><defs><marker id="a" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1L9 5L0 9z" fill="#4b5a50"/></marker></defs>
  ${dim(X0, Y0 - 34, X0 + px(16), Y0 - 34, '16 ft')}
  ${dim(X0 - 34, Y0, X0 - 34, bottom, '13 ft', 'left')}
  ${dim(X0 + px(16) + 34, Y0, X0 + px(16) + 34, Y0 + px(3), '3 ft top bar', 'right')}
  ${dim(X0 + px(16) + 34, Y0 + px(3), X0 + px(16) + 34, bottom, '10 ft clearance', 'right')}
  ${dim(X0, bottom + 42, X0 + px(3), bottom + 42, '3 ft', 'below')}
  ${dim(X0 + px(3), bottom + 42, X0 + px(13), bottom + 42, '10 ft walkway', 'below')}
  ${dim(X0 + px(13), bottom + 42, X0 + px(16), bottom + 42, '3 ft', 'below')}
</svg>
<div class="cap"><b>Legit Farms quiz arch</b><span>16 × 13 ft · 2 pillars 3 × 13 ft · top bar 10 × 3 ft between them</span></div>
</body></html>`

writeFileSync(join(here, 'top-beam.html'), beam)
writeFileSync(join(here, 'pillar.html'), pillar)
writeFileSync(join(here, 'preview.html'), preview)
console.log('built top-beam.html, pillar.html, preview.html')
