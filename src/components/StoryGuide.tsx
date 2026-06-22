import { useState } from 'react'
import {
  MapPin, Trophy, ArrowRight, CheckCircle2, Circle, Swords, Package, Sparkles,
  AlertTriangle, Gauge, Lock, Compass, Flag, Wifi, ShieldAlert, BookOpen,
} from 'lucide-react'
import { useStoryProgress, supportedStories, type Story, type StoryChapter } from '../lib/story'

const KIND_LABEL: Record<StoryChapter['kind'], string> = {
  town: 'Stadt', route: 'Route', cave: 'Höhle', forest: 'Wald', gym: 'Arena', misc: 'Ort',
}

export default function StoryGuide({ runGame, caughtLocations }: { runGame: string | null; caughtLocations: Set<string> }) {
  const progress = useStoryProgress(runGame)
  if (!progress.story) {
    return (
      <div className="lp-card p-10 text-center">
        <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-4" />
        <h3 className="text-white font-black text-xl mb-2">Story Guide kommt bald</h3>
        <p className="text-slate-400 max-w-md mx-auto">Für diese Edition gibt es noch keinen Guide. Aktuell verfügbar: {supportedStories().map((s) => s.label).join(', ')}.</p>
      </div>
    )
  }
  return <Guide progress={progress} caughtLocations={caughtLocations} />
}

