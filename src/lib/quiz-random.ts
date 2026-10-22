export function createPrng(seedStr: string) {
  let h = 1779033703 ^ seedStr.split('').reduce((acc, char) => Math.imul(acc ^ char.charCodeAt(0), 3432918353), 0);
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  let seed = (h ^ (h >>> 16)) >>> 0;

  return function() {
    seed += 0x6D2B79F5;
    let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleArray<T>(array: T[], seedStr: string): T[] {
  const rng = createPrng(seedStr);
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
