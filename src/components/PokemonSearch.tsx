import { useState, useEffect, useRef } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { searchPokemon, getTypeColor, type PokemonBasic } from '../lib/pokemon-api'

interface Props {
  onSelect: (pokemon: PokemonBasic) => void
  placeholder?: string
}

export default function PokemonSearch({ onSelect, placeholder = 'Pokémon suchen (Gen I–V)…' }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PokemonBasic[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return }
    setLoading(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const res = await searchPokemon(query)
      setResults(res)
      setOpen(res.length > 0)
      setLoading(false)
    }, 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function select(p: PokemonBasic) {
    onSelect(p)
    setQuery(p.name)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="pk-input pl-12 pr-12 capitalize"
        />
        {loading && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-pk-red animate-spin pointer-events-none" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-2 w-full bg-[#1c1c26] border border-[#2e2e42] rounded-2xl shadow-2xl max-h-72 overflow-y-auto">
          {results.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => select(p)}
              className="w-full flex items-center gap-4 px-4 py-3 hover:bg-[#252535] transition-colors text-left border-b border-[#1e1e2e] last:border-0"
              style={{ animationDelay: `${i * 0.03}s` }}
            >
              <img
                src={p.sprite}
                alt={p.name}
                className="w-12 h-12 object-contain drop-shadow-sm"
              />
              <div className="flex-1">
                <div className="text-white text-base capitalize font-bold">{p.name}</div>
                <div className="flex gap-1.5 mt-1">
                  {p.types.map((t) => (
                    <span
                      key={t}
                      className="type-badge"
                      style={{ background: getTypeColor(t) }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <span className="text-slate-500 text-sm font-mono">#{String(p.id).padStart(3, '0')}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
