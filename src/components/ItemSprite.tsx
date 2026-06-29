import { useEffect, useState } from 'react'
import { Package } from 'lucide-react'
import { itemSprite } from '../lib/dex/items'

// Item image with a clean fallback: when no sprite exists for this slug (many TMs, key
// and data items), show a neutral package glyph instead of an empty box.
export default function ItemSprite({ name, size = 32 }: { name: string; size?: number }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => { setBroken(false) }, [name])
  if (broken) return <Package style={{ width: size * 0.7, height: size * 0.7 }} className="text-slate-600" />
  return (
    <img src={itemSprite(name)} alt="" draggable={false} loading="lazy" onError={() => setBroken(true)}
      style={{ width: size, height: size, imageRendering: 'pixelated' }} className="object-contain" />
  )
}
