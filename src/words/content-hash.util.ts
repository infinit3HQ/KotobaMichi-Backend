import { createHash } from 'crypto';

/**
 * Compute a deterministic content hash for a word's core content.
 * Normalizes using NFKC, trims and lowercases each field, joins with '|' and
 * returns the sha256 hex digest.
 */
export function computeContentHash(
  hiragana: string,
  kanji: string | null,
  english: string
): string {
  const normalize = (s: string) => s.trim().normalize('NFKC').toLowerCase();

  const h = normalize(hiragana ?? '');
  const k = kanji ? normalize(kanji) : '';
  const e = normalize(english ?? '');

  const content = `${h}|${k}|${e}`;
  return createHash('sha256').update(content).digest('hex');
}
