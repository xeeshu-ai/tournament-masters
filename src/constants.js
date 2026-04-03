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

export function calculateBrPoints(kills, position) {
  const k = Number(kills || 0);
  const p = Math.max(Number(position || 1), 1);
  const points = ((k + 1) / p) * 100;
  return Number.isFinite(points) ? Number(points.toFixed(2)) : 0;
}

export function isPowerOfTwo(n) {
  const x = Number(n || 0);
  return x > 0 && (x & (x - 1)) === 0;
}
