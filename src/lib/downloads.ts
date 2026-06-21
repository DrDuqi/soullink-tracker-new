// External download sources for the onboarding. We never host emulators, the
// randomizer or ROMs ourselves — these point at the official release pages
// (always "latest" so the links never go stale).

export const DOWNLOADS = {
  // Direct download of the newest Companion installer. GitHub's /releases/latest/
  // download/<asset> always serves the asset of that exact name from the latest
  // published release — and the installer is built with a STABLE name
  // (SoulLink-Companion-Setup.exe), so this link never has to change again.
  companion: 'https://github.com/DrDuqi/soullink-tracker-new/releases/latest/download/SoulLink-Companion-Setup.exe',
  // Official BizHawk releases.
  bizhawk: 'https://github.com/TASEmulators/BizHawk/releases/latest',
  // Universal Pokémon Randomizer ZX (official).
  randomizer: 'https://github.com/Ajarmar/universal-pokemon-randomizer-zx/releases/latest',
} as const
