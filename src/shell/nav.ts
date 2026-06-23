import type { LucideIcon } from 'lucide-react'
import { LayoutDashboard, Swords, Dices, Cpu, Users, BarChart3, Cloud, Settings } from 'lucide-react'

// The Companion sidebar is DATA-DRIVEN: adding a future section is one entry here,
// never a layout change. `to` = an active route; `soon` = a planned section shown
// dimmed (so the roadmap is visible, like a real desktop app) until it's built.
// This is intentionally future-proofed to the sections we already foresee, so the
// navigation never needs rebuilding as features land.
export interface NavItem {
  id: string
  label: string
  icon: LucideIcon
  to?: string
  soon?: boolean
}

export const NAV: NavItem[] = [
  { id: 'dashboard',  label: 'Dashboard',      icon: LayoutDashboard, to: '/' },
  { id: 'runs',       label: 'SoulLinks',      icon: Swords,          soon: true },
  { id: 'randomizer', label: 'Randomizer',     icon: Dices,           to: '/presets' },
  { id: 'emulator',   label: 'Emulator',       icon: Cpu,             to: '/setup' },
  { id: 'profiles',   label: 'Profile',        icon: Users,           to: '/profiles' },
  { id: 'stats',      label: 'Statistiken',    icon: BarChart3,       soon: true },
  { id: 'cloud',      label: 'Cloud',          icon: Cloud,           soon: true },
  { id: 'settings',   label: 'Einstellungen',  icon: Settings,        soon: true },
]
