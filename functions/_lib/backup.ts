import { B32, randomBase32 } from "./crypto";

// Code = 10-char public id (lookup, rate-limit per account) + 26-char secret (130 bits).
export const ID_LEN = 10;
export const SECRET_LEN = 26;
const TOTAL = ID_LEN + SECRET_LEN;

export function generateBackupCode(): { publicId: string; secret: string; display: string } {
  const publicId = randomBase32(ID_LEN);
  const secret = randomBase32(SECRET_LEN);
  const raw = publicId + secret;
  const display = raw.match(/.{1,4}/g)!.join("-");
  return { publicId, secret, display };
}

/** Normalise user input (case, dashes, spaces, Crockford look-alikes). */
export function parseBackupCode(input: string): { publicId: string; secret: string } | null {
  const s = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (s.length !== TOTAL) return null;
  for (const c of s) if (!B32.includes(c)) return null;
  return { publicId: s.slice(0, ID_LEN), secret: s.slice(ID_LEN) };
}

/** Delay after the n-th consecutive failure: 1, 2, 4 ... seconds, capped at 1 hour. */
export function backoffSeconds(failures: number): number {
  if (failures <= 0) return 0;
  return Math.min(2 ** Math.min(failures - 1, 12), 3600);
}
