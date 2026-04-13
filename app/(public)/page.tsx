'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

// ─────────────────────────────────────────
// Shared icon
// ─────────────────────────────────────────

function CheckIcon({ stroke = '#3D7234' }: { stroke?: string }) {
  return (
    <svg viewBox="0 0 10 10" fill="none" width={10} height={10}>
      <path d="M2 5l2 2 4-4" stroke={stroke} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─────────────────────────────────────────
// Scroll Reveal — class-based (data-* stripped by Next.js)
// Classes: rev-u (up), rev-l (left)  →  add .in when intersecting
// Delay: CSS custom property --d (e.g. style={{ '--d': '100ms' }})
// ─────────────────────────────────────────

const REVEAL_CSS = `
  .rev-u,.rev-l{opacity:0;transition:opacity .5s ease,transform .5s ease;transition-delay:var(--d,0ms);will-change:transform}
  .rev-u{transform:translateY(20px)}
  .rev-l{transform:translateX(-20px)}
  .rev-u.in,.rev-l.in{opacity:1!important;transform:none!important}
  @media(prefers-reduced-motion:reduce){.rev-u,.rev-l{opacity:1!important;transform:none!important;transition:none!important}}
`

function useScrollReveal() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const els = document.querySelectorAll('.rev-u,.rev-l')
    if (reduced) { els.forEach(el => el.classList.add('in')); return }
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target) }
      })
    }, { threshold: 0.15 })
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])
}

// delay helper — returns a React style object with CSS custom property
function d(ms: number): React.CSSProperties { return { '--d': ms + 'ms' } as React.CSSProperties }

// ─────────────────────────────────────────
// Scroll Progress Bar
// ─────────────────────────────────────────

function ScrollProgressBar() {
  const [pct, setPct] = useState(0)
  useEffect(() => {
    const fn = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight
      setPct(total > 0 ? window.scrollY / total : 0)
    }
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: 2,
      background: '#6FA664', zIndex: 200, transformOrigin: 'left',
      transform: `scaleX(${pct})`, transition: 'transform .1s linear', willChange: 'transform',
    }} />
  )
}

// ─────────────────────────────────────────
// Terminal (typing animation)
// ─────────────────────────────────────────

const TYPED = [
  { t: '# Describe your practice in plain English', cls: 'text-sage-400/70' },
  { t: '$ quilp.generate(',                          cls: 'text-white' },
  { t: "  practice: 'Rivera & Associates CPA',",    cls: 'text-white' },
  { t: "  services: ['1040', 'S-Corp', 'bookkeeping'],", cls: 'text-white' },
  { t: "  state: 'Florida'",                         cls: 'text-white' },
  { t: ')',                                           cls: 'text-white' },
]
const RESULTS = [
  '4 engagement letters generated',
  '3 onboarding portals created',
  'Deadline calendar configured',
  'Invoice templates ready',
  'DocuSign integration active',
]

