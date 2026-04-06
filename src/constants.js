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

/**
 * Standard additive Free Fire BR scoring:
 *   - Placement points: 1st=12, 2nd=9, 3rd=8, 4th=7, ... 10th=1, 11th+=0
 *   - Kill points: 1 point per kill
 *
 * Previous formula ((k+1)/p)*100 was multiplicative and gave higher-placement
 * teams fewer points than kill-heavy lower-placement teams, which was incorrect.
 */
const PLACEMENT_POINTS = [12, 9, 8, 7, 6, 5, 4, 3, 2, 1];

export function calculateBrPoints(kills, position) {
  const k = Math.max(Number(kills || 0), 0);
  const p = Math.max(Number(position || 1), 1);
  const placementPts = PLACEMENT_POINTS[p - 1] ?? 0;
  return placementPts + k;
}

export function isPowerOfTwo(n) {
  const x = Number(n || 0);
  return x > 0 && (x & (x - 1)) === 0;
}
