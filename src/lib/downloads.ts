// External download sources for the onboarding. We never host emulators, the
// randomizer or ROMs ourselves — these point at the official release pages
// (always "latest" so the links never go stale).

export const DOWNLOADS = {
  // Always the newest Companion installer (GitHub Releases of this repo).
  companion: 'https://github.com/DrDuqi/soullink-tracker-new/releases/latest',
  // Official BizHawk releases.
  bizhawk: 'https://github.com/TASEmulators/BizHawk/releases/latest',
  // Universal Pokémon Randomizer ZX (official).
  randomizer: 'https://github.com/Ajarmar/universal-pokemon-randomizer-zx/releases/latest',
} as const
