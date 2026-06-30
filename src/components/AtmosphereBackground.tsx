import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

// Dashboard backdrop = ONE of the uploaded artworks, picked at RANDOM (no edition binding,
// no CSS shapes, no sprites). The pool is the images listed in manifest.json (probed so a
// listed-but-missing file is dropped); empty pool → default.webp. A fresh random image is
// chosen each time the dashboard is opened (and on app start) and stays fixed while you
// view it. The UI sits fully on top; this layer only renders the artwork (cover / center /
// no-repeat, responsive) + a ~50% dark overlay + a subtle vignette for readability.

const BG_DIR = '/backgrounds/dashboard'
const DEFAULT_BG = `${BG_DIR}/default.webp`

// Resolve the available artworks: manifest names → URLs → probe each → keep the ones that
// actually load. Empty → [default]. Runs once per session (results are HTTP-cached).
async function loadImages(): Promise<string[]> {
  let names: string[] = []
  try {
    const r = await fetch(`${BG_DIR}/manifest.json`, { cache: 'no-store' })
    if (r.ok) { const j = await r.json(); if (Array.isArray(j)) names = j.filter((n) => typeof n === 'string') }
  } catch { /* no manifest → fall back to default below */ }
  const urls = names.map((n) => (n.startsWith('/') ? n : `${BG_DIR}/${n}`))
  const probed = await Promise.all(urls.map((u) => new Promise<string | null>((res) => {
    const img = new Image(); img.onload = () => res(u); img.onerror = () => res(null); img.src = u
  })))
  const ok = probed.filter((u): u is string => !!u)
  return ok.length ? ok : [DEFAULT_BG]
}

export default function AtmosphereBackground() {
  const atDash = useLocation().pathname === '/'
  const [images, setImages] = useState<string[]>([])
  const [pick, setPick] = useState<string | null>(null)
  const prevAtDash = useRef(false)
  const lastPick = useRef<string | null>(null)

  useEffect(() => { let on = true; loadImages().then((l) => { if (on) setImages(l) }); return () => { on = false } }, [])

  // (Re)pick a random artwork whenever the dashboard is (re)opened — and once the image
  // list first becomes available while already on the dashboard (e.g. app start).
  useEffect(() => {
    if (!images.length) return
    if (atDash && (!prevAtDash.current || pick === null)) {
      let next = images[Math.floor(Math.random() * images.length)]
      if (images.length > 1 && next === lastPick.current) next = images[(images.indexOf(next) + 1) % images.length]
      lastPick.current = next
      setPick(next)
    }
    prevAtDash.current = atDash
  }, [atDash, images, pick])

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {pick && (
        <img src={pick} alt="" draggable={false}
          onError={(e) => { const t = e.currentTarget; if (t.src.indexOf(DEFAULT_BG) === -1) t.src = DEFAULT_BG }}
          className="absolute inset-0 w-full h-full" style={{ objectFit: 'cover', objectPosition: 'center', backgroundColor: '#06070B' }} />
      )}
      {/* readability — ~50% dark overlay + subtle vignette (panel glass stays unchanged) */}
      <div className="absolute inset-0" style={{ background: 'rgba(6,7,11,0.50)' }} />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 70% at 50% 48%, transparent 38%, rgba(0,0,0,0.55) 100%)' }} />
    </div>
  )
}