function Terminal() {
  const [done, setDone]         = useState(0)
  const [typed, setTyped]       = useState('')
  const [results, setResults]   = useState(0)
  const [output, setOutput]     = useState(false)
  const [started, setStarted]   = useState(false)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setStarted(true); setDone(TYPED.length); setResults(RESULTS.length); setOutput(true); return
    }
    const ids: ReturnType<typeof setTimeout>[] = []
    let dead = false
    const go = (fn: () => void, ms: number) => { const id = setTimeout(() => { if (!dead) fn() }, ms); ids.push(id) }
    let t = 600; const CHAR = 28, PAUSE = 150
    TYPED.forEach((line, li) => {
      go(() => { setStarted(true); setDone(li); setTyped('') }, t)
      for (let c = 1; c <= line.t.length; c++) {
        const ch = c, idx = li
        go(() => { setDone(idx); setTyped(TYPED[idx].t.slice(0, ch)) }, t + ch * CHAR)
      }
      t += line.t.length * CHAR + PAUSE
      const fi = li
      go(() => { setDone(fi + 1); setTyped('') }, t)
    })
    const rs = t + 100
    RESULTS.forEach((_, i) => go(() => setResults(i + 1), rs + i * 200))
    go(() => setOutput(true), rs + RESULTS.length * 200 + 300)
    return () => { dead = true; ids.forEach(clearTimeout) }
  }, [])

  return (
    <div className="bg-ink rounded-[16px] overflow-hidden shadow-[0_32px_80px_rgba(26,25,22,0.22)]">
      <div className="flex items-center gap-[7px] px-[18px] py-[14px] border-b border-white/[0.07]">
        <div className="w-[10px] h-[10px] rounded-full bg-[#ff5f57]" />
        <div className="w-[10px] h-[10px] rounded-full bg-[#febc2e]" />
        <div className="w-[10px] h-[10px] rounded-full bg-[#28c840]" />
        <span className="font-mono text-[11px] text-white/[0.28] ml-2">quilp — practice setup</span>
      </div>
      <div className="px-[22px] py-5 font-mono text-[clamp(11px,1vw,13px)] leading-[1.9]">
        {TYPED.slice(0, done).map((l, i) => <div key={i}><span className={l.cls}>{l.t}</span></div>)}
        {started && done < TYPED.length && (
          <div>
            <span className={TYPED[done]?.cls ?? 'text-white'}>{typed}</span>
            <span className="term-cursor" />
          </div>
        )}
        {RESULTS.slice(0, results).map((r, i) => (
          <div key={`r${i}`} style={{ animation: 'fadeIn .3s ease forwards' }}>
            <span className="text-white/25">✓ </span><span className="text-sage-400">{r}</span>
          </div>
        ))}
        {done >= TYPED.length && (
          <><div className="h-1" /><div><span className="text-white/25">$ </span><span className="term-cursor" /></div></>
        )}
      </div>
      {output && (
        <div className="mx-[18px] mb-[18px] bg-white rounded-[10px] px-[18px] py-[15px]" style={{ animation: 'fadeIn .4s ease forwards' }}>
          <div className="flex items-center gap-[5px] text-[10px] font-[500] uppercase tracking-[0.07em] text-sage-600 mb-[10px]">
            <div className="w-[5px] h-[5px] rounded-full bg-sage-400" />System generated in 8.4s
          </div>
          {([['Documents ready','12 templates',false],['Hours saved vs. manual','~22 hours',true],['Status','Fully operational ↗',true]] as const).map(([k,v,g]) => (
            <div key={k} className="flex justify-between text-[12px] py-[6px] border-b border-beige-100 last:border-0">
              <span className="text-ink-soft">{k}</span>
              <span className={`font-[500] ${g ? 'text-sage-600' : 'text-ink'}`}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────
// Metric counter
// ─────────────────────────────────────────

function Metric({ prefix='', value, suffix, label, dur, delay }: {
  prefix?: string; value: number; suffix: string; label: string; dur: number; delay: number
}) {
  const [n, setN]         = useState(0)
  const [active, setActive] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        if (reduced) { setN(value) } else { setTimeout(() => setActive(true), delay) }
        obs.disconnect()
      }
    }, { threshold: 0.5 })
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [value, delay])

  useEffect(() => {
    if (!active || value === 0) { setN(value); return }
    const s = performance.now(); let raf: number
    const tick = (now: number) => {
      const p = Math.min((now - s) / dur, 1)
      setN(Math.round((1 - (1 - p) ** 2) * value))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, value, dur])

  return (
    <div ref={ref} className="text-center rev-u" style={d(delay)}>
      <div className="font-serif text-[clamp(28px,3.5vw,42px)] font-[500] text-ink tracking-[-1px]">
        {prefix}{n}<span style={{ opacity: active || value === 0 ? 1 : 0, transition: `opacity .4s ease ${dur}ms` }}>{suffix}</span>
      </div>
      <div className="text-[12px] text-ink-soft mt-0.5">{label}</div>
    </div>
  )
}

// ─────────────────────────────────────────
// Testimonials carousel
// ─────────────────────────────────────────

const TESTIMONIALS = [
  { ini: 'JM', quote: 'I used to spend Sunday nights writing engagement letters. Now I generate them in 30 seconds and spend Sunday with my family.', name: 'Jennifer Mills, CPA', role: 'Solo practice · Austin, TX' },
  { ini: 'RK', quote: 'My client onboarding went from 3 emails and 5 days to one link and one sitting. My clients actually thank me now.',            name: 'Robert Kim, CPA',     role: '3-person firm · Miami, FL' },
  { ini: 'SP', quote: "The deadline dashboard alone is worth every penny. 80 clients and I haven't missed a single filing date since I started.",    name: 'Sandra Perez, CPA',  role: 'Solo practice · Phoenix, AZ' },
]

function Carousel() {
  const [idx,    setIdx]    = useState(0)
  const [cols,   setCols]   = useState(1)
  const [paused, setPaused] = useState(false)
  const touchX = useRef<number | null>(null)
  const intRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const n = TESTIMONIALS.length

  useEffect(() => {
    const fn = () => setCols(window.innerWidth >= 1024 ? 3 : window.innerWidth >= 768 ? 2 : 1)
    fn(); window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  const max  = Math.max(0, n - cols)
  const next = useCallback(() => setIdx(i => i >= max ? 0 : i + 1), [max])
  const prev = useCallback(() => setIdx(i => i <= 0 ? max : i - 1), [max])
  useEffect(() => { setIdx(i => Math.min(i, max)) }, [max])

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (paused || cols >= n || reduced) { if (intRef.current) clearInterval(intRef.current); return }
    intRef.current = setInterval(next, 4000)
    return () => { if (intRef.current) clearInterval(intRef.current) }
  }, [paused, cols, n, next])

  const showNav = cols < n

  return (
    <div className="rev-u">
      <div
        className="relative overflow-hidden"
        onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
        onTouchStart={e => { touchX.current = e.touches[0].clientX }}
        onTouchEnd={e => {
          if (touchX.current === null) return
          const diff = e.changedTouches[0].clientX - touchX.current
          if (diff > 50) prev(); else if (diff < -50) next()
          touchX.current = null
        }}
      >
        <div style={{
          display: 'flex', width: `calc(${n} * 100% / ${cols})`,
          transform: `translateX(calc(-100% * ${idx} / ${n}))`,
          transition: 'transform .4s ease', willChange: 'transform',
        }}>
          {TESTIMONIALS.map(({ ini, quote, name, role }) => (
            <div key={ini} style={{ width: `calc(100% / ${n})`, flexShrink: 0, padding: '0 8px' }}>
              <div className="bg-white border border-beige-200 rounded-[16px] px-7 py-7 flex flex-col gap-4 h-full">
                <div className="text-sage-400 text-[13px] tracking-[2px]">★★★★★</div>
                <p className="font-serif text-[clamp(15px,1.4vw,18px)] text-ink leading-[1.65] italic flex-1">&ldquo;{quote}&rdquo;</p>
                <div className="flex items-center gap-3 mt-auto">
                  <div className="w-[38px] h-[38px] rounded-full bg-sage-50 border border-sage-200 flex items-center justify-center text-[12px] font-[500] text-sage-600 flex-shrink-0">{ini}</div>
                  <div>
                    <div className="text-[13px] font-[500] text-ink">{name}</div>
                    <div className="text-[11px] text-ink-soft">{role}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {showNav && (
          <>
            <button type="button" onClick={prev} aria-label="Previous" className="absolute left-0 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-beige-100 border border-beige-300 flex items-center justify-center text-ink-mid hover:bg-beige-200 transition-colors z-10 text-[20px]">‹</button>
            <button type="button" onClick={next} aria-label="Next"     className="absolute right-0 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-beige-100 border border-beige-300 flex items-center justify-center text-ink-mid hover:bg-beige-200 transition-colors z-10 text-[20px]">›</button>
          </>
        )}
      </div>
      {showNav && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: max + 1 }).map((_, i) => (
            <button key={i} type="button" onClick={() => setIdx(i)} aria-label={`Slide ${i + 1}`}
              style={{ width: i === idx ? 18 : 6, height: 6, borderRadius: 3, padding: 0, border: 'none', cursor: 'pointer',
                background: i === idx ? '#6FA664' : '#D4C9B8', transition: 'width .3s ease, background .3s ease' }} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────
// Landing page
// ─────────────────────────────────────────

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  useScrollReveal()

  return (
    <div className="min-h-screen bg-beige-50 text-ink overflow-x-hidden font-sans">
      <ScrollProgressBar />

      <style>{`
        ${REVEAL_CSS}
        @keyframes blink{50%{opacity:0}}
        .term-cursor{display:inline-block;width:8px;height:14px;background:#6FA664;border-radius:1px;vertical-align:middle;animation:blink 1s step-end infinite}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes ctaPulse{0%,100%{box-shadow:0 0 0 0 rgba(111,166,100,0)}50%{box-shadow:0 0 0 8px rgba(111,166,100,.15)}}
        .cta-pulse{animation:ctaPulse 2s ease infinite}
        .feat-card-hover{transition:transform .2s ease,box-shadow .2s ease,background-color .2s ease}
        .feat-card-hover:hover{transform:translateY(-3px);box-shadow:0 8px 32px rgba(26,25,22,0.12)}
        .step-card-mid:hover{box-shadow:0 0 0 1px rgba(111,166,100,0.4)}
        .step-card-side{transition:transform .2s ease,box-shadow .2s ease,background-color .2s ease}
        .step-card-side:hover{transform:translateY(-2px);box-shadow:0 4px 16px rgba(26,25,22,0.08)}
      `}</style>

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-beige-50/95 backdrop-blur-md border-b border-beige-200">
        <div className="w-full max-w-[1200px] mx-auto px-[clamp(20px,4vw,48px)] h-full flex items-center justify-between gap-4">
          <a href="#" className="font-serif text-[22px] font-[500] tracking-[-0.5px] no-underline" style={{ color: '#1A1916' }}>
            Quilp<span style={{ color: '#6FA664' }}>.</span>
          </a>
          <div className="hidden md:flex items-center gap-7">
            {['#problem','#how','#solutions','#pricing'].map((href, i) => (
              <a key={href} href={href} className="text-[14px] text-ink-mid hover:text-ink transition-colors no-underline">
                {['Problem','How it works','Solutions','Pricing'][i]}
              </a>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Link href="/login"  className="text-[13px] font-[500] text-ink px-[18px] py-2 rounded-[8px] border border-beige-300 hover:bg-beige-100 transition-colors no-underline">Sign in</Link>
            <Link href="/signup" className="text-[13px] font-[500] text-white bg-ink px-5 py-2 rounded-[8px] hover:opacity-80 transition-opacity no-underline">Start free →</Link>
          </div>
          <button type="button" onClick={() => setMenuOpen(o => !o)} className="md:hidden flex flex-col gap-[5px] p-2 bg-transparent border-none cursor-pointer" aria-label="Menu">
            <span className={`block w-[22px] h-[1.5px] bg-ink rounded-sm transition-transform duration-300 ${menuOpen ? 'translate-y-[6.5px] rotate-45' : ''}`} />
            <span className={`block w-[22px] h-[1.5px] bg-ink rounded-sm transition-opacity duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-[22px] h-[1.5px] bg-ink rounded-sm transition-transform duration-300 ${menuOpen ? '-translate-y-[6.5px] -rotate-45' : ''}`} />
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="fixed top-16 left-0 right-0 z-40 bg-white border-b border-beige-200 px-6 pt-5 pb-7 flex flex-col gap-1.5 md:hidden">
          {[['#problem','Problem'],['#how','How it works'],['#solutions','Solutions'],['#pricing','Pricing']].map(([href,label]) => (
            <a key={href} href={href} onClick={() => setMenuOpen(false)} className="text-[15px] text-ink-mid py-2.5 border-b border-beige-100 no-underline">{label}</a>
          ))}
          <div className="flex gap-2 mt-3">
            <Link href="/login"  onClick={() => setMenuOpen(false)} className="flex-1 text-center text-[14px] font-[500] py-3 rounded-[10px] bg-beige-100 text-ink no-underline">Sign in</Link>
            <Link href="/signup" onClick={() => setMenuOpen(false)} className="flex-1 text-center text-[14px] font-[500] py-3 rounded-[10px] bg-ink text-white no-underline">Start free →</Link>
          </div>
        </div>
      )}

      {/* HERO */}
      <section className="relative pt-[calc(64px+80px)] pb-[90px] bg-beige-50 overflow-hidden">
        <div className="absolute top-0 right-0 w-[55%] h-full bg-beige-100 [clip-path:polygon(8%_0,100%_0,100%_100%,0%_100%)] z-0 hidden md:block" />
        <div className="relative z-10 w-full max-w-[1200px] mx-auto px-[clamp(20px,4vw,48px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[44px] md:gap-[60px] items-center">
            <div className="flex flex-col gap-7">
              <div className="inline-flex items-center gap-2 bg-sage-50 border border-sage-200 rounded-full px-4 py-[5px] text-[12px] font-[500] text-sage-600 w-fit" style={{ animation: 'fadeIn .65s ease .05s both' }}>
                <div className="w-[5px] h-[5px] rounded-full bg-sage-400" />Quill + Productivity
              </div>
              <h1 className="font-serif font-bold leading-[1.05] tracking-[-2.5px] text-[clamp(44px,5.5vw,76px)] text-ink" style={{ animation: 'fadeIn .65s ease .15s both' }}>
                <span className="block">Your entire</span>
                <span className="block">practice,</span>
                <em className="not-italic font-[500] text-sage-600 block">built in</em>
                <em className="not-italic font-[500] text-sage-600 block">90 seconds.</em>
              </h1>
              <p className="text-[clamp(15px,1.5vw,18px)] text-ink-mid leading-[1.8] max-w-[500px] font-light" style={{ animation: 'fadeIn .65s ease .25s both' }}>
                Describe your firm in plain English. Quilp generates your{' '}
                <strong className="font-[500] text-ink">engagement letters, client portals, invoices, deadline dashboards, and workflows</strong>
                {' '}— automatically. No templates. No setup. No IT team.
              </p>
              <div className="flex gap-2 max-w-[460px] flex-wrap" style={{ animation: 'fadeIn .65s ease .35s both' }}>
                <input type="email" placeholder="your@firm.com" className="flex-1 min-w-[180px] text-[14px] text-ink bg-white border border-beige-300 rounded-[10px] px-[18px] py-[14px] outline-none focus:border-sage-400 transition-colors placeholder:text-ink-soft" />
                <button type="button" className="text-[14px] font-[500] bg-sage-400 text-white px-6 py-[14px] rounded-[10px] hover:bg-sage-600 transition-colors whitespace-nowrap border-none cursor-pointer">Get early access →</button>
              </div>
              <div className="flex items-center gap-3 text-[12px] text-ink-soft flex-wrap" style={{ animation: 'fadeIn .65s ease .44s both' }}>
                <span>No credit card required</span>
                <div className="w-px h-3 bg-beige-300 hidden sm:block" />
                <span>30-day free trial</span>
                <div className="w-px h-3 bg-beige-300 hidden sm:block" />
                <span>Setup in 3 minutes</span>
              </div>
            </div>
            <div style={{ animation: 'fadeIn .7s ease .25s both' }}>
              <Terminal />
            </div>
          </div>
        </div>
      </section>

      {/* METRICS */}
      <div className="border-t border-b border-beige-200 bg-white py-8">
        <div className="w-full max-w-[1200px] mx-auto px-[clamp(20px,4vw,48px)]">
          <div className="flex justify-center items-center gap-[clamp(24px,6vw,80px)] flex-wrap">
            <Metric value={89} suffix="K+" label="accounting firms in the US"  dur={1200} delay={0}   />
            <div className="w-px h-[44px] bg-beige-200 hidden sm:block" />
            <Metric value={6}  suffix=" hrs" label="saved per client onboarded" dur={800}  delay={100} />
            <div className="w-px h-[44px] bg-beige-200 hidden sm:block" />
            <Metric value={90} suffix="s"    label="to generate your full system" dur={1000} delay={200} />
            <div className="w-px h-[44px] bg-beige-200 hidden sm:block" />
            <Metric prefix="$" value={0} suffix="" label="setup cost, ever"       dur={0}    delay={300} />
          </div>
        </div>
      </div>

      {/* PROBLEM */}
      <section id="problem" className="bg-beige-50 py-[clamp(72px,8vw,112px)]">
        <div className="w-full max-w-[1200px] mx-auto px-[clamp(20px,4vw,48px)]">
          <div className="rev-l text-[11px] font-[500] tracking-[0.1em] uppercase text-sage-600 mb-[14px]">The problem</div>
          <h2 className="rev-u font-serif text-[clamp(30px,4vw,52px)] font-[500] text-ink tracking-[-1.5px] leading-[1.1] mb-4" style={d(100)}>
            Professionals waste 40%<br />of their week on <em className="not-italic text-sage-600">non-work.</em>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-9 md:gap-[60px] items-start mt-[52px]">
            <div>
              <p className="rev-u text-[15px] text-ink-mid leading-[1.85] mb-5 font-light" style={d(200)}>
                Every solo CPA, attorney, and consultant in America spends{' '}
                <strong className="font-[500] text-ink">30–40% of their week</strong>{' '}
                on work that has nothing to do with their actual profession — manually writing engagement letters, chasing documents by email, copy-pasting invoices, and tracking deadlines in spreadsheets.
              </p>
              <p className="rev-u text-[15px] text-ink-mid leading-[1.85] mb-5 font-light" style={d(280)}>
                When a new client signs up, the average professional spends{' '}
                <strong className="font-[500] text-ink">5–6 hours on onboarding alone</strong>
                {' '}— drafting contracts, collecting documents, setting up billing. Every single time. From scratch. That&apos;s $1,500–$2,400 of invisible cost per client, per year.
              </p>
              <blockquote className="rev-u border-l-[3px] border-sage-400 pl-[22px] py-4 bg-sage-50 rounded-r-[12px] font-serif text-[16px] italic text-ink leading-[1.7]" style={d(360)}>
                &ldquo;I became a CPA to do accounting — not spend my Sundays writing engagement letters and chasing documents.&rdquo;
                <cite className="block text-[12px] not-italic text-ink-soft mt-2 font-sans">— Jennifer Mills, CPA · Solo practice · Austin, TX</cite>
              </blockquote>
            </div>
            <div className="flex flex-col gap-[14px]">
              {[
                ['6h+',    'Lost per client onboarding',             'Every new client requires a contract, document checklist, billing setup, and follow-ups — all manual, all from scratch, every time.',           0  ],
                ['$1,500', 'Invisible cost per client per year',     'At $300/hr billing rate, 5 hours of admin per client = $1,500 of time you could be billing. Multiply by 40 clients.',                         80 ],
                ['44K',    'Solo CPAs with zero operational system', "Running on Excel, Gmail, and Word in 2025. The chaos is the norm — and it doesn't have to be.",                                               160],
                ['0',      'AI tools built for this segment',        'No product below $400/month generates a complete practice system using AI. Quilp is the first.',                                              240],
              ].map(([num, title, body, delay]) => (
                <div key={num as string} className="rev-u bg-white border border-beige-200 rounded-[16px] px-6 py-[22px] flex gap-[18px] items-start" style={d(delay as number)}>
                  <div className="font-serif text-[clamp(24px,2.5vw,34px)] font-[500] text-sage-400 leading-none min-w-[70px]">{num}</div>
                  <div>
                    <div className="text-[14px] font-[500] text-ink mb-[5px]">{title}</div>
                    <div className="text-[13px] text-ink-mid leading-[1.65]">{body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="bg-beige-100 border-t border-b border-beige-200 py-[clamp(72px,8vw,112px)]">
        <div className="w-full max-w-[1200px] mx-auto px-[clamp(20px,4vw,48px)]">
          <div className="rev-l text-[11px] font-[500] tracking-[0.1em] uppercase text-sage-600 mb-[14px]">How it works</div>
          <h2 className="rev-u font-serif text-[clamp(30px,4vw,52px)] font-[500] text-ink tracking-[-1.5px] leading-[1.1] mb-4" style={d(100)}>
            Three steps.<br /><em className="not-italic text-sage-600">One complete system.</em>
          </h2>
          <p className="rev-u text-[clamp(14px,1.4vw,17px)] text-ink-mid max-w-[580px] leading-[1.85] font-light mb-[52px]" style={d(200)}>
            No consultants. No onboarding calls. No IT. You describe, Quilp builds, you run your practice.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-beige-200 rounded-[18px] overflow-hidden">
            {([
              { num: '01', title: 'Describe your practice', body: "Tell Quilp about your firm in plain English — services, states, client types, fee model. Two minutes. No forms. Just type naturally, the way you'd explain it to a colleague.", tag: 'Natural language input', delay: 0,   type: 'side' },
              { num: '02', title: 'AI builds everything',   body: 'Quilp generates your engagement letters, client portals, invoice templates, deadline dashboards, and workflows — all tailored to your practice in under 90 seconds.',                    tag: 'Generated in under 90s', delay: 120, type: 'mid'  },
              { num: '03', title: 'Run fully automated',    body: 'Onboard clients, send documents for e-sign, collect files, issue invoices, and track every deadline — all from one dashboard. Everything connected.',                                     tag: 'Everything connected',   delay: 240, type: 'side' },
            ] as const).map(({ num, title, body, tag, delay, type }) => (
              <div key={num}
                className={`rev-u bg-beige-50 hover:bg-white px-8 py-[38px] flex flex-col gap-4 ${type === 'mid' ? 'step-card-mid transition-[box-shadow,background-color] duration-200' : 'step-card-side'}`}
                style={d(delay)}
              >
                <div className="font-serif text-[52px] font-normal text-beige-300 leading-none">{num}</div>
                <h3 className="font-serif text-[20px] font-normal text-ink leading-[1.3]">{title}</h3>
                <p className="text-[13.5px] text-ink-mid leading-[1.8] font-light flex-1">{body}</p>
                <span className="inline-block text-[11px] font-[500] px-[14px] py-1 rounded-full bg-sage-50 text-sage-600 border border-sage-200 w-fit mt-auto">{tag}</span>
              </div>
            ))}
          </div>
          <div className="rev-u bg-white border border-beige-200 rounded-[16px] px-7 py-6 mt-12" style={d(100)}>
            <div className="text-[10px] font-[500] tracking-[0.08em] uppercase text-ink-soft mb-3">Example — what a CPA types into Quilp</div>
            <p className="font-serif text-[clamp(14px,1.3vw,16px)] text-ink-mid leading-[1.85] italic">
              &ldquo;I run a solo CPA practice in <strong className="text-ink not-italic">Tampa, Florida</strong>. I do{' '}
              <strong className="text-ink not-italic">individual 1040s, S-Corps, and monthly bookkeeping</strong>{' '}
              for small businesses under $2M. Flat-fee for taxes, monthly retainers for bookkeeping. About 40 active clients.&rdquo;
            </p>
            <div className="flex items-start gap-3 mt-[18px] pt-4 border-t border-beige-100 text-[12px] text-ink-soft flex-wrap">
              <span className="pt-1 whitespace-nowrap">Quilp generates →</span>
              <div className="flex flex-wrap gap-1.5">
                {['4 engagement letters','3 onboarding portals','Full IRS deadline calendar','Invoice templates','Tax doc checklist — 1040','DocuSign integration'].map(t => (
                  <span key={t} className="text-[11px] font-[500] px-[14px] py-1 rounded-full bg-sage-50 text-sage-600 border border-sage-200">{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SOLUTIONS */}
      <section id="solutions" className="bg-ink py-[clamp(72px,8vw,112px)]">
        <div className="w-full max-w-[1200px] mx-auto px-[clamp(20px,4vw,48px)]">
          <div className="rev-l text-[11px] font-[500] tracking-[0.1em] uppercase text-sage-400 mb-[14px]">What&apos;s included</div>
          <h2 className="rev-u font-serif text-[clamp(30px,4vw,52px)] font-[500] text-white tracking-[-1.5px] leading-[1.1] mb-4" style={d(100)}>
            Six modules.<br /><em className="not-italic text-sage-400">Everything your practice needs.</em>
          </h2>
          <p className="rev-u text-[16px] text-white/40 max-w-[560px] leading-[1.85] font-light mb-[52px]" style={d(200)}>
            Each module auto-generated from your practice description. No manual setup. No configuration. Works from day one.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-px bg-white/[0.07] rounded-[18px] overflow-hidden">
            {[
              { icon: <svg viewBox="0 0 18 18" fill="none" width={18} height={18}><rect x="3" y="2" width="12" height="14" rx="2" stroke="#6FA664" strokeWidth="1.2"/><line x1="6" y1="7" x2="12" y2="7" stroke="#6FA664" strokeWidth="1.2" strokeLinecap="round"/><line x1="6" y1="10" x2="10" y2="10" stroke="#6FA664" strokeWidth="1.2" strokeLinecap="round"/></svg>, title: 'Document Generator',       body: 'Engagement letters, proposals, IRS Form 2848 — state-compliant, AICPA-standard, editable. Never write a contract from scratch again.',                                  delay: 0   },
              { icon: <svg viewBox="0 0 18 18" fill="none" width={18} height={18}><rect x="2" y="2" width="6" height="6" rx="1.5" stroke="#6FA664" strokeWidth="1.2"/><rect x="10" y="2" width="6" height="6" rx="1.5" stroke="#6FA664" strokeWidth="1.2"/><rect x="2" y="10" width="6" height="6" rx="1.5" stroke="#6FA664" strokeWidth="1.2"/><rect x="10" y="10" width="6" height="6" rx="1.5" stroke="#6FA664" strokeWidth="1.2"/></svg>, title: 'Client Onboarding Portal', body: 'A branded, secure portal per service type. Clients sign letters and upload documents without a single email attachment. You get notified instantly.',               delay: 60  },
              { icon: <svg viewBox="0 0 18 18" fill="none" width={18} height={18}><rect x="2" y="4" width="14" height="11" rx="2" stroke="#6FA664" strokeWidth="1.2"/><line x1="2" y1="8" x2="16" y2="8" stroke="#6FA664" strokeWidth="1.2"/><line x1="6" y1="2" x2="6" y2="6" stroke="#6FA664" strokeWidth="1.2" strokeLinecap="round"/><line x1="12" y1="2" x2="12" y2="6" stroke="#6FA664" strokeWidth="1.2" strokeLinecap="round"/></svg>, title: 'Deadline Dashboard',         body: 'Every IRS filing deadline for every client — 1040, S-Corp, payroll, extensions. Automatic alerts at 30, 14, and 7 days. Zero missed filings.',                          delay: 120 },
              { icon: <svg viewBox="0 0 18 18" fill="none" width={18} height={18}><path d="M9 2v14M5 6h8M5 12h8" stroke="#6FA664" strokeWidth="1.2" strokeLinecap="round"/></svg>, title: 'Billing & Invoicing',        body: 'Auto-generate invoices on delivery. Recurring billing for retainers. Stripe integration for online payment. AR aging so nothing slips.',                               delay: 180 },
              { icon: <svg viewBox="0 0 18 18" fill="none" width={18} height={18}><circle cx="9" cy="7" r="3.5" stroke="#6FA664" strokeWidth="1.2"/><path d="M3 16c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="#6FA664" strokeWidth="1.2" strokeLinecap="round"/></svg>, title: 'Client Pipeline',             body: 'Track every client from prospect to delivered — Engaged → Onboarding → In Progress → Filed. Always know what needs attention first.',                                   delay: 240 },
              { icon: <svg viewBox="0 0 18 18" fill="none" width={18} height={18}><circle cx="9" cy="9" r="6.5" stroke="#6FA664" strokeWidth="1.2"/><path d="M6.5 9l2 2 3.5-3.5" stroke="#6FA664" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>, title: 'Practice Memory AI',          body: 'Every edit you make teaches Quilp your preferences. After 90 days, the system knows your practice better than any template ever could.',                                delay: 300 },
            ].map(({ icon, title, body, delay }) => (
              <div key={title} className="rev-u feat-card-hover bg-ink hover:bg-white/[0.04] px-[30px] py-[34px] flex flex-col gap-[14px]" style={d(delay)}>
                <div className="w-10 h-10 rounded-[10px] bg-sage-400/10 border border-sage-400/20 flex items-center justify-center">{icon}</div>
                <h3 className="text-[16px] font-[500] text-white">{title}</h3>
                <p className="text-[13px] text-white/40 leading-[1.8] font-light flex-1">{body}</p>
                <div className="text-[12px] font-[500] text-sage-400 mt-auto">Learn more →</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MOAT */}
      <section className="bg-beige-50 py-[clamp(72px,8vw,112px)]">
        <div className="w-full max-w-[1200px] mx-auto px-[clamp(20px,4vw,48px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-9 md:gap-[72px] items-center">
            <div>
              <div className="rev-l text-[11px] font-[500] tracking-[0.1em] uppercase text-sage-600 mb-[14px]">Under the hood</div>
              <h2 className="rev-u font-serif text-[clamp(30px,4vw,52px)] font-[500] text-ink tracking-[-1.5px] leading-[1.1] mb-4" style={d(100)}>
                AI that learns<br /><em className="not-italic text-sage-600">your practice.</em>
              </h2>
              <p className="rev-u text-[clamp(14px,1.4vw,17px)] text-ink-mid leading-[1.85] font-light mb-2" style={d(200)}>
                Quilp isn&apos;t a template engine. It gets smarter with every document you edit, every client you onboard, every deadline you track.
              </p>
              <div className="flex flex-col gap-4 mt-2">
                {[
                  ['Practice memory',            'learns your clause preferences, formatting, and fee structures. Every edit makes the next generation better.',        0  ],
                  ['State-aware',                'compliance language built for your jurisdiction automatically. Florida, Texas, New York — each one is different.',    80 ],
                  ['AICPA-aligned',              'every engagement letter follows professional standards by default. No legal review required.',                        160],
                  ['DocuSign + Stripe built-in', 'send for signature and collect payment without leaving Quilp. One click.',                                           240],
                ].map(([strong, rest, delay]) => (
                  <div key={strong as string} className="rev-u flex items-start gap-3 text-[14px] text-ink-mid leading-[1.7]" style={d(delay as number)}>
                    <div className="w-5 h-5 rounded-full bg-sage-50 border border-sage-200 flex items-center justify-center flex-shrink-0 mt-[2px]"><CheckIcon /></div>
                    <span><strong className="text-ink font-[500]">{strong}</strong> — {rest}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rev-u bg-ink rounded-[16px] px-[26px] py-[26px] font-mono text-[clamp(11px,1vw,13px)] leading-[2.1] overflow-x-auto" style={d(100)}>
              {[
                ['1','cc','// Practice memory in action'],
                ['2','',''],
                ['3','m',[['kw','const'],['w',' doc = '],['kw','await'],['w',' quilp']]],
                ['4','m',[['w','  .generate('],['s',"'engagement_letter'"],['w',', {']]],
                ['5','m',[['w','    client: '],['s',"'Sarah Mitchell'"],['w',',']]],
                ['6','m',[['w','    service: '],['s',"'1040'"],['w',',']]],
                ['7','m',[['w','    year: '],['n','2024']]],
                ['8','w','  })'],
                ['9','',''],
                ['10','cc','// ✓ Applies Rivera practice style'],
                ['11','cc','// ✓ Florida-compliant clauses'],
                ['12','cc','// ✓ Flat-fee structure applied'],
                ['13','cc','// ✓ AICPA standard followed'],
              ].map(([n, type, content]) => (
                <div key={n as string} className="flex gap-[14px]">
                  <span className="text-white/[0.18] min-w-[18px] text-right text-[11px] select-none">{n}</span>
                  {type === 'cc' && <span className="text-sage-400/60 italic">{content as string}</span>}
                  {type === ''  && <span />}
                  {type === 'w' && <span className="text-white">{content as string}</span>}
                  {type === 'm' && (
                    <span>
                      {(content as [string,string][]).map(([t,v],i) => (
                        <span key={i} className={t==='kw'?'text-beige-400':t==='s'?'text-sage-200':t==='n'?'text-sage-400':'text-white'}>{v}</span>
                      ))}
                    </span>
                  )}
                </div>
              ))}
              <div className="h-[6px]" />
              <div className="flex gap-[14px]">
                <span className="text-white/[0.18] min-w-[18px] text-right text-[11px] select-none">14</span>
                <span><span className="text-beige-400">await</span><span className="text-white"> doc.send({'{ via: '}</span><span className="text-sage-200">&apos;docusign&apos;</span><span className="text-white"> {'}'})</span></span>
              </div>
              <div className="flex gap-[14px]">
                <span className="text-white/[0.18] min-w-[18px] text-right text-[11px] select-none">15</span>
                <span className="text-sage-400/60 italic">{'//'} → Signed in avg 2 hours</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="bg-beige-100 border-t border-b border-beige-200 py-[clamp(72px,8vw,112px)]">
        <div className="w-full max-w-[1200px] mx-auto px-[clamp(20px,4vw,48px)]">
          <div className="rev-l text-[11px] font-[500] tracking-[0.1em] uppercase text-sage-600 mb-[14px]">What professionals are saying</div>
          <h2 className="rev-u font-serif text-[clamp(30px,4vw,52px)] font-[500] text-ink tracking-[-1.5px] leading-[1.1] mb-12" style={d(100)}>
            Real practices.<br /><em className="not-italic text-sage-600">Real results.</em>
          </h2>
          <div className="px-10">
            <Carousel />
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="bg-beige-50 py-[clamp(72px,8vw,112px)]">
        <div className="w-full max-w-[1200px] mx-auto px-[clamp(20px,4vw,48px)]">
          <div className="rev-l text-[11px] font-[500] tracking-[0.1em] uppercase text-sage-600 mb-[14px]">Pricing</div>
          <h2 className="rev-u font-serif text-[clamp(30px,4vw,52px)] font-[500] text-ink tracking-[-1.5px] leading-[1.1] mb-4" style={d(100)}>
            Simple pricing.<br /><em className="not-italic text-sage-600">No surprises.</em>
          </h2>
          <p className="rev-u text-[clamp(14px,1.4vw,17px)] text-ink-mid max-w-[580px] leading-[1.85] font-light mb-14" style={d(200)}>
            Start free for 30 days. Upgrade when ready. Cancel anytime.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-[420px] md:max-w-none mx-auto">
            {/* Solo */}
            <div className="rev-u bg-white border border-beige-200 rounded-[16px] p-[30px] flex flex-col gap-[18px]" style={d(0)}>
              <div className="text-[11px] font-[500] tracking-[0.07em] uppercase text-ink-soft">Solo</div>
              <div className="flex items-baseline gap-1">
                <span className="font-serif text-[clamp(34px,3.5vw,48px)] font-[500] text-ink tracking-[-1px]">$199</span>
                <span className="text-[13px] text-ink-soft">/month</span>
              </div>
              <p className="text-[13px] text-ink-mid leading-[1.65]">For solo professionals with up to 50 active clients.</p>
              <div className="h-px bg-beige-200" />
              <div className="flex flex-col gap-[11px] flex-1">
                {['Document generator — all types','Client onboarding portal','Deadline dashboard','10 DocuSign sends/month','Email support'].map(f => (
                  <div key={f} className="flex items-start gap-2.5 text-[13px] text-ink-mid">
                    <div className="w-[17px] h-[17px] rounded-full bg-sage-50 border border-sage-200 flex items-center justify-center flex-shrink-0 mt-[1px]"><CheckIcon /></div>{f}
                  </div>
                ))}
              </div>
              <Link href="/signup" className="block text-center text-[14px] font-[500] py-[14px] rounded-[10px] bg-transparent text-ink border border-beige-300 hover:opacity-85 transition-opacity no-underline mt-auto">Start free trial</Link>
            </div>

            {/* Practice */}
            <div className="rev-u bg-ink border-2 border-ink rounded-[16px] p-[30px] flex flex-col gap-[18px] relative" style={d(80)}>
              <div className="absolute -top-[13px] left-1/2 -translate-x-1/2 text-[11px] font-[500] px-4 py-1 rounded-full bg-sage-400 text-white whitespace-nowrap">Most popular</div>
              <div className="text-[11px] font-[500] tracking-[0.07em] uppercase text-white/40">Practice</div>
              <div className="flex items-baseline gap-1">
                <span className="font-serif text-[clamp(34px,3.5vw,48px)] font-[500] text-white tracking-[-1px]">$399</span>
                <span className="text-[13px] text-white/35">/month</span>
              </div>
              <p className="text-[13px] text-white/[0.42] leading-[1.65]">For firms with up to 3 staff and unlimited clients.</p>
              <div className="h-px bg-white/10" />
              <div className="flex flex-col gap-[11px] flex-1">
                {['Everything in Solo','Unlimited clients & DocuSign','Billing & invoicing (Stripe)','Practice memory AI','Priority support + onboarding'].map(f => (
                  <div key={f} className="flex items-start gap-2.5 text-[13px] text-white/50">
                    <div className="w-[17px] h-[17px] rounded-full bg-sage-400/[0.12] border border-sage-400/[0.25] flex items-center justify-center flex-shrink-0 mt-[1px]"><CheckIcon stroke="#6FA664" /></div>{f}
                  </div>
                ))}
              </div>
              <Link href="/signup" className="block text-center text-[14px] font-[500] py-[14px] rounded-[10px] bg-white text-ink hover:opacity-85 transition-opacity no-underline mt-auto">Start free trial</Link>
            </div>

            {/* Firm */}
            <div className="rev-u bg-white border border-beige-200 rounded-[16px] p-[30px] flex flex-col gap-[18px]" style={d(160)}>
              <div className="text-[11px] font-[500] tracking-[0.07em] uppercase text-ink-soft">Firm</div>
              <div className="flex items-baseline gap-1">
                <span className="font-serif text-[clamp(34px,3.5vw,48px)] font-[500] text-ink tracking-[-1px]">$699</span>
                <span className="text-[13px] text-ink-soft">/month</span>
              </div>
              <p className="text-[13px] text-ink-mid leading-[1.65]">For firms with up to 10 staff, white-label, and API.</p>
              <div className="h-px bg-beige-200" />
              <div className="flex flex-col gap-[11px] flex-1">
                {['Everything in Practice','White-label client portal','Custom reports & analytics','API access + integrations','Dedicated account manager'].map(f => (
                  <div key={f} className="flex items-start gap-2.5 text-[13px] text-ink-mid">
                    <div className="w-[17px] h-[17px] rounded-full bg-sage-50 border border-sage-200 flex items-center justify-center flex-shrink-0 mt-[1px]"><CheckIcon /></div>{f}
                  </div>
                ))}
              </div>
              <Link href="/signup" className="block text-center text-[14px] font-[500] py-[14px] rounded-[10px] bg-transparent text-ink border border-beige-300 hover:opacity-85 transition-opacity no-underline mt-auto">Start free trial</Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <div className="bg-ink py-[clamp(80px,10vw,120px)] text-center">
        <div className="w-full max-w-[1200px] mx-auto px-[clamp(20px,4vw,48px)]">
          <div className="rev-l text-[11px] font-[500] tracking-[0.1em] uppercase text-sage-400 mb-5">Ready to start?</div>
          <h2 className="rev-u font-serif text-[clamp(34px,5vw,64px)] font-bold text-white tracking-[-2px] leading-[1.05] mb-[18px]" style={d(100)}>
            Stop doing it<br />the hard way.<br /><em className="not-italic font-[500] text-sage-400">Use Quilp.</em>
          </h2>
          <p className="rev-u text-[17px] text-white/40 max-w-[460px] mx-auto mb-10 leading-[1.85] font-light" style={d(200)}>
            Join professionals already running their practices on Quilp. Up in 3 minutes. No credit card required.
          </p>
          <div className="rev-u flex gap-[14px] justify-center flex-wrap" style={d(280)}>
            <Link href="/signup" className="cta-pulse text-[15px] font-[500] bg-sage-400 text-white px-9 py-4 rounded-[10px] hover:bg-sage-600 transition-colors no-underline">
              Start your free trial →
            </Link>
            <a href="#how" className="text-[15px] text-white/45 bg-transparent px-7 py-4 rounded-[10px] border border-white/[0.14] no-underline hover:text-white/70 transition-colors">
              Schedule a demo
            </a>
          </div>
          <div className="mt-7 text-[12px] text-white/20">No credit card · 30-day free trial · Cancel anytime</div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="bg-ink border-t border-white/[0.06] py-9">
        <div className="w-full max-w-[1200px] mx-auto px-[clamp(20px,4vw,48px)]">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <span className="font-serif text-[18px] font-[500] tracking-[-0.4px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Quilp<span style={{ color: '#6FA664' }}>.</span>
            </span>
            <div className="flex gap-5 flex-wrap">
              {[['#','Product'],['#pricing','Pricing'],['/privacy','Privacy'],['/terms','Terms'],['mailto:hello@quilp.com','hello@quilp.com']].map(([href,label]) => (
                <a key={label} href={href} className="text-[12px] text-white/25 no-underline hover:text-white/50 transition-colors">{label}</a>
              ))}
            </div>
            <span className="text-[12px] text-white/[0.16]">© 2025 Quilp. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
