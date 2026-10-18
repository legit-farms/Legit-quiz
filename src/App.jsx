import { useEffect, useRef, useState } from 'react'
import { categories, quizzes } from './data/quizzes.js'
import {
  addLead,
  checkOtp,
  claimPrize,
  clearLeads,
  leadsCsv,
  otpEnabled,
  readLeads,
  readPlayed,
  savePlayed,
  sendOtp,
  updateLead,
} from './leads.js'
import logoCream from './assets/logo-cream.png'
import logoGreen from './assets/logo-green.png'
import eggBox from './assets/cat-eggs.png'

const LETTERS = ['a', 'b', 'c', 'd', 'e']
const RING = 2 * Math.PI * 54
// score needed to win the farm tour on top of the ₹303 coupon
const TOUR_SCORE = 3
const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  delay: `${(i % 6) * 0.12}s`,
  duration: `${2.2 + (i % 5) * 0.35}s`,
  color: ['#f2a325', '#ffedcf', '#ffffff', '#7fc79f'][i % 4],
}))

function BrownEgg() {
  return (
    <svg className="egg" viewBox="0 0 200 270" role="img" aria-label="A brown egg">
      <defs>
        <radialGradient id="eggShell" cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#E9B98E" />
          <stop offset="45%" stopColor="#C98A58" />
          <stop offset="100%" stopColor="#8F5630" />
        </radialGradient>
        <radialGradient id="eggShadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#16352A" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#16352A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="246" rx="78" ry="14" fill="url(#eggShadow)" />
      <path
        d="M100 14 C146 14 178 92 178 150 C178 202 144 240 100 240 C56 240 22 202 22 150 C22 92 54 14 100 14 Z"
        fill="url(#eggShell)"
      />
      <ellipse cx="72" cy="78" rx="16" ry="30" fill="#fff" opacity="0.22" transform="rotate(18 72 78)" />
    </svg>
  )
}

function Media({ media, answered }) {
  if (!media) return null
  if (media.type === 'egg') {
    return (
      <div className="media media-egg">
        <BrownEgg />
      </div>
    )
  }
  if (media.type === 'image') {
    return (
      <div className="media">
        <div className="photo">
          <img src={media.src} alt="" />
        </div>
      </div>
    )
  }
  return (
    <div className="media duo">
      {media.images.map((img, i) => (
        <figure key={i} className="photo">
          <img
            src={img.src}
            alt={`Picture ${i + 1}`}
            style={img.zoom ? { transform: `scale(${img.zoom})`, transformOrigin: img.origin } : undefined}
          />
          <span className="photo-num">{i + 1}</span>
          {answered && <figcaption>{img.reveal}</figcaption>}
        </figure>
      ))}
    </div>
  )
}

// small ad for the main store, shown at the bottom of every quiz screen
function SiteAd() {
  return (
    <a className="site-ad" href="https://www.legitfarms.com/" target="_blank" rel="noopener noreferrer">
      <img className="site-ad-logo on-green" src={logoCream} alt="Legit Farms" />
      <img className="site-ad-logo on-cream" src={logoGreen} alt="Legit Farms" />
      <span className="site-ad-text">
        <b>Buy honest food</b>
        <span>legitfarms.com</span>
      </span>
      <span className="site-ad-go" aria-hidden="true">
        &#8599;
      </span>
    </a>
  )
}

// Catches made-up numbers like 9999999999, 9898989898, 9876543210 or 9000000001
// (no OTP for now, so this is the only check on the number).
function looksFake(phone) {
  if (new Set(phone).size < 3) return true
  if (/(\d)\1{5}/.test(phone)) return true
  if (/^(\d\d)\1{4}$/.test(phone) || /^(\d{5})\1$/.test(phone)) return true
  let up = 1
  let down = 1
  for (let i = 1; i < phone.length; i++) {
    const step = phone[i] - phone[i - 1]
    up = step === 1 || step === -9 ? up + 1 : 1
    down = step === -1 || step === 9 ? down + 1 : 1
    if (up >= 7 || down >= 7) return true
  }
  return false
}

