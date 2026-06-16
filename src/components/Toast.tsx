import { X, CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react'
import { useToastStore } from '../store/toastStore'
import type { ToastType } from '../store/toastStore'

const CONFIG: Record<ToastType, { icon: React.ReactNode; bg: string; border: string; text: string }> = {
  success: { icon: <CheckCircle className="w-5 h-5 shrink-0" />, bg: '#0f2a1a', border: '#166534', text: '#4ade80' },
  error:   { icon: <XCircle    className="w-5 h-5 shrink-0" />, bg: '#2a0f0f', border: '#991b1b', text: '#f87171' },
  warning: { icon: <AlertTriangle className="w-5 h-5 shrink-0" />, bg: '#2a1f0f', border: '#92400e', text: '#fbbf24' },
  info:    { icon: <Info       className="w-5 h-5 shrink-0" />, bg: '#0f1a2a', border: '#1e40af', text: '#60a5fa' },
}

export default function ToastContainer() {
  const { toasts, dismiss } = useToastStore()
  if (toasts.length === 0) return null

  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => {
        const cfg = CONFIG[t.type]
        return (
          <div
            key={t.id}
            className="anim-toast pointer-events-auto flex items-center gap-3 rounded-2xl px-5 py-4 shadow-2xl"
            style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}`, color: cfg.text }}
          >
            {cfg.icon}
            <span className="flex-1 text-sm font-semibold">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="opacity-60 hover:opacity-100 transition-opacity">
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
