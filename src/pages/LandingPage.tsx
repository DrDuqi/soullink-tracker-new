import { useEffect, useRef, useState } from 'react'
import {
  Zap, Users, Link2, Package, Cloud, BarChart3, Check, X, ArrowRight, ArrowDown,
  ShieldCheck, Download, Monitor, Gamepad2, Radar, Tv, Shuffle, Skull,
  Video, LogIn, UserPlus, Eye, EyeOff, Loader2, Star, Wifi,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { LINKS } from '../lib/appInfo'
import AtmosphereBackground from '../components/AtmosphereBackground'

const SPRITE = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`

function PokeBall({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="4" />
      <path d="M2,50 H98" stroke="currentColor" strokeWidth="4" />
      <path d="M2,50 Q2,2 50,2 Q98,2 98,50" fill="currentColor" opacity="0.8" />
      <circle cx="50" cy="50" r="14" fill="currentColor" stroke="currentColor" strokeWidth="4" />
      <circle cx="50" cy="50" r="8" fill="white" opacity="0.9" />
    </svg>
  )
}

/** Fades + lifts its children into view on scroll (once). */
function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { el.classList.add('in'); io.unobserve(el) } })
    }, { threshold: 0.12 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>
}

const goLogin = () => document.getElementById('login')?.scrollIntoView({ behavior: 'smooth' })
const goDemo = () => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })

function SectionTitle({ kicker, title, sub }: { kicker?: string; title: React.ReactNode; sub?: string }) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-14">
      {kicker && <div className="text-pk-red font-black tracking-[0.2em] text-xs uppercase mb-3">{kicker}</div>}
      <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-[1.05]">{title}</h2>
      {sub && <p className="text-slate-400 text-lg mt-4">{sub}</p>}
    </div>
  )
}

// ═══════════════════════════════════ Header ═══════════════════════════════════
function LandingHeader() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'glass border-b border-white/5 py-3' : 'py-5'}`}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <PokeBall className="w-7 h-7 text-pk-red" />
          <span className="text-white font-black text-lg tracking-tight">SoulLink<span className="text-pk-red">.</span></span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={goLogin} className="text-slate-300 hover:text-white text-sm font-bold px-3 sm:px-4 py-2 rounded-xl hover:bg-white/5 transition-colors">Anmelden</button>
          <button onClick={goLogin} className="btn-primary text-sm !py-2.5 !px-5 flex items-center gap-1.5">Kostenlos starten <ArrowRight className="w-4 h-4" /></button>
        </div>
      </div>
    </header>
  )
}

// ════════════════════════════════════ Hero ════════════════════════════════════
function Hero() {
  return (
    <section className="relative min-h-[92vh] flex flex-col items-center justify-center text-center px-5 pt-28 pb-16">
      <div className="anim-fade-up inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-pk-red/30 mb-8">
        <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pk-red opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-pk-red" /></span>
        <span className="text-slate-200 text-xs font-bold tracking-wide">Live-Emulator-Sync · Jetzt kostenlos verfügbar</span>
      </div>

      <h1 className="anim-fade-up delay-1 max-w-5xl text-4xl sm:text-6xl md:text-7xl font-black text-white tracking-tight leading-[1.02]">
        Der erste Pokémon SoulLink&nbsp;Tracker mit <span className="lp-grad-text">Live-Emulator-Sync.</span>
      </h1>

      <p className="anim-fade-up delay-2 max-w-2xl text-lg sm:text-xl text-slate-300 mt-8 leading-relaxed">
        Dein Team wird automatisch aus <span className="text-white font-bold">BizHawk</span> erkannt.
        <span className="block mt-3 text-slate-400 text-base sm:text-lg">Keine Zettel. Keine Excel-Listen. Keine manuelle Eingabe. <span className="text-white font-semibold">Einfach spielen.</span></span>
      </p>

      <div className="anim-fade-up delay-3 flex flex-col sm:flex-row items-center gap-4 mt-10">
        <a href={LINKS.download} className="btn-primary text-lg !px-9 !py-4 flex items-center gap-2 shadow-2xl">
          <Download className="w-5 h-5" /> Companion herunterladen
        </a>
        <button onClick={goLogin} className="btn-ghost text-base !px-7 !py-4 flex items-center gap-2">Kostenlos anmelden <ArrowRight className="w-4 h-4" /></button>
      </div>
      <p className="anim-fade-up delay-4 text-slate-500 text-sm mt-5">Windows-App · Kostenlos · Keine Werbung · <button onClick={goDemo} className="text-slate-400 hover:text-white underline underline-offset-2">Live-Sync ansehen</button></p>

      <button onClick={goDemo} aria-label="Mehr" className="absolute bottom-6 left-1/2 -translate-x-1/2 text-slate-600 hover:text-slate-300 transition-colors">
        <ArrowDown className="w-6 h-6 animate-bounce" />
      </button>
    </section>
  )
}

