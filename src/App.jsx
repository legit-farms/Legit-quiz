import { useEffect, useRef, useState } from 'react'
import { categories, quizzes } from './data/quizzes.js'
import { addLead, claimPrize, clearLeads, leadsCsv, readLeads, updateLead } from './leads.js'
import logoCream from './assets/logo-cream.png'

const LETTERS = ['a', 'b', 'c', 'd', 'e']
const RING = 2 * Math.PI * 54
// score needed to win the farm tour on top of the 6 eggs
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

function Details({ quiz, onSubmit, onBack }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')

  function submit(e) {
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
    onSubmit(cleanName, phone)
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
          />
        </div>
      </label>

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      <button className="btn" type="submit">
        Start the quiz <span aria-hidden="true">&rarr;</span>
      </button>
      <p className="details-note">Your details stay with Legit Farms.</p>
    </form>
    </main>
  )
}

function Home({ player, onChangePlayer, onPick }) {
  return (
    <main className="screen home">
      <section className="hero">
        <img className="hero-logo" src={logoCream} alt="Legit Farms - Guaranteed Goodness" />
        <h1>
          Let's find out how much you know <span>about your food</span>
        </h1>
        <p>5 quick questions. 1 minute.</p>
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
                  {!trick && (
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
    </main>
  )
}

function EggIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M12 2.5c-3.6 0-6.5 6-6.5 10.6a6.5 6.5 0 0 0 13 0C18.5 8.5 15.6 2.5 12 2.5Z" fill="currentColor" />
      <ellipse cx="9.6" cy="9" rx="1.3" ry="2.2" fill="#fff" opacity="0.45" />
    </svg>
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

function PrizeCode({ prize, code, hint }) {
  const [copied, setCopied] = useState(false)
  if (prize.status === 'loading') return <div className="prize-code is-loading" aria-hidden="true" />
  if (prize.status !== 'ready' || !code) return null

  function copy() {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    })
  }

  return (
    <div className="prize-code-wrap">
      <div className="prize-code">
        <span className="prize-code-text">{code}</span>
        <button type="button" className="prize-copy-btn" onClick={copy}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <small className="prize-hint">{hint}</small>
    </div>
  )
}

function Result({ quiz, results, prize, onRestart }) {
  const scoredResults = results.filter((r) => r !== null)
  const scored = scoredResults.length
  const score = scoredResults.filter(Boolean).length
  const ratio = scored ? score / scored : 0
  // once the codes are in, trust them (a repeat player keeps the prize they first won)
  const hasTour = prize.status === 'ready' ? Boolean(prize.tourCode) : score >= TOUR_SCORE

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
      {ratio >= 0.5 && (
        <div className="confetti" aria-hidden="true">
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              style={{ left: c.left, background: c.color, animationDelay: c.delay, animationDuration: c.duration }}
            />
          ))}
        </div>
      )}

      <img className="result-logo" src={logoCream} alt="Legit Farms - Guaranteed Goodness" />

      <div className="score">
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
          <span className="score-of">out of {scored}</span>
        </div>
      </div>

      <div className="dots" aria-hidden="true">
        {results.map((r, i) => (
          <span key={i} className={r === null ? 'dot' : r ? 'dot yes' : 'dot no'}>
            {r === null ? '•' : r ? '✓' : '✕'}
          </span>
        ))}
      </div>

      <h1>{title}</h1>
      <p className="lead">{text}</p>
      <section className="prize" aria-label="Your prize">
        <div className="prize-head">
          <span className="prize-ribbon">You've won</span>
        </div>
        <ul className="prize-list">
          {hasTour && (
            <li className="prize-item">
              <div className="prize-row">
                <span className="prize-icon" aria-hidden="true">
                  <BarnIcon />
                </span>
                <span className="prize-copy">
                  <strong>Free farm tour</strong>
                  <small>Meet our hens on open pasture</small>
                </span>
                <span className="prize-badge">Free</span>
              </div>
              <PrizeCode prize={prize} code={prize.tourCode} hint="Show this code to our team to book your tour" />
            </li>
          )}
          <li className="prize-item">
            <div className="prize-row">
              <span className="prize-icon" aria-hidden="true">
                <EggIcon />
              </span>
              <span className="prize-copy">
                <strong>Pasture-raised eggs</strong>
                <small>Fresh from Legit Farms</small>
              </span>
              <span className="prize-badge">×6</span>
            </div>
            <PrizeCode prize={prize} code={prize.eggCode} hint="Use this code at checkout on legitfarms.com" />
          </li>
        </ul>
        <p className="prize-foot">
          {prize.status === 'ready' ? (
            <>
              {prize.repeat && 'You already have a prize on this number. '}
              Valid till <b>{formatExpiry(prize.expires)}</b> · one-time use
            </>
          ) : prize.status === 'error' ? (
            'Show this screen to our team at the stall to claim it.'
          ) : (
            'Getting your codes…'
          )}
        </p>
      </section>
      <button className="btn btn-yolk" onClick={onRestart}>
        Play again
      </button>
    </main>
  )
}

export default function App() {
  const [screen, setScreen] = useState('home')
  const [quizId, setQuizId] = useState(null)
  const [results, setResults] = useState([])
  const [player, setPlayer] = useState(null)
  const [leadId, setLeadId] = useState(null)
  const [prize, setPrize] = useState({ status: 'loading' })
  const prizeFor = useRef(null)
  const [hash, setHash] = useState(window.location.hash)

  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

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
          setResults(finalResults)
          // ignore a late answer if they have already moved on to another quiz
          setPrize({ status: 'loading' })
          prizeFor.current = leadId
          claimPrize(leadId, score)
            .then((codes) => prizeFor.current === leadId && setPrize({ status: 'ready', ...codes }))
            .catch(() => prizeFor.current === leadId && setPrize({ status: 'error' }))
          go('result')
        }}
      />
    )
  }

  if (screen === 'result') {
    return <Result quiz={quiz} results={results} prize={prize} onRestart={() => go('home')} />
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
