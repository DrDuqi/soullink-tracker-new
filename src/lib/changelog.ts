// In-app changelog. Add a new release at the top — the Changelog modal renders
// this list automatically. Dates are display-only (adjust freely).

export type ChangeType = 'new' | 'improve' | 'fix'

export interface ChangelogEntry {
  version: string
  date: string            // ISO; shown localized
  title?: string
  changes: { type: ChangeType; text: string }[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.0.1',
    date: '2026-06-22',
    title: 'Stabiler Companion',
    changes: [
      { type: 'fix', text: '„Sync-Script nicht gefunden" behoben – der Companion nutzt jetzt immer sein eigenes Lua-Script.' },
      { type: 'improve', text: 'Direkter Download-Link: immer die neueste Companion-Version, dauerhaft stabiler Dateiname.' },
      { type: 'improve', text: 'Live-Sync-Status sauber getrennt – Status wird automatisch verwaltet, „Ins Team" bleibt erhalten.' },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-06-20',
    title: 'Live-Emulator-Sync',
    changes: [
      { type: 'new', text: 'Live-Emulator-Sync: Dein Team wird automatisch aus BizHawk erkannt.' },
      { type: 'new', text: 'Companion für Windows mit automatischen Updates (Ein-Klick-Installer).' },
      { type: 'new', text: 'Online-Sync über den lokalen Companion – auch auf der gehosteten Web-App.' },
    ],
  },
]