// ════════════════════════════ Live-Sync demo (USP) ════════════════════════════
function MiniMon({ id, label, live }: { id: number; label?: string; live?: boolean }) {
  return (
    <div className="relative flex flex-col items-center">
      {live && <span className="absolute -top-2 -right-2 z-10 text-[8px] font-black px-1.5 py-0.5 rounded bg-green-500 text-black flex items-center gap-0.5"><Wifi className="w-2.5 h-2.5" />LIVE</span>}
      <div className="w-12 h-12 rounded-xl bg-[#0e0e16] border border-[#2e2e42] flex items-center justify-center overflow-hidden">
        <img src={SPRITE(id)} alt="" className="w-10 h-10 object-contain" />
      </div>
      {label && <span className="text-[9px] text-slate-400 mt-1 font-bold">{label}</span>}
    </div>
  )
}

function LiveSyncDemo() {
  const STEPS = ['BizHawk läuft', 'Pokémon gefangen', 'Companion erkennt', 'Erscheint im Team', 'Partner sieht es live']
  const [step, setStep] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 1750)
    return () => clearInterval(id)
  }, [STEPS.length])

  const caught = step >= 1
  const detected = step >= 2
  const inTeam = step >= 3
  const onPartner = step >= 4

  const Stage = ({ active, icon, title, children }: { active: boolean; icon: React.ReactNode; title: string; children: React.ReactNode }) => (
    <div className={`relative flex-1 min-w-[150px] rounded-2xl border p-4 transition-all duration-500 ${active ? 'border-pk-red/60 bg-pk-red/5 lp-glow-red' : 'border-[#2e2e42] bg-[#15151e]'}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${active ? 'bg-pk-red text-white' : 'bg-[#22222e] text-slate-500'}`}>{icon}</span>
        <span className={`text-xs font-black uppercase tracking-wider ${active ? 'text-white' : 'text-slate-500'}`}>{title}</span>
      </div>
      {children}
    </div>
  )

  const Arrow = ({ on }: { on: boolean }) => (
    <div className="hidden lg:flex items-center justify-center w-10 shrink-0">
      <div className="relative h-0.5 w-full rounded bg-[#2e2e42] overflow-hidden">{on && <div className="absolute inset-0 ls-flow" />}</div>
    </div>
  )

  return (
    <div className="lp-card p-6 sm:p-8 max-w-5xl mx-auto">
      <div className="flex flex-col lg:flex-row items-stretch gap-3 lg:gap-0">
        {/* BizHawk */}
        <Stage active={step <= 1} icon={<Monitor className="w-4 h-4" />} title="BizHawk">
          <div className="relative rounded-lg bg-gradient-to-b from-[#1a2a1a] to-[#0e1a0e] border border-[#2e3e2e] h-[88px] overflow-hidden flex items-center justify-center">
            <div className="absolute inset-x-0 h-6 bg-pk-yellow/10 ls-scan" style={{ animation: 'lsScan 1.75s linear infinite' }} />
            <div className="flex flex-col items-center">
              <img src={SPRITE(6)} alt="" className={`w-12 h-12 object-contain transition-all duration-500 ${caught ? 'opacity-30 scale-90' : 'ls-float'}`} />
              <span className="text-[9px] font-bold mt-0.5 transition-colors" style={{ color: caught ? '#4ade80' : '#fbbf24' }}>{caught ? '✓ Gefangen!' : 'Wildes Glurak!'}</span>
            </div>
          </div>
        </Stage>
        <Arrow on={caught} />

        {/* Companion */}
        <Stage active={step === 2} icon={<Radar className="w-4 h-4" />} title="Companion">
          <div className="h-[88px] flex flex-col items-center justify-center gap-2">
            <span className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all ${detected ? 'border-pk-red text-pk-red ls-radar' : 'border-[#2e2e42] text-slate-600'}`}>
              <Radar className="w-6 h-6" />
            </span>
            <span className="text-[9px] font-bold transition-colors" style={{ color: detected ? '#f87171' : '#64748b' }}>{detected ? 'Erkannt: Glurak' : 'Scannt…'}</span>
          </div>
        </Stage>
        <Arrow on={detected} />

        {/* Dein Team */}
        <Stage active={step === 3} icon={<Users className="w-4 h-4" />} title="Dein Team">
          <div className="h-[88px] grid grid-cols-3 gap-1.5 content-center">
            <div className={`transition-all duration-500 ${inTeam ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}><MiniMon id={6} /></div>
            <MiniMon id={9} />
            <MiniMon id={3} />
          </div>
        </Stage>
        <Arrow on={inTeam} />

        {/* Partner */}
        <Stage active={step === 4} icon={<Wifi className="w-4 h-4" />} title="Partner">
          <div className="h-[88px] grid grid-cols-3 gap-1.5 content-center">
            <div className={`transition-all duration-700 ${onPartner ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}><MiniMon id={6} live /></div>
            <MiniMon id={154} />
            <MiniMon id={160} />
          </div>
        </Stage>
      </div>

      {/* Step ticker */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className={`text-[11px] sm:text-xs font-bold px-3 py-1.5 rounded-full transition-all ${i === step ? 'bg-pk-red text-white' : i < step ? 'bg-pk-red/15 text-pk-red' : 'bg-[#16161f] text-slate-500 border border-[#2e2e42]'}`}>
              {i + 1}. {s}
            </span>
            {i < STEPS.length - 1 && <ArrowRight className="w-3 h-3 text-slate-600 hidden sm:block" />}
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════ Warum SoulLink? ══════════════════════════════
function WhySection() {
  const olds = ['Excel-Tabellen', 'Discord-Nachrichten', 'Notizen', 'Zettel', 'Manuelles Eintragen']
  const news = ['Live Emulator Sync', 'Multiplayer', 'Encounter Tracking', 'SoulLinks', 'Team Analyse', 'Cloud Speicherung']
  return (
    <section className="py-24 px-5">
      <SectionTitle kicker="Der Unterschied" title="Warum SoulLink?" sub="Schluss mit dem Chaos aus Tabellen und Chats. Ein Tool, das alles automatisch macht." />
      <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
        <Reveal className="rounded-3xl border border-[#3a2a2a] bg-[#1a1316]/60 p-7">
          <div className="flex items-center gap-2 mb-5"><span className="text-slate-500 font-black uppercase text-sm tracking-wider">Vorher</span></div>
          <ul className="space-y-3">
            {olds.map((o) => (
              <li key={o} className="flex items-center gap-3 text-slate-400">
                <span className="w-6 h-6 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center shrink-0"><X className="w-4 h-4" /></span>
                <span className="line-through decoration-slate-600">{o}</span>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={120} className="rounded-3xl border border-pk-red/30 bg-gradient-to-b from-pk-red/10 to-transparent p-7 lp-glow-red">
          <div className="flex items-center gap-2 mb-5"><span className="text-pk-red font-black uppercase text-sm tracking-wider">Mit SoulLink</span></div>
          <ul className="space-y-3">
            {news.map((n) => (
              <li key={n} className="flex items-center gap-3 text-white font-semibold">
                <span className="w-6 h-6 rounded-lg bg-green-500/15 text-green-400 flex items-center justify-center shrink-0"><Check className="w-4 h-4" /></span>
                {n}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}

// ═══════════════════════════════ Hauptfeatures ════════════════════════════════
const FEATURES = [
  { icon: Zap, title: 'Live Emulator Sync', desc: 'Der Companion erkennt dein Team automatisch. Keine manuelle Eingabe.', hero: true },
  { icon: Users, title: 'Multiplayer', desc: 'Spiele mit bis zu 3 Spielern gleichzeitig. Alle Teams werden live synchronisiert.' },
  { icon: Link2, title: 'SoulLinks', desc: 'Pokémon automatisch miteinander verbinden. Keine Fehler mehr.' },
  { icon: Package, title: 'Companion', desc: 'Einmal installieren, einmal BizHawk auswählen. Danach läuft alles automatisch.' },
  { icon: Cloud, title: 'Cloud', desc: 'Alle Runs werden gespeichert. Von überall verfügbar.' },
  { icon: BarChart3, title: 'Team Analyse', desc: 'Stärken, Schwächen und Typen sofort erkennen.' },
]
function FeaturesSection() {
  return (
    <section className="py-24 px-5">
      <SectionTitle kicker="Alles dabei" title="Alles, was ein SoulLink braucht" />
      <div className="max-w-6xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={(i % 3) * 90}>
            <div className={`lp-card h-full p-7 ${f.hero ? 'lp-glow-red' : ''}`}>
              <span className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 ${f.hero ? 'bg-pk-red text-white' : 'bg-pk-red/10 text-pk-red'}`}><f.icon className="w-6 h-6" /></span>
              <h3 className="text-white font-black text-xl mb-2">{f.title}</h3>
              <p className="text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

// ════════════════════════════════ So funktioniert's ═══════════════════════════
const STEPS = [
  { icon: UserPlus, title: 'Kostenlos registrieren', desc: 'In 30 Sekunden ein Konto erstellen.' },
  { icon: Download, title: 'Companion herunterladen', desc: 'Ein Klick, eine Installation.' },
  { icon: Monitor, title: 'BizHawk auswählen', desc: 'Einmal den Emulator verbinden.' },
  { icon: Gamepad2, title: 'Pokémon spielen', desc: 'Fang dein Team wie gewohnt.' },
  { icon: Zap, title: 'Alles synchronisiert sich', desc: 'Automatisch. In Echtzeit.' },
]
function HowItWorks() {
  return (
    <section className="py-24 px-5">
      <SectionTitle kicker="In 5 Schritten" title="So funktioniert's" />
      <div className="max-w-6xl mx-auto relative">
        <div className="hidden lg:block absolute top-7 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-pk-red/10 via-pk-red/40 to-pk-red/10" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 90} className="relative text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[#15151e] border border-pk-red/30 flex items-center justify-center text-pk-red relative z-10 mb-4 shadow-lg">
                <s.icon className="w-6 h-6" />
                <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-pk-red text-white text-xs font-black flex items-center justify-center">{i + 1}</span>
              </div>
              <h3 className="text-white font-bold mb-1.5">{s.title}</h3>
              <p className="text-slate-500 text-sm">{s.desc}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ════════════════════════════ Unterstützte Editionen ══════════════════════════
const EDITIONS = [
  { name: 'Feuerrot', from: '#E3350D', to: '#7a1206' }, { name: 'Blattgrün', from: '#4CAF50', to: '#1b5e20' },
  { name: 'Rubin', from: '#A00000', to: '#5a0000' }, { name: 'Saphir', from: '#0066CC', to: '#003a73' },
  { name: 'Smaragd', from: '#00A050', to: '#00532a' }, { name: 'Platin', from: '#9FA8DA', to: '#4a5078' },
  { name: 'HeartGold', from: '#D4AF37', to: '#7a6212' }, { name: 'SoulSilver', from: '#C0C0C0', to: '#6e6e76' },
  { name: 'Schwarz', from: '#3a3a44', to: '#121216' }, { name: 'Weiß', from: '#E8E8E8', to: '#8a8a92' },
]
function EditionsSection() {
  return (
    <section className="py-24 px-5">
      <SectionTitle kicker="Gen I – V" title="Für deine Lieblings-Edition" sub="Von Kanto bis Einall — die Klassiker werden unterstützt." />
      <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {EDITIONS.map((e, i) => (
          <Reveal key={e.name} delay={(i % 5) * 70}>
            <div className="group relative rounded-2xl border border-white/8 overflow-hidden h-28 flex items-end p-4 transition-transform duration-300 hover:-translate-y-1.5"
              style={{ background: `linear-gradient(150deg, ${e.from}, ${e.to})` }}>
              <div className="absolute inset-0 bg-black/25 group-hover:bg-black/10 transition-colors" />
              <PokeBall className="absolute -right-4 -top-4 w-20 h-20 text-white/15" />
              <span className="relative text-white font-black text-lg drop-shadow">{e.name}</span>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

// ═══════════════════════════════════ Für wen? ═════════════════════════════════
const AUDIENCE = [
  { icon: Link2, label: 'SoulLinks' }, { icon: Skull, label: 'Nuzlockes' }, { icon: Shuffle, label: 'Randomizer' },
  { icon: Tv, label: 'Streamer' }, { icon: Users, label: 'Freunde' }, { icon: Video, label: 'Content Creator' },
]
function ForWhomSection() {
  return (
    <section className="py-24 px-5">
      <SectionTitle kicker="Gebaut für" title="Für wen ist SoulLink?" />
      <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-3 gap-4">
        {AUDIENCE.map((a, i) => (
          <Reveal key={a.label} delay={(i % 3) * 80}>
            <div className="lp-card flex items-center gap-3 p-5">
              <span className="w-11 h-11 rounded-xl bg-pk-red/10 text-pk-red flex items-center justify-center shrink-0"><a.icon className="w-5 h-5" /></span>
              <span className="text-white font-bold">{a.label}</span>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

// ═══════════════════════════════════ Screenshots ══════════════════════════════
function ScreenshotsSection() {
  const SHOTS = [
    { label: 'Dashboard', render: () => (
      <div className="space-y-3">
        {[['Platin SoulLink', '2 Spieler'], ['HeartGold Nuzlocke', '3 Spieler'], ['Feuerrot Randomizer', '2 Spieler']].map(([n, p]) => (
          <div key={n} className="flex items-center justify-between bg-[#15151e] border border-[#2e2e42] rounded-xl px-4 py-3">
            <div className="flex items-center gap-3"><PokeBall className="w-6 h-6 text-pk-red" /><span className="text-white font-bold text-sm">{n}</span></div>
            <span className="text-slate-500 text-xs">{p}</span>
          </div>
        ))}
      </div>
    ) },
    { label: 'Live Sync', render: () => (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-green-400 text-xs font-bold"><Wifi className="w-4 h-4" /> Companion verbunden · Live</div>
        <div className="grid grid-cols-6 gap-2">{[6, 9, 3, 154, 160, 197].map((id) => <div key={id} className="bg-[#15151e] border border-[#2e2e42] rounded-lg p-1.5"><img src={SPRITE(id)} alt="" className="w-full h-9 object-contain" /></div>)}</div>
      </div>
    ) },
    { label: 'Teamverwaltung', render: () => (
      <div className="grid grid-cols-3 gap-2">{[1, 4, 7, 25, 133, 143].map((id) => <div key={id} className="bg-[#15151e] border border-[#2e2e42] rounded-xl p-2 flex flex-col items-center"><img src={SPRITE(id)} alt="" className="w-12 h-12 object-contain" /></div>)}</div>
    ) },
    { label: 'Encounter Tracking', render: () => (
      <div className="space-y-2">
        {[['Route 203', 18, 'alive'], ['Erzfels', 74, 'dead'], ['Kraterberg', 95, 'alive']].map(([r, id, st]) => (
          <div key={r as string} className="flex items-center gap-3 bg-[#15151e] border border-[#2e2e42] rounded-xl px-3 py-2">
            <img src={SPRITE(id as number)} alt="" className="w-9 h-9 object-contain" />
            <span className="text-white text-sm font-bold flex-1">{r}</span>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded ${st === 'dead' ? 'bg-red-500/15 text-red-400' : 'bg-green-500/15 text-green-400'}`}>{st === 'dead' ? 'TOT' : 'LEBT'}</span>
          </div>
        ))}
      </div>
    ) },
    { label: 'Analyse', render: () => (
      <div className="space-y-2.5">
        {[['Feuer', 80, '#E3350D'], ['Wasser', 60, '#0066CC'], ['Pflanze', 45, '#4CAF50'], ['Elektro', 30, '#FFCB05']].map(([t, w, c]) => (
          <div key={t as string} className="flex items-center gap-3">
            <span className="text-slate-400 text-xs w-14">{t}</span>
            <div className="flex-1 h-2.5 rounded-full bg-[#15151e] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${w}%`, background: c as string }} /></div>
          </div>
        ))}
      </div>
    ) },
  ]
  const [active, setActive] = useState(0)
  return (
    <section className="py-24 px-5">
      <SectionTitle kicker="Einblicke" title="Sieh es dir an" />
      <div className="max-w-4xl mx-auto">
        <Reveal>
          {/* Browser frame */}
          <div className="lp-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-[#0e0e16]">
              <span className="w-3 h-3 rounded-full bg-red-500/70" /><span className="w-3 h-3 rounded-full bg-yellow-500/70" /><span className="w-3 h-3 rounded-full bg-green-500/70" />
              <span className="ml-3 text-slate-500 text-xs font-mono">soullink.app / {SHOTS[active].label.toLowerCase().replace(' ', '-')}</span>
            </div>
            <div key={active} className="p-6 sm:p-8 min-h-[220px] anim-fade">{SHOTS[active].render()}</div>
          </div>
        </Reveal>
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
          {SHOTS.map((s, i) => (
            <button key={s.label} onClick={() => setActive(i)}
              className={`text-sm font-bold px-4 py-2 rounded-xl transition-all ${i === active ? 'bg-pk-red text-white' : 'bg-[#16161f] text-slate-400 border border-[#2e2e42] hover:text-white'}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

// ═══════════════════════════════════ Vergleich ════════════════════════════════
function ComparisonSection() {
  const rows = ['Live Emulator Sync', 'Multiplayer', 'Automatische Teams', 'Cloud Speicherung', 'Companion mit Auto-Updates']
  return (
    <section className="py-24 px-5">
      <SectionTitle kicker="Im Vergleich" title="SoulLink vs. der Rest" sub="Excel, Discord, manuelles Eintragen — oder einfach spielen." />
      <Reveal className="max-w-3xl mx-auto">
        <div className="lp-card overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto]">
            <div className="px-5 py-4 text-slate-500 font-bold text-sm">Funktion</div>
            <div className="px-5 py-4 text-slate-400 font-bold text-sm text-center w-28">Andere</div>
            <div className="px-5 py-4 text-pk-red font-black text-sm text-center w-28 bg-pk-red/5">SoulLink</div>
            {rows.map((r) => (
              <div key={r} className="contents">
                <div className="px-5 py-4 text-white font-semibold border-t border-white/5">{r}</div>
                <div className="px-5 py-4 flex justify-center border-t border-white/5"><X className="w-5 h-5 text-slate-600" /></div>
                <div className="px-5 py-4 flex justify-center border-t border-white/5 bg-pk-red/5"><Check className="w-5 h-5 text-green-400" /></div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  )
}

// ═══════════════════════════════════ Coming Soon ══════════════════════════════
const SOON = ['Story Guide', 'Orden Tracker', 'Pokédex', 'Attacken-Datenbank', 'Komplettlösung', 'Pokémon-Suche (PokéWiki integriert)', 'Trainer-Datenbank', 'Team-Empfehlungen', 'Routen-Übersicht']
function ComingSoonSection() {
  return (
    <section className="py-24 px-5">
      <SectionTitle kicker="Roadmap" title="Bald verfügbar" sub="Dieses Projekt entwickelt sich aktiv weiter." />
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SOON.map((s, i) => (
          <Reveal key={s} delay={(i % 3) * 80}>
            <div className="lp-card flex items-center justify-between gap-3 p-5">
              <div className="flex items-center gap-3"><Star className="w-5 h-5 text-pk-yellow shrink-0" /><span className="text-white font-bold">{s}</span></div>
              <span className="text-[10px] font-black uppercase tracking-wider text-pk-yellow/80 bg-pk-yellow/10 px-2 py-1 rounded shrink-0">Bald</span>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

// ═══════════════════════════════ Vertrauen schaffen ═══════════════════════════
const TRUST = ['Kostenlos', 'Keine Werbung', 'Companion mit Auto-Updates', 'Cloud Speicherung', 'Aktive Weiterentwicklung']
function TrustSection() {
  return (
    <section className="py-20 px-5">
      <Reveal className="max-w-4xl mx-auto rounded-3xl border border-white/8 bg-gradient-to-b from-[#16161f] to-[#0e0e14] p-8 sm:p-12">
        <div className="flex items-center justify-center gap-2 mb-8"><ShieldCheck className="w-6 h-6 text-green-400" /><span className="text-white font-black text-xl">Worauf du dich verlassen kannst</span></div>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
          {TRUST.map((t) => (
            <div key={t} className="flex items-center gap-2 text-slate-200 font-semibold"><Check className="w-5 h-5 text-green-400" /> {t}</div>
          ))}
        </div>
      </Reveal>
    </section>
  )
}

// ════════════════════════════════════ Login ═══════════════════════════════════
function PasswordField({ value, onChange, placeholder, autoComplete, minLength }: { value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string; minLength?: number }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pk-input pr-11" required minLength={minLength} autoComplete={autoComplete} />
      <button type="button" tabIndex={-1} onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors" aria-label={show ? 'Passwort verbergen' : 'Passwort anzeigen'}>
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
}

function AuthSection() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function switchMode(m: typeof mode) { setMode(m); setError(''); setNotice('') }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(''); setNotice('')
    if (mode === 'login') {
      const { error } = await signIn(email, password); if (error) setError(error)
    } else if (mode === 'register') {
      const { error } = await signUp(email, password, username); if (error) setError(error)
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
      if (error) setError('Link konnte nicht gesendet werden.'); else setNotice('Wenn ein Konto existiert, haben wir dir einen Link gesendet.')
    }
    setLoading(false)
  }

  return (
    <section id="login" className="py-24 px-5 scroll-mt-20">
      <div className="max-w-md mx-auto text-center mb-8">
        <h2 className="text-3xl font-black text-white">Jetzt kostenlos starten</h2>
        <p className="text-slate-400 mt-2">Erstelle dein Konto und sync dein erstes Team in Minuten.</p>
      </div>
      <Reveal className="max-w-md mx-auto">
        <div className="flex glass border border-[#2e2e42] rounded-2xl p-1.5 mb-5">
          {(['login', 'register'] as const).map((m) => (
            <button key={m} onClick={() => switchMode(m)} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all"
              style={mode === m ? { background: '#CC0000', color: 'white' } : { color: '#94a3b8' }}>
              {m === 'login' ? <><LogIn className="w-4 h-4" /> Anmelden</> : <><UserPlus className="w-4 h-4" /> Registrieren</>}
            </button>
          ))}
        </div>

        {error && <div className="bg-red-950/60 border border-red-800 text-red-400 rounded-xl p-4 mb-5 text-sm font-medium">{error}</div>}
        {notice && <div className="bg-green-950/50 border border-green-800 text-green-400 rounded-xl p-4 mb-5 text-sm font-medium">{notice}</div>}

        <form onSubmit={submit} className="lp-card p-7 space-y-5">
          {mode === 'register' && (
            <div>
              <label className="text-slate-300 text-sm font-bold mb-2 block">Benutzername</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="z. B. Valon" className="pk-input" required minLength={3} />
              <p className="text-slate-600 text-xs mt-1.5">Eindeutig · wird automatisch als dein Spielername verwendet.</p>
            </div>
          )}
          <div>
            <label className="text-slate-300 text-sm font-bold mb-2 block">E-Mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="du@beispiel.de" className="pk-input" required autoComplete="email" />
          </div>
          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-slate-300 text-sm font-bold">Passwort</label>
                {mode === 'login' && <button type="button" onClick={() => switchMode('forgot')} className="text-slate-500 hover:text-pk-red text-xs font-semibold transition-colors">Passwort vergessen?</button>}
              </div>
              <PasswordField value={password} onChange={setPassword} placeholder={mode === 'register' ? 'Mind. 6 Zeichen' : '••••••••'} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={mode === 'register' ? 6 : undefined} />
            </div>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full text-base py-4 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : mode === 'login' ? <>Anmelden</> : mode === 'register' ? <>Konto erstellen</> : <>Link senden</>}
          </button>
          {mode === 'forgot' && <button type="button" onClick={() => switchMode('login')} className="text-slate-500 hover:text-white text-sm w-full transition-colors">← Zurück zur Anmeldung</button>}
        </form>
      </Reveal>
    </section>
  )
}

// ════════════════════════════════════ Footer ══════════════════════════════════
function Footer() {
  return (
    <footer className="border-t border-white/5 py-10 px-5">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5"><PokeBall className="w-6 h-6 text-pk-red" /><span className="text-white font-black">SoulLink<span className="text-pk-red">.</span></span></div>
        <p className="text-slate-600 text-sm text-center">Der erste SoulLink Tracker mit echtem Live-Emulator-Sync · Pokémon Gen I–V</p>
        <p className="text-slate-700 text-xs">© {new Date().getFullYear()} SoulLink</p>
      </div>
    </footer>
  )
}

// ════════════════════════════════════ Page ════════════════════════════════════
export default function LandingPage() {
  return (
    <div className="relative min-h-screen text-white overflow-x-hidden">
      <AtmosphereBackground />
      <div className="relative z-10">
        <LandingHeader />
        <Hero />

        {/* Everything below the hero sits on an opaque base so the atmosphere stays a hero effect */}
        <div className="relative bg-[#0a0a10]">
          <section id="demo" className="py-24 px-5 scroll-mt-20">
            <SectionTitle kicker="Das Alleinstellungsmerkmal" title={<>Dein Team erscheint <span className="lp-grad-text">automatisch.</span></>} sub="Vom Fang im Emulator bis ins Team deines Partners — vollautomatisch, in Echtzeit." />
            <LiveSyncDemo />
            <p className="text-center text-slate-500 text-sm mt-6 max-w-xl mx-auto">Kein anderer Tracker liest dein Team direkt aus dem Emulator. Das ist SoulLink.</p>
          </section>

          <WhySection />
          <FeaturesSection />
          <HowItWorks />
          <EditionsSection />
          <ForWhomSection />
          <ScreenshotsSection />
          <ComparisonSection />
          <ComingSoonSection />
          <TrustSection />
          <AuthSection />
          <Footer />
        </div>
      </div>
    </div>
  )
}
