// Builds the print files for the 16 x 13 ft quiz arch (run: node poster/arch/build.mjs).
// Output: top-beam.html (16 x 3 ft) and pillar.html (3 x 10 ft, print it twice), sized in real inches,
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

// two-leaf sprout in thin gold line, like the mockup
const leaf = (flip) => `<svg class="leaf${flip ? ' flip' : ''}" viewBox="0 0 120 90" fill="none" stroke="#e9c46a" stroke-width="2.2" stroke-linecap="round">
  <path d="M60 88 C60 60 58 40 50 22" />
  <path d="M50 22 C30 30 6 22 2 2 C26 0 46 6 50 22 Z" />
  <path d="M50 22 C34 16 18 9 2 2" stroke-width="1.4" opacity=".8" />
  <path d="M58 50 C70 30 92 22 118 26 C110 48 86 58 58 50 Z" />
  <path d="M58 50 C76 42 96 33 118 26" stroke-width="1.4" opacity=".8" />
</svg>`

const beam = `<!doctype html><html><head><meta charset="utf-8"><title>Arch top beam 16x3 ft</title><style>
${base}
@page { size: 192in 36in; margin: 0 }
html, body { width: 192in; height: 36in; overflow: hidden }
.beam { position: relative; width: 192in; height: 36in; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  background:
    radial-gradient(40% 90% at 50% 50%, rgba(0,110,66,.55), transparent 70%),
    linear-gradient(180deg, #00663f 0%, var(--green) 55%, #00391f 100%) }
.beam::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1.6in; background: var(--yolk) }
.logo { position: relative; height: 27in }
.leaf { position: absolute; top: 4in; width: 30in; height: 22.5in }
.leaf:not(.flip) { left: 14in; transform: scaleX(-1) }
.leaf.flip { right: 14in }
</style></head><body>
<div class="beam">
  ${leaf(false)}${leaf(true)}
  <img class="logo" src="${logo}" alt="Legit Farms - Guaranteed Goodness">
</div>
</body></html>`

const pillar = `<!doctype html><html><head><meta charset="utf-8"><title>Arch pillar 3x10 ft</title><style>
${base}
@page { size: 36in 120in; margin: 0 }
html, body { width: 36in; height: 120in; overflow: hidden }
.pillar { position: relative; width: 36in; height: 120in; overflow: hidden; padding: 9in 3in 0;
  display: flex; flex-direction: column; align-items: center; text-align: center;
  background:
    radial-gradient(90% 30% at 0% 100%, rgba(242,163,37,.22), transparent 70%),
    linear-gradient(170deg, #00663f 0%, var(--green) 45%, #00321e 100%) }
.yolk { position: absolute; top: -10in; right: -10in; width: 26in; height: 26in; border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #ffd27a, var(--yolk) 55%, #d98a12);
  box-shadow: 0 0 0 2.6in rgba(255,237,207,.07), 0 0 0 5.6in rgba(255,237,207,.04) }
.pill { position: relative; padding: .8in 2in; background: var(--yolk); color: var(--deep);
  font-weight: 800; font-size: 2.2in; line-height: 1.2; border-radius: 9in;
  box-shadow: 0 .8in 1.8in -.8in rgba(242,163,37,.9) }
h1 { position: relative; margin-top: 2.2in; font-size: 4.5in; line-height: 1.04; font-weight: 800; letter-spacing: -.03em; text-wrap: balance }
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
.pillar .bee { left: 2in; top: 2.5in; width: 6in; height: 4.9in; rotate: -12deg }
.pillar .cow { left: .6in; bottom: 14.5in; width: 6in; height: 5in }
.pillar .quail { right: .6in; bottom: 14.5in; width: 5.6in; height: 4.6in; transform: scaleX(-1) }
.foot { position: absolute; left: 0; right: 0; bottom: 0; height: 13in; padding: 0 2in 1.5in; text-align: center;
  display: flex; flex-direction: column; justify-content: center; gap: .4in;
  background: var(--deep); font-size: 1.6in; font-weight: 600 }
.foot b { color: var(--yolk); font-size: 3.6in; font-weight: 800; line-height: 1.1; letter-spacing: -.02em }
</style></head><body>
${sprite}
<div class="pillar">
  <div class="yolk"></div>
  ${motif('bee3d', 'bee')}${motif('cow', 'cow')}${motif('quail', 'quail')}
  <div class="pill">Play &amp; win ₹303 off</div>
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

// whole arch at 1/24 scale (1 ft = 0.5in) to check the look; not for printing
const preview = `<!doctype html><html><head><meta charset="utf-8"><title>Arch preview</title><style>
html, body { margin: 0; background: #d9dcd6 }
.arch { position: relative; width: 8in; height: 6.5in; margin: .4in }
iframe { position: absolute; border: 0; transform-origin: 0 0; transform: scale(${1 / 24}) }
.top { left: 0; top: 0; width: 192in; height: 36in }
.l { left: 0; top: 1.5in; width: 36in; height: 120in }
.r { left: 6.5in; top: 1.5in; width: 36in; height: 120in }
</style></head><body><div class="arch">
<iframe class="l" src="pillar.html"></iframe><iframe class="r" src="pillar.html"></iframe><iframe class="top" src="top-beam.html"></iframe>
</div></body></html>`

writeFileSync(join(here, 'top-beam.html'), beam)
writeFileSync(join(here, 'pillar.html'), pillar)
writeFileSync(join(here, 'preview.html'), preview)
console.log('built top-beam.html, pillar.html, preview.html')
