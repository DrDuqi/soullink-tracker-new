import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  title: string
  message: ReactNode
  note?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Themed confirmation dialog — replaces native window.confirm across the app. */
export default function ConfirmDialog({
  title, message, note, confirmLabel = 'Bestätigen', cancelLabel = 'Abbrechen',
  danger, busy, onConfirm, onCancel,
}: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[300] p-4 anim-fade" onClick={onCancel}>
      <div className="bg-[#1c1c26] rounded-3xl w-full max-w-sm border border-[#2e2e42] shadow-2xl anim-pop" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2e42]">
          <h2 className="text-white font-black text-lg">{title}</h2>
          <button onClick={onCancel} className="text-slate-500 hover:text-white p-1.5 hover:bg-white/5 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <p className="text-slate-300 text-sm leading-relaxed">{message}</p>
          {note && <p className="text-slate-500 text-xs leading-relaxed bg-white/5 rounded-xl px-3 py-2.5">{note}</p>}
          <div className="flex gap-3 pt-1">
            <button onClick={onCancel} disabled={busy} className="btn-ghost flex-1">{cancelLabel}</button>
            <button
              onClick={onConfirm}
              disabled={busy}
              className="flex-1 rounded-[14px] font-bold py-3.5 text-white transition-all disabled:opacity-50"
              style={{ background: danger ? '#CC0000' : '#2563eb' }}
            >
              {busy ? '…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
