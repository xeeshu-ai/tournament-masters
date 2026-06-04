export const FFMAPS = [
  'Bermuda',
  'Bermuda Remastered',
  'Kalahari',
  'Purgatory',
  'Alpine',
  'NeXTerra',
];

export const BGMI_BR_MAPS = [
  'Erangel',
  'Miramar',
  'Rondo',
  'Sanhok',
  'Vikendi',
  'Livik',
  'Nusa',
  'Deston',
];

export const BGMI_TDM_MAPS = [
  'Hangar',
  'Warehouse',
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

// Maps and modes per game
export const MAPS_BY_GAME = {
  free_fire: FFMAPS,
  bgmi: BGMI_BR_MAPS,
};

export const TDM_MAPS_BY_GAME = {
  bgmi: BGMI_TDM_MAPS,
};

export const MODES_BY_GAME = {
  free_fire: FFMODES,
  bgmi: BGMI_MODES,
};

export function getMapsForGame(gameId, mode) {
  if (gameId === 'bgmi' && mode === 'tdm') return BGMI_TDM_MAPS;
  return MAPS_BY_GAME[gameId] ?? FFMAPS;
}

export function getModesForGame(gameId) {
  return MODES_BY_GAME[gameId] ?? FFMODES;
}

export const TOURNAMENT_TYPES = [
  { id: 'single', label: 'Single Match' },
  { id: 'long', label: 'Long Tournament' },
];

// BR slot options — max teams per match
// BGMI BR: 100 players per match → Solo=100 slots, Duo=50, Squad=25
// FF BR: 48 players per match → Solo=48, Duo=24, Squad=12
export const BR_SLOT_OPTIONS = {
  // Free Fire
  ff_solo: [20, 32, 48],
  ff_duo: [10, 16, 24],
  ff_squad: [5, 8, 12],
  // BGMI
  bgmi_solo: [100],
  bgmi_duo: [50],
  bgmi_squad: [25],
  // Generic fallback
  solo: [20, 32, 48, 100],
  duo: [10, 16, 24, 50],
  squad: [5, 8, 12, 25],
};

// TDM slot options / settings
export const TDM_ROUNDS = [5, 7, 11, 13];
export const BGMI_TDM_KILL_TARGET = 40;

// Games registry
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
    active: true,
    uidLabel: 'Character ID',
  },
];

export function getGame(gameId) {
  return GAMES.find((g) => g.id === gameId) || null;
}

/**
 * BR scoring — signature: calculateBrPoints(kills, position, gameId)
 *
 * BGMI BR:
 *   Position points: #1=15, #2=12, #3=10, #4=8, #5=6, #6-#10=4, #11-#15=2, else 0
 *   Kill points: 1 per kill
 *   Total = position_pts + kills
 *
 * Free Fire BR (flat bonus system):
 *   Position bonus: #1=+10, #2=+6, #3=+4, else 0
 *   Kill points: 1 per kill
 *   Total = position_bonus + kills
 */
export function calculateBrPoints(kills, position, gameId) {
  const k = Math.max(Number(kills || 0), 0);
  const p = Math.max(Number(position || 1), 1);

  if (gameId === 'bgmi') {
    const posTable = [15, 12, 10, 8, 6, 4, 4, 4, 4, 4, 2, 2, 2, 2, 2];
    const posPts = posTable[p - 1] ?? 0;
    return posPts + k;
  }

  // Free Fire — position bonus: 1st=+10, 2nd=+6, 3rd=+4, rest=0
  const ffPosTable = [10, 6, 4];
  const ffPosPts = ffPosTable[p - 1] ?? 0;
  return ffPosPts + k;
}

export function isPowerOfTwo(n) {
  const x = Number(n || 0);
  return x > 0 && (x & (x - 1)) === 0;
}
