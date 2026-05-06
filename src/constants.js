export const FFMAPS = [
  'Bermuda',
  'Bermuda Remastered',
  'Kalahari',
  'Purgatory',
  'Alpine',
  'NeXTerra',
];

export const FFMODES = [
  { id: 'br', label: 'Battle Royale' },
  { id: 'cs', label: 'Clash Squad' },
  { id: 'lw', label: 'Lone Wolf' },
];

export const TOURNAMENT_TYPES = [
  { id: 'single', label: 'Single Match' },
  { id: 'long', label: 'Long Tournament' },
];

export const BR_SLOT_OPTIONS = {
  solo: [20, 32, 48],
  duo: [10, 16, 24],
  squad: [5, 8, 12],
};

// Games registry — add new games here, they'll auto-appear on the game picker
export const GAMES = [
  {
    id: 'free-fire',
    label: 'Free Fire',
    shortLabel: 'FF',
    description: 'Battle Royale · Clash Squad · Lone Wolf',
    color: 'orange',
    active: true,
  },
  {
    id: 'bgmi',
    label: 'BGMI',
    shortLabel: 'BG',
    description: 'Battle Royale · TDM',
    color: 'blue',
    active: false,   // flip to true when BGMI is ready
  },
];

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
