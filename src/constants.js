export const FFMAPS = [
  'Bermuda',
  'Bermuda Remastered',
  'Kalahari',
  'Purgatory',
  'Alpine',
  'NeXTerra',
];

export const BGMI_MAPS = [
  'Erangel',
  'Miramar',
  'Sanhok',
  'Vikendi',
  'Livik',
];

export const FFMODES = [
  { id: 'br', label: 'Battle Royale' },
  { id: 'cs', label: 'Clash Squad' },
  { id: 'lw', label: 'Lone Wolf' },
];

export const BGMI_MODES = [
  { id: 'br', label: 'Battle Royale' },
  { id: 'tdm', label: 'TDM (Team Deathmatch)' },
];

// Maps and modes per game — use these in pages that have access to gameId
export const MAPS_BY_GAME = {
  free_fire: FFMAPS,
  bgmi: BGMI_MAPS,
};

export const MODES_BY_GAME = {
  free_fire: FFMODES,
  bgmi: BGMI_MODES,
};

export function getMapsForGame(gameId) {
  return MAPS_BY_GAME[gameId] ?? FFMAPS;
}

export function getModesForGame(gameId) {
  return MODES_BY_GAME[gameId] ?? FFMODES;
}

export const TOURNAMENT_TYPES = [
  { id: 'single', label: 'Single Match' },
  { id: 'long', label: 'Long Tournament' },
];

export const BR_SLOT_OPTIONS = {
  solo: [20, 32, 48],
  duo: [10, 16, 24],
  squad: [5, 8, 12],
};

// TDM slot options (BGMI): fixed 2 teams of 4
export const TDM_ROUNDS = [5, 7, 11, 13];

// Games registry — slugs MUST match the `id` column in the Supabase `games` table
// and the public app's constants. Always use underscores (no hyphens).
export const GAMES = [
  {
    id: 'free_fire',
    label: 'Free Fire',
    shortLabel: 'FF',
    description: 'Battle Royale · Clash Squad · Lone Wolf',
    color: 'orange',
    active: true,
    uidLabel: 'Free Fire UID',
  },
  {
    id: 'bgmi',
    label: 'BGMI',
    shortLabel: 'BG',
    description: 'Battle Royale · TDM',
    color: 'blue',
    active: true,   // ✅ BGMI now active
    uidLabel: 'Character ID',
  },
];

export function getGame(gameId) {
  return GAMES.find((g) => g.id === gameId) || null;
}

/**
 * Custom Free Fire BR scoring formula:
 *   Points = ((kills + 1) / position) * 100
 *
 * Higher kills + lower position = more points.
 * Position defaults to 1 if not provided to avoid division by zero.
 */
export function calculateBrPoints(kills, position) {
  const k = Math.max(Number(kills || 0), 0);
  const p = Math.max(Number(position || 1), 1);
  return Math.round(((k + 1) / p) * 100);
}

export function isPowerOfTwo(n) {
  const x = Number(n || 0);
  return x > 0 && (x & (x - 1)) === 0;
}
