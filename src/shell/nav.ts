import type { LucideIcon } from 'lucide-react'
import { LayoutDashboard, Users, Settings } from 'lucide-react'

// Player-oriented navigation, NOT a toolbox: the daily app is about your SoulLinks,
// not about configuring emulators/randomizers/profiles. Those technical tools moved
// into the "Neuer SoulLink" flow + Einstellungen. Data-driven so sections stay easy
// to add (e.g. a dedicated Runs/Freunde view) without a layout change.
export interface NavItem {
  id: string
  label: string
  icon: LucideIcon
  to?: string
  soon?: boolean
}

export const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard',     icon: LayoutDashboard, to: '/' },
  { id: 'friends',   label: 'Freunde',       icon: Users,           soon: true },
  { id: 'settings',  label: 'Einstellungen', icon: Settings,        to: '/settings' },
]
