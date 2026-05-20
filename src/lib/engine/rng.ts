/**
 * Deterministic RNG. All engine fns that draw cards / pick cities take an Rng
 * so tests can pin behavior by seed.
 */
export type Rng = () => number;

/** Linear congruential generator. Fine for non-cryptographic game randomness. */
export function seededRng(seed: number): Rng {
	let s = (seed >>> 0) || 1;
	return () => {
		s = Math.imul(s, 1664525) + 1013904223;
		s = s >>> 0;
		return s / 0x1_0000_0000;
	};
}

/** Pick n distinct items from arr. If n >= arr.length, returns a shuffled copy. */
export function sample<T>(arr: readonly T[], n: number, rng: Rng): T[] {
	if (n <= 0 || arr.length === 0) return [];
	if (n >= arr.length) {
		return shuffle(arr, rng);
	}
	const out: T[] = [];
	const used = new Set<number>();
	while (out.length < n) {
		const i = Math.floor(rng() * arr.length);
		if (used.has(i)) continue;
		used.add(i);
		out.push(arr[i]);
	}
	return out;
}

export function pick<T>(arr: readonly T[], rng: Rng): T {
	if (arr.length === 0) throw new Error('pick from empty array');
	return arr[Math.floor(rng() * arr.length)];
}

/** Fisher-Yates shuffle. */
export function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}
