import { useSettings, type Lang } from '../store/settingsStore'

// Lightweight i18n. Add a language by adding its key to LANGUAGES and a dictionary
// to DICT — every component using useT()/t() picks it up automatically. Missing
// keys fall back to German, so partial translations are safe.

export const LANGUAGES: Record<Lang, string> = { de: 'Deutsch', en: 'English' }

type Dict = Record<string, string>

const de: Dict = {
  'menu.profile': 'Profil', 'menu.settings': 'Einstellungen', 'menu.changelog': 'Changelog',
  'menu.discord': 'Discord', 'menu.signout': 'Abmelden', 'menu.myRuns': 'Meine Runs',
  'common.cancel': 'Abbrechen', 'common.save': 'Speichern', 'common.saving': 'Speichern…', 'common.close': 'Schließen',

  'profile.title': 'Profil', 'profile.displayName': 'Anzeigename', 'profile.shinyAvatar': 'Shiny-Avatar',
  'profile.chooseShiny': 'Shiny auswählen', 'profile.memberSince': 'Mitglied seit', 'profile.runsCreated': 'Runs erstellt',
  'profile.pokemonCaught': 'Pokémon gefangen', 'profile.soulLinks': 'SoulLinks',
  'profile.danger': 'Gefahrenzone', 'profile.deleteAccount': 'Account löschen',
  'profile.deleteHint': 'Löscht dein Profil unwiderruflich und meldet dich ab.',
  'profile.deleteConfirm': 'Tippe deinen Benutzernamen, um das Löschen zu bestätigen.',

  'settings.title': 'Einstellungen', 'settings.appearance': 'Darstellung', 'settings.language': 'Sprache',
  'settings.gameplay': 'Gameplay', 'settings.notifications': 'Benachrichtigungen', 'settings.performance': 'Performance',
  'settings.companion': 'Companion', 'settings.about': 'Über',
  'settings.darkMode': 'Dark Mode', 'settings.darkModeHint': 'Das klassische dunkle Design.',
  'settings.oledMode': 'OLED Mode', 'settings.oledHint': 'Reines Schwarz – noch dunkler, ideal für OLED-Displays.',
  'settings.accent': 'Akzentfarbe',
  'settings.defaultMode': 'Standard-Spielmodus', 'settings.manual': 'Manuell', 'settings.liveSync': 'Live Emulator Sync',
  'settings.defaultPlayers': 'Standard-Spieleranzahl', 'settings.players2': '2 Spieler', 'settings.players3': '3 Spieler',
  'settings.notifCaught': 'Pokémon gefangen', 'settings.notifPartner': 'Partner verbunden',
  'settings.notifCompanion': 'Companion gefunden', 'settings.notifUpdates': 'Updates verfügbar',
  'settings.reduceMotion': 'Animationen reduzieren', 'settings.reduceMotionHint': 'Weniger Bewegung – schont schwächere PCs.',
  'settings.disableBg': 'Hintergrundeffekte deaktivieren', 'settings.disableBgHint': 'Schaltet den animierten Hintergrund ab.',
  'settings.companionVersion': 'Companion-Version', 'settings.checkUpdates': 'Nach Updates suchen',
  'settings.reconnect': 'Companion neu verbinden', 'settings.resetup': 'Companion neu einrichten',
  'settings.companionConnected': 'Verbunden', 'settings.companionOffline': 'Nicht verbunden',
  'settings.appVersion': 'SoulLink Tracker', 'settings.viewChangelog': 'Changelog ansehen',
}

const en: Dict = {
  'menu.profile': 'Profile', 'menu.settings': 'Settings', 'menu.changelog': 'Changelog',
  'menu.discord': 'Discord', 'menu.signout': 'Sign out', 'menu.myRuns': 'My runs',
  'common.cancel': 'Cancel', 'common.save': 'Save', 'common.saving': 'Saving…', 'common.close': 'Close',

  'profile.title': 'Profile', 'profile.displayName': 'Display name', 'profile.shinyAvatar': 'Shiny avatar',
  'profile.chooseShiny': 'Choose shiny', 'profile.memberSince': 'Member since', 'profile.runsCreated': 'Runs created',
  'profile.pokemonCaught': 'Pokémon caught', 'profile.soulLinks': 'SoulLinks',
  'profile.danger': 'Danger zone', 'profile.deleteAccount': 'Delete account',
  'profile.deleteHint': 'Permanently deletes your profile and signs you out.',
  'profile.deleteConfirm': 'Type your username to confirm deletion.',

  'settings.title': 'Settings', 'settings.appearance': 'Appearance', 'settings.language': 'Language',
  'settings.gameplay': 'Gameplay', 'settings.notifications': 'Notifications', 'settings.performance': 'Performance',
  'settings.companion': 'Companion', 'settings.about': 'About',
  'settings.darkMode': 'Dark mode', 'settings.darkModeHint': 'The classic dark theme.',
  'settings.oledMode': 'OLED mode', 'settings.oledHint': 'Pure black – even darker, great for OLED screens.',
  'settings.accent': 'Accent color',
  'settings.defaultMode': 'Default game mode', 'settings.manual': 'Manual', 'settings.liveSync': 'Live emulator sync',
  'settings.defaultPlayers': 'Default player count', 'settings.players2': '2 players', 'settings.players3': '3 players',
  'settings.notifCaught': 'Pokémon caught', 'settings.notifPartner': 'Partner connected',
  'settings.notifCompanion': 'Companion found', 'settings.notifUpdates': 'Updates available',
  'settings.reduceMotion': 'Reduce animations', 'settings.reduceMotionHint': 'Less motion – easier on weaker PCs.',
  'settings.disableBg': 'Disable background effects', 'settings.disableBgHint': 'Turns off the animated background.',
  'settings.companionVersion': 'Companion version', 'settings.checkUpdates': 'Check for updates',
  'settings.reconnect': 'Reconnect companion', 'settings.resetup': 'Re-run setup',
  'settings.companionConnected': 'Connected', 'settings.companionOffline': 'Not connected',
  'settings.appVersion': 'SoulLink Tracker', 'settings.viewChangelog': 'View changelog',
}

const DICT: Record<Lang, Dict> = { de, en }

export function translate(lang: Lang, key: string): string {
  return DICT[lang]?.[key] ?? de[key] ?? key
}

/** Reactive translator. Usage: const t = useT(); t('settings.title') */
export function useT() {
  const lang = useSettings((s) => s.language)
  return (key: string) => translate(lang, key)
}