function Guide({ progress, caughtLocations }: { progress: ReturnType<typeof useStoryProgress>; caughtLocations: Set<string> }) {
  const story = progress.story as Story
  const { activeIndex, detectedIndex, connected, teamAvgLevel, isManual, setViewed } = progress
  const chapter = story.chapters[activeIndex]
  const next = story.chapters.slice(activeIndex + 1, activeIndex + 5)

  const TKEY = `soullink-story-todos-${story.game}`
  const [done, setDone] = useState<Set<string>>(() => { try { return new Set(JSON.parse(localStorage.getItem(TKEY) || '[]')) } catch { return new Set<string>() } })
  function toggleTodo(key: string) {
    setDone((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); try { localStorage.setItem(TKEY, JSON.stringify([...n])) } catch { /* ignore */ } return n })
  }

  const lvl = levelStatus(chapter.recommendedLevel, teamAvgLevel)

  return (
    <div className="flex gap-5">
      {/* Chapter navigation */}
      <aside className="hidden lg:block w-56 shrink-0">
        <div className="lp-card p-3 sticky top-20">
          <div className="flex items-center gap-2 px-2 py-2 text-slate-400 text-xs font-black uppercase tracking-wider"><Compass className="w-4 h-4" /> {story.region}</div>
          <div className="space-y-0.5 max-h-[60vh] overflow-y-auto modal-scroll">
            {story.chapters.map((c, i) => {
              const isActive = i === activeIndex
              const isDone = detectedIndex != null && i < detectedIndex
              return (
                <button key={c.id} onClick={() => setViewed(i)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-sm transition-colors ${isActive ? 'bg-pk-red text-white font-bold' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                  {isDone ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" /> : isActive ? <MapPin className="w-4 h-4 shrink-0" /> : <Circle className="w-4 h-4 text-slate-600 shrink-0" />}
                  <span className="truncate">{c.title}</span>
                </button>
              )
            })}
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 space-y-5">
        {/* Mobile chapter strip */}
        <div className="lg:hidden flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {story.chapters.map((c, i) => (
            <button key={c.id} onClick={() => setViewed(i)} className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${i === activeIndex ? 'bg-pk-red text-white' : 'bg-[#16161f] text-slate-400 border border-[#2e2e42]'}`}>{c.title}</button>
          ))}
        </div>

        {/* Current progress hero */}
        <div className="relative lp-card overflow-hidden p-6">
          <div className="absolute inset-0 bg-gradient-to-br from-pk-red/12 via-transparent to-transparent" />
          <div className="relative">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-slate-400 text-xs font-black uppercase tracking-wider">Aktueller Fortschritt</div>
              {connected
                ? (isManual
                    ? <button onClick={() => setViewed(null)} className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#16161f] border border-[#2e2e42] text-slate-400 hover:text-white">Manuell · zurück zum Live-Kapitel</button>
                    : <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-green-500/15 text-green-400 flex items-center gap-1"><Wifi className="w-3 h-3" /> Auto-Sync aktiv</span>)
                : <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#16161f] border border-[#2e2e42] text-slate-500">Kein Live-Sync · manuell</span>}
            </div>
            <div className="flex items-center gap-3 mt-2">
              <MapPin className="w-7 h-7 text-pk-red shrink-0" />
              <div>
                <div className="text-white font-black text-2xl leading-tight">{chapter.title}</div>
                <div className="text-slate-500 text-xs font-bold">{KIND_LABEL[chapter.kind]} · {story.label}</div>
              </div>
            </div>
            {/* progress bar */}
            <div className="mt-4 h-2 rounded-full bg-[#0e0e16] overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-pk-red to-pk-red-light transition-all" style={{ width: `${((activeIndex + 1) / story.chapters.length) * 100}%` }} />
            </div>
            <div className="text-slate-600 text-[11px] mt-1.5">Kapitel {activeIndex + 1} von {story.chapters.length}</div>
          </div>
        </div>

        {/* Main goal + level */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Card icon={<Trophy className="w-4 h-4 text-pk-yellow" />} title="Nächstes Hauptziel">
            <p className="text-white font-bold text-lg leading-snug">{chapter.goal}</p>
          </Card>
          <Card icon={<Gauge className="w-4 h-4 text-pk-red" />} title="Empfohlenes Level">
            {chapter.recommendedLevel
              ? <div>
                  <div className="text-white font-black text-2xl">{chapter.recommendedLevel[0]}–{chapter.recommendedLevel[1]}</div>
                  {lvl
                    ? <div className="text-sm font-bold mt-1 flex items-center gap-1.5" style={{ color: lvl.color }}>{lvl.dot} {lvl.text}{teamAvgLevel != null && <span className="text-slate-500 font-normal">(Team Ø {teamAvgLevel})</span>}</div>
                    : <div className="text-slate-500 text-xs mt-1">Starte den Live-Sync, um deinen Team-Level zu vergleichen.</div>}
                </div>
              : <p className="text-slate-500 text-sm">Keine Levelempfehlung.</p>}
          </Card>
        </div>

        {/* Up next */}
        {next.length > 0 && (
          <Card icon={<ArrowRight className="w-4 h-4 text-slate-400" />} title="Als Nächstes">
            <div className="flex flex-wrap gap-2">
              {next.map((c, i) => (
                <button key={c.id} onClick={() => setViewed(activeIndex + 1 + i)} className="flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full bg-[#16161f] border border-[#2e2e42] text-slate-300 hover:text-white hover:border-pk-red/50 transition-colors">
                  {c.kind === 'gym' ? <Trophy className="w-3.5 h-3.5 text-pk-yellow" /> : <ArrowRight className="w-3.5 h-3.5 text-slate-500" />} {c.title}
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* To-do */}
        <Card icon={<Flag className="w-4 h-4 text-pk-red" />} title="To-do in diesem Kapitel">
          <div className="space-y-1.5">
            {chapter.todos.map((todo, i) => {
              const key = `${chapter.id}:${i}`; const checked = done.has(key)
              return (
                <button key={key} onClick={() => toggleTodo(key)} className="w-full flex items-center gap-2.5 text-left group">
                  {checked ? <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" /> : <Circle className="w-5 h-5 text-slate-600 group-hover:text-slate-400 shrink-0" />}
                  <span className={`text-sm ${checked ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{todo}</span>
                </button>
              )
            })}
          </div>
        </Card>

        {/* Gym */}
        {chapter.gym && (
          <Card icon={<ShieldAlert className="w-4 h-4 text-pk-yellow" />} title={`Arena · ${chapter.gym.leader}`}>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Info label="Typ" value={chapter.gym.type} />
              <Info label="Orden" value={chapter.gym.badge} />
              <Info label="Stark gegen" value={chapter.gym.recommendedTypes.join(', ')} />
              {chapter.gym.keyMoves && <Info label="Achtung Attacken" value={chapter.gym.keyMoves.join(', ')} />}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {chapter.gym.dangerMons.map((m) => (
                <span key={m} className="text-xs font-bold px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3" /> {m}</span>
              ))}
            </div>
          </Card>
        )}

        {/* Trainers */}
        {chapter.trainers && chapter.trainers.length > 0 && (
          <Card icon={<Swords className="w-4 h-4 text-pk-red" />} title="Wichtige Trainer">
            <div className="grid sm:grid-cols-2 gap-3">
              {chapter.trainers.map((tr) => (
                <div key={tr.name} className={`rounded-2xl border p-4 ${tr.danger ? 'border-red-900/50 bg-red-950/15' : 'border-[#2e2e42] bg-[#16161f]'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-black">{tr.name}</span>
                    {tr.danger && <AlertTriangle className="w-4 h-4 text-red-400" />}
                  </div>
                  {tr.title && <div className="text-slate-500 text-xs mb-2">{tr.title}</div>}
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {tr.team.map((m, i) => (
                      <span key={i} className="text-xs font-bold px-2 py-1 rounded-lg bg-[#0e0e16] border border-[#2e2e42] text-slate-300">{m.name} <span className="text-slate-500">Lv{m.level}</span></span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Encounters */}
        {chapter.encounters && chapter.encounters.length > 0 && (
          <Card icon={<MapPin className="w-4 h-4 text-pk-red" />} title="Encounter-Status">
            <div className="space-y-2">
              {chapter.encounters.map((route) => {
                const caught = caughtLocations.has(route.toLowerCase().trim())
                return (
                  <div key={route} className="flex items-center justify-between gap-3 rounded-xl border border-[#2e2e42] bg-[#16161f] px-4 py-2.5">
                    <span className="text-slate-200 text-sm font-bold">{route}</span>
                    {caught
                      ? <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-green-500/15 text-green-400 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Gefangen</span>
                      : <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-pk-yellow/15 text-pk-yellow flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Offen</span>}
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* Items */}
        {(chapter.items?.length || chapter.hiddenItems?.length) ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {chapter.items && chapter.items.length > 0 && (
              <Card icon={<Package className="w-4 h-4 text-pk-yellow" />} title="Wichtige Items">
                <ItemList items={chapter.items} />
              </Card>
            )}
            {chapter.hiddenItems && chapter.hiddenItems.length > 0 && (
              <Card icon={<Sparkles className="w-4 h-4 text-pk-yellow" />} title="Versteckte Items">
                <ItemList items={chapter.hiddenItems} hidden />
              </Card>
            )}
          </div>
        ) : null}

        {/* Team analysis (preparatory) */}
        <div className="lp-card p-5 flex items-center gap-3 opacity-80">
          <Lock className="w-5 h-5 text-slate-500 shrink-0" />
          <div>
            <div className="text-white font-bold text-sm">Team-Analyse</div>
            <div className="text-slate-500 text-xs">Typ-Schwächen & Empfehnungen pro Arena – in Vorbereitung.</div>
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs">Beta · Inhalte werden laufend erweitert</p>
      </div>
    </div>
  )
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="lp-card p-5">
      <div className="flex items-center gap-2 text-slate-400 text-xs font-black uppercase tracking-wider mb-3">{icon} {title}</div>
      {children}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><span className="text-slate-500 text-xs">{label}</span><div className="text-white font-bold">{value}</div></div>
}

function ItemList({ items, hidden }: { items: { name: string; note?: string }[]; hidden?: boolean }) {
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${hidden ? 'bg-pk-yellow' : 'bg-pk-red'}`} />
          <div><span className="text-slate-200 text-sm font-bold">{it.name}</span>{it.note && <span className="text-slate-500 text-xs"> · {it.note}</span>}</div>
        </div>
      ))}
    </div>
  )
}

function levelStatus(range: [number, number] | undefined, teamLevel: number | null) {
  if (!range || teamLevel == null) return null
  const [lo] = range
  if (teamLevel >= lo) return { color: '#4ade80', dot: '🟢', text: 'Dein Team ist bereit.' }
  if (teamLevel >= lo - 2) return { color: '#FFCB05', dot: '🟡', text: 'Dein Team liegt leicht unter der empfohlenen Stufe.' }
  return { color: '#f87171', dot: '🔴', text: 'Dein Team ist unterlevelt – trainiere etwas.' }
}