function Details({ quiz, onSubmit, onBack }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  // null until the code is sent, then the 6-digit code they type
  const [code, setCode] = useState(null)
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(0)

  // countdown before "Resend code" unlocks
  useEffect(() => {
    if (!wait) return
    const t = setTimeout(() => setWait(wait - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  async function send() {
    setBusy(true)
    setError('')
    try {
      await sendOtp(phone)
      setCode('')
      setWait(30)
    } catch (err) {
      setError(
        err.message === 'already-played'
          ? 'This number has already played the quiz. Each number can play only once.'
          : `Couldn't send the code. ${err.message}`
      )
    } finally {
      setBusy(false)
    }
  }

  async function submit(e) {
    e.preventDefault()
    const cleanName = name.trim()
    if (cleanName.length < 2) {
      setError('Please enter your name.')
      return
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError('Please enter a valid 10-digit mobile number.')
      return
    }
    if (looksFake(phone)) {
      setError("That doesn't look like a real mobile number. Please enter your own number.")
      return
    }
    if (!otpEnabled) {
      onSubmit(cleanName, phone)
      return
    }
    if (code === null) {
      send()
      return
    }
    if (!/^\d{6}$/.test(code)) {
      setError('Please enter the 6-digit code we sent you.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await checkOtp(phone, code)
      onSubmit(cleanName, phone)
    } catch {
      setError('That code is wrong or has expired. Please try again.')
      setBusy(false)
    }
  }

  return (
    <main className="screen">
      <section className="hero hero-small">
        <button className="top-back" onClick={onBack} aria-label="Back to start">
          &larr;
        </button>
        <h1>
          {quiz.title} quiz <span>Tell us who's playing</span>
        </h1>
      </section>

    <form className="details" onSubmit={submit} noValidate>
      <p className="label">Before we start</p>

      <label className="field">
        <span>Your name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          autoComplete="name"
          autoCapitalize="words"
          maxLength={60}
        />
      </label>

      <label className="field">
        <span>Phone number</span>
        <div className="phone">
          <span aria-hidden="true">+91</span>
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="10-digit mobile number"
            autoComplete="tel-national"
            readOnly={code !== null}
          />
        </div>
      </label>

      {code !== null && (
        <div className="field otp">
          <span>
            OTP sent on WhatsApp to +91 {phone}{' '}
            <button type="button" className="link" onClick={() => setCode(null)}>
              Change
            </button>
          </span>
          <input
            aria-label="OTP"
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6-digit code"
            autoComplete="one-time-code"
            autoFocus
          />
          <button type="button" className="link" onClick={send} disabled={busy || wait > 0}>
            {wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}
          </button>
        </div>
      )}

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      <button className="btn" type="submit" disabled={busy}>
        {busy ? 'Please wait…' : code === null && otpEnabled ? 'Send OTP' : 'Start the quiz'}{' '}
        <span aria-hidden="true">&rarr;</span>
      </button>
      <p className="details-note">Your details stay with Legit Farms.</p>
    </form>
      <SiteAd />
    </main>
  )
}

function Home({ player, onChangePlayer, onPick }) {
  return (
    <main className="screen home">
      <section className="hero hero-home">
        <span className="hero-egg hero-egg-1" aria-hidden="true" />
        <span className="hero-egg hero-egg-2" aria-hidden="true" />
        <span className="hero-egg hero-egg-3" aria-hidden="true" />

        <img className="hero-logo" src={logoCream} alt="Legit Farms - Guaranteed Goodness" />

        <div className="hero-copy">
          <span className="hero-pill">🎁 Play &amp; win ₹303 off</span>
          <h1>
            Let's find out how much you know <span>about your food</span>
          </h1>
          <p>5 quick questions. 1 minute.</p>
          <div className="hero-prizes">
            <span>
              <i className="chip-egg" aria-hidden="true" /> ₹303 off coupon
            </span>
            <span>🚜 Score 3+ for a farm tour</span>
          </div>
        </div>
      </section>

      <section className="cats">
        {player && (
          <p className="hello">
            Hi {player.name}!{' '}
            <button className="link" onClick={onChangePlayer}>
              Not you?
            </button>
          </p>
        )}
        <p className="label">Choose your quiz</p>
        {categories.map((cat) => {
          const ready = cat.questions.length > 0
          return (
            <button key={cat.id} className="cat" disabled={!ready} onClick={() => onPick(cat.id)}>
              <span className="cat-img">
                <img src={cat.image} alt="" />
              </span>
              <span className="cat-body">
                <span className="cat-title">{cat.title}</span>
                <span className="cat-sub">{ready ? `${cat.questions.length} questions · 1 min` : 'Coming soon'}</span>
              </span>
              {ready ? (
                <span className="cat-go" aria-hidden="true">
                  &rarr;
                </span>
              ) : (
                <span className="cat-soon">Soon</span>
              )}
            </button>
          )
        })}
      </section>
      <SiteAd />
    </main>
  )
}

function Leads() {
  const [leads, setLeads] = useState(readLeads)

  function download() {
    const url = URL.createObjectURL(new Blob([leadsCsv()], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'legit-quiz-leads.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function clear() {
    if (!window.confirm('Delete all saved names and numbers from this device?')) return
    clearLeads()
    setLeads([])
  }

  return (
    <main className="screen leads">
      <h1>Quiz entries</h1>
      <p>{leads.length} saved on this device. Entries made on other phones are not here.</p>
      <div className="leads-actions">
        <button className="btn" onClick={download} disabled={!leads.length}>
          Download CSV
        </button>
        <button className="link" onClick={clear} disabled={!leads.length}>
          Delete all
        </button>
      </div>
      <div className="leads-table">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Quiz</th>
              <th>Score</th>
              <th>Egg code</th>
              <th>Tour code</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id}>
                <td>{l.name}</td>
                <td>{l.phone}</td>
                <td>{l.quiz}</td>
                <td>{l.score}</td>
                <td>{l.eggCode}</td>
                <td>{l.tourCode}</td>
                <td>{new Date(l.time).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <a className="link" href="#">
        Back to quiz
      </a>
    </main>
  )
}

function Quiz({ quiz, onDone, onExit }) {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState(null)
  // one entry per answered question: true, false, or null for a trick question
  const [results, setResults] = useState([])
  const factRef = useRef(null)

  const total = quiz.questions.length
  const q = quiz.questions[index]
  const answered = picked !== null
  const isLast = index === total - 1
  const trick = q.correct === null
  const right = picked === q.correct

  // on a phone the fact can land below the fold, so bring it into view
  useEffect(() => {
    if (answered) factRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [answered])

  function choose(id) {
    if (answered) return
    setPicked(id)
    setResults([...results, trick ? null : id === q.correct])
  }

  function next() {
    if (isLast) {
      onDone(results)
      return
    }
    setIndex(index + 1)
    setPicked(null)
    window.scrollTo(0, 0)
  }

  function optionState(id) {
    if (!answered) return ''
    if (trick) return id === picked ? 'chosen' : 'dim'
    if (id === q.correct) return 'correct'
    if (id === picked) return 'wrong'
    return 'dim'
  }

  function badge(id, i) {
    const state = optionState(id)
    if (state === 'correct') return '✓'
    if (state === 'wrong') return '✕'
    return LETTERS[i]
  }

  return (
    <main className="screen quiz">
      <header className="top">
        <button className="top-back" onClick={onExit} aria-label="Back to start">
          &larr;
        </button>
        <div className="segs" aria-hidden="true">
          {quiz.questions.map((_, i) => (
            <span key={i} className={`seg ${i < index || (i === index && answered) ? 'done' : i === index ? 'now' : ''}`} />
          ))}
        </div>
        <span className="top-count">
          {index + 1}/{total}
        </span>
      </header>

      {/* key restarts the slide-in animation for every question */}
      <section className="q" key={index}>
        <Media media={q.media} answered={answered} />

        <div>
          <p className="label">
            {quiz.title} &middot; Question {index + 1}
          </p>
          <h2>{q.text}</h2>
        </div>

        <div className="options">
          {q.options.map((opt, i) => (
            <button
              key={opt.id}
              className={`option ${optionState(opt.id)}`}
              onClick={() => choose(opt.id)}
              disabled={answered}
            >
              <span className="option-letter">{badge(opt.id, i)}</span>
              <span className="option-label">{opt.label}</span>
            </button>
          ))}
        </div>

        {answered && (
          <div ref={factRef} className="reveal" role="status">
            <div className={`fact ${trick ? 'neutral' : right ? 'good' : 'bad'}`}>
              <div className="verdict">
                <span className="verdict-icon" aria-hidden="true">
                  {trick ? '!' : right ? '✓' : '✕'}
                </span>
                <div>
                  <strong>{trick ? 'Legit fact' : right ? 'Correct!' : 'Not quite'}</strong>
                  {!trick && !right && (
                    <span className="verdict-answer">
                      Answer: <b>{q.options.find((o) => o.id === q.correct).label}</b>
                    </span>
                  )}
                </div>
              </div>
              {q.fact.split('\n').map((para, i) => (
                <p key={i}>{para}</p>
              ))}
              {q.facts && (
                <dl className="facts">
                  {q.facts.map((f) => (
                    <div key={f.label}>
                      <dt>{f.label}</dt>
                      <dd>{f.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
            {q.legit && (
              <div className="legit">
                <img src={logoCream} alt="Legit Farms" />
                <p>{q.legit}</p>
                {q.legitLine && <p className="legit-line">{q.legitLine}</p>}
                {q.legitTags && (
                  <ul className="tags">
                    {q.legitTags.map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {answered && (
        <div className="next-wrap">
          <button className="btn" onClick={next}>
            {isLast ? 'See my result' : 'Next question'} <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      )}
      <SiteAd />
    </main>
  )
}

function BarnIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
      <path d="M3 10.5 12 4l9 6.5V20H3z" />
      <path d="M9.5 20v-6h5v6M9.5 14l5 6M14.5 14l-5 6" />
    </svg>
  )
}

function formatExpiry(iso) {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// "23h 41m left", ticking along while the page is open
function useTimeLeft(iso) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!iso) return
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [iso])
  if (!iso) return ''
  const mins = Math.max(0, Math.floor((new Date(iso) - now) / 60000))
  if (!mins) return 'Expired'
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m left`
}

// Shopify discount link: applies the code to their session and opens the shop
const couponShopUrl = (code) =>
  `https://www.legitfarms.com/discount/${encodeURIComponent(code)}?redirect=/collections/all`
// the theme's tour form reads ?tour_code= and fills "Anything else we should know?" with this message
const tourUrl = (code) =>
  `https://www.legitfarms.com/pages/farm-tour?tour_code=${encodeURIComponent(code)}#farm-tour-enquire`
const tourMessage = (code) => `I won the prize: free farm tour. Code: ${code}`

function useCopy(text) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    })
  }
  return [copied, copy]
}

function PrizeCard({ tone, icon, kicker, title, worth, code, copyText = code, action, steps, loading }) {
  const [copied, copy] = useCopy(copyText)
  return (
    <article className={`gift gift-${tone}`}>
      <div className="gift-top">
        <span className="gift-icon" aria-hidden="true">
          {icon}
        </span>
        <div className="gift-title">
          <span className="gift-kicker">{kicker}</span>
          <h2>{title}</h2>
        </div>
        <span className="gift-worth">{worth}</span>
      </div>

      <div className="gift-cut" aria-hidden="true" />

      {loading ? (
        <div className="gift-code is-loading" aria-label="Getting your code" />
      ) : (
        <>
          <div className="gift-code">
            <span className="gift-code-label">Your code</span>
            <span className="gift-code-text">{code}</span>
            <button type="button" className="gift-copy" onClick={copy}>
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
          </div>
          <a
            className="gift-cta"
            href={action.url}
            target="_blank"
            rel="noopener"
            onClick={action.copyFirst ? copy : undefined}
          >
            {action.label} <span aria-hidden="true">&rarr;</span>
          </a>
          <ol className="gift-steps">
            {steps.map((s, i) => (
              <li key={i}>
                <span className="gift-step-num">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </article>
  )
}

function Result({ quiz, results, prize, name, onRetry }) {
  const scoredResults = results.filter((r) => r !== null)
  const scored = scoredResults.length
  const score = scoredResults.filter(Boolean).length
  const ratio = scored ? score / scored : 0
  // once the codes are in, trust them (a repeat player keeps the prize they first won)
  const hasTour = prize.status === 'ready' ? Boolean(prize.tourCode) : score >= TOUR_SCORE
  const loading = prize.status === 'loading'
  const timeLeft = useTimeLeft(prize.status === 'ready' ? prize.expires : null)
  const firstName = name ? name.trim().split(/\s+/)[0] : ''

  let title = 'Good catch!'
  let text = "Actually, 90% of people don't know this. Now you know what to look for."
  if (ratio === 1) {
    title = `Legit ${quiz.title.toLowerCase()} expert!`
    text = 'You really know your food. Our team would love to meet you.'
  } else if (score >= TOUR_SCORE) {
    title = 'Almost there!'
    text = 'You know more than most. A few surprises in there, right?'
  }

  return (
    <main className="screen result">
      <div className="confetti" aria-hidden="true">
        {CONFETTI.map((c, i) => (
          <span
            key={i}
            style={{ left: c.left, background: c.color, animationDelay: c.delay, animationDuration: c.duration }}
          />
        ))}
      </div>

      <img className="result-logo" src={logoCream} alt="Legit Farms - Guaranteed Goodness" />

      <div className="result-head">
        <div className="score score-sm">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle className="score-track" cx="60" cy="60" r="54" />
            <circle
              className="score-fill"
              cx="60"
              cy="60"
              r="54"
              strokeDasharray={RING}
              style={{ '--ring': RING, '--offset': RING * (1 - ratio) }}
            />
          </svg>
          <div className="score-text">
            <span className="score-num">{score}</span>
            <span className="score-of">of {scored}</span>
          </div>
        </div>
        <div className="result-head-text">
          <h1>{title}</h1>
          <p>{text}</p>
          <div className="dots" aria-hidden="true">
            {results.map((r, i) => (
              <span key={i} className={r === null ? 'dot' : r ? 'dot yes' : 'dot no'}>
                {r === null ? '•' : r ? '✓' : '✕'}
              </span>
            ))}
          </div>
        </div>
      </div>

      <section className="prizes" aria-label="Your prizes">
        <div className="prizes-hero">
          <span className="prizes-burst" aria-hidden="true">
            🎉
          </span>
          <h2>{firstName ? `Congratulations, ${firstName}!` : 'Congratulations!'}</h2>
          <p>
            {prize.repeat
              ? 'Welcome back! These are the prizes you won earlier.'
              : hasTour
                ? 'You won 2 prizes from Legit Farms'
                : 'You won a prize from Legit Farms'}
          </p>
          {timeLeft && (
            <span className={`prizes-timer${timeLeft === 'Expired' ? ' is-expired' : ''}`}>
              <span className="prizes-timer-dot" aria-hidden="true" /> {timeLeft}
            </span>
          )}
        </div>

        {prize.status === 'error' ? (
          <div className="prizes-error">
            <strong>We couldn't load your codes</strong>
            <span>Check your internet and try again, or show this screen to our team at the stall.</span>
            <button type="button" className="gift-copy" onClick={onRetry}>
              Try again
            </button>
          </div>
        ) : (
          <>
            <PrizeCard
              tone="egg"
              icon={<img src={eggBox} alt="" />}
              kicker={hasTour ? 'Prize 1' : 'Your prize'}
              title="₹303 off coupon"
              worth="₹303"
              code={prize.eggCode}
              loading={loading}
              action={{ label: 'Shop with my coupon', url: prize.eggCode && couponShopUrl(prize.eggCode) }}
              steps={[
                'Tap “Shop with my coupon”. Your code is applied for you.',
                'Add any Legit Farms products to your cart.',
                'At checkout ₹303 comes off your order. Place it and you’re done!',
              ]}
            />
            {hasTour && (
              <PrizeCard
                tone="tour"
                icon={<BarnIcon />}
                kicker="Prize 2"
                title="Free farm tour"
                worth="FREE"
                code={prize.tourCode}
                copyText={prize.tourCode && tourMessage(prize.tourCode)}
                loading={loading}
                action={{ label: 'Book my tour', url: prize.tourCode && tourUrl(prize.tourCode), copyFirst: true }}
                steps={[
                  'Tap “Book my tour”. Your code is filled in on the form for you.',
                  'Add your group size and the date you’d like to visit.',
                  'Send it. Our team will call you to confirm your visit.',
                ]}
              />
            )}
          </>
        )}

        {prize.status === 'ready' && (
          <p className="prizes-foot">
            Valid till <b>{formatExpiry(prize.expires)}</b> · each code works once
            <br />
            Tip: take a screenshot to keep your codes handy 📸
          </p>
        )}
      </section>
      <SiteAd />
    </main>
  )
}

export default function App() {
  // a device that already finished a quiz goes straight back to its result
  const [played] = useState(readPlayed)
  const [screen, setScreen] = useState(played?.results ? 'result' : 'home')
  const [quizId, setQuizId] = useState(played?.results ? played.quizId : null)
  const [results, setResults] = useState(played?.results || [])
  const [player, setPlayer] = useState(null)
  const [leadId, setLeadId] = useState(null)
  const [prize, setPrize] = useState(played?.prize || { status: 'loading' })
  const retried = useRef(false)
  const [hash, setHash] = useState(window.location.hash)

  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // finished before but the codes never arrived (offline, closed the tab): ask again
  useEffect(() => {
    if (retried.current || !played?.results || played.prize?.status === 'ready') return
    retried.current = true
    fetchPrize(played.leadId, played.score)
  }, [played])

  function fetchPrize(id, score) {
    setPrize({ status: 'loading' })
    claimPrize(id, score)
      .then((codes) => {
        const ready = { status: 'ready', ...codes }
        setPrize(ready)
        savePlayed({ prize: ready })
      })
      .catch(() => setPrize({ status: 'error' }))
  }

  const quiz = quizId ? quizzes[quizId] : null

  function go(next) {
    setScreen(next)
    window.scrollTo(0, 0)
  }

  if (hash === '#leads') return <Leads />

  // every quiz start is its own entry, so we know who played Eggs and who played Oils
  function start(id, who) {
    setQuizId(id)
    setLeadId(addLead(who.name, who.phone, quizzes[id].title).id)
    go('quiz')
  }

  if (screen === 'details') {
    return (
      <Details
        quiz={quiz}
        onBack={() => go('home')}
        onSubmit={(name, phone) => {
          const who = { name, phone }
          setPlayer(who)
          start(quizId, who)
        }}
      />
    )
  }

  if (screen === 'quiz') {
    return (
      <Quiz
        quiz={quiz}
        onExit={() => go('home')}
        onDone={(finalResults) => {
          const scored = finalResults.filter((r) => r !== null)
          const score = `${scored.filter(Boolean).length}/${scored.length}`
          updateLead(leadId, { score })
          savePlayed({ quizId, leadId, score, results: finalResults, name: player?.name })
          setResults(finalResults)
          fetchPrize(leadId, score)
          go('result')
        }}
      />
    )
  }

  if (screen === 'result') {
    const saved = readPlayed()
    return (
      <Result
        quiz={quiz}
        results={results}
        prize={prize}
        name={player?.name || saved?.name}
        onRetry={() => fetchPrize(saved.leadId, saved.score)}
      />
    )
  }

  return (
    <Home
      player={player}
      onChangePlayer={() => setPlayer(null)}
      onPick={(id) => {
        if (player) {
          start(id, player)
          return
        }
        setQuizId(id)
        go('details')
      }}
    />
  )
}
