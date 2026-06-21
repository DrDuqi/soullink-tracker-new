import { User as UserIcon } from 'lucide-react'

// Uniform, round, softly-glowing avatar showing a transparent shiny sprite.
// Used everywhere a user is shown (header, profile, player list, run, …).
// `src` is the stored profiles.avatar_url (a shiny sprite URL); empty → fallback.
export default function ShinyAvatar({ src, size = 32, ring = true, className = '' }: {
  src?: string | null
  size?: number
  ring?: boolean
  className?: string
}) {
  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-full shrink-0 overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        background: 'radial-gradient(circle at 50% 32%, rgba(255,203,5,0.12), #14141d 72%)',
        border: ring ? '1px solid rgba(255,203,5,0.38)' : '1px solid #2e2e42',
        boxShadow: ring ? '0 0 10px rgba(255,203,5,0.16)' : 'none',
      }}
    >
      {src
        ? <img src={src} alt="" draggable={false} loading="lazy" className="object-contain" style={{ width: '88%', height: '88%' }} />
        : <UserIcon style={{ width: size * 0.5, height: size * 0.5 }} className="text-slate-500" />}
    </span>
  )
}
