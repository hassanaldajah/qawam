const HEX = "0123456789abcdef";

export function toHex(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += HEX.charAt(b >> 4) + HEX.charAt(b & 15);
  return s;
}

/** n random bytes as lowercase hex (2n chars). */
export function randomHex(n: number): string {
  return toHex(crypto.getRandomValues(new Uint8Array(n)));
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return toHex(new Uint8Array(digest));
}

/** Constant-time comparison for equal-length strings (hash hex). */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Crockford base32 alphabet (no I, L, O, U). */
export const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** n random base32 chars, 5 bits each (uniform: 256 is a multiple of 32). */
export function randomBase32(n: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  let s = "";
  for (const b of bytes) s += B32.charAt(b & 31);
  return s;
}
