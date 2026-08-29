import { hash, verify } from '@node-rs/argon2';
import { createHash, timingSafeEqual } from 'node:crypto';

const ARGON2_OPTIONS = { memoryCost: 65536, timeCost: 3, parallelism: 1 };

/**
 * Hash a password using Argon2id (memory-hard KDF with embedded salt).
 * Returns a string prefixed "argon2:" so legacy sha256: hashes are detectable.
 */
export async function hashPassword(password: string): Promise<string> {
	const h = await hash(password, ARGON2_OPTIONS);
	return `argon2:${h}`;
}

/**
 * Verify a password against a stored hash.
 * Supports the new argon2: scheme AND the legacy sha256: scheme so
 * existing seeded accounts work during any migration window.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	if (stored.startsWith('argon2:')) {
		return verify(stored.slice('argon2:'.length), password);
	}
	// Legacy SHA-256 fallback — only for pre-migration hashes
	const parts = stored.split(':');
	if (parts.length !== 2) return false;
	const [scheme, hashHex] = parts;
	if (scheme !== 'sha256' || !hashHex) return false;
	const actual = createHash('sha256').update(password).digest();
	const expected = Buffer.from(hashHex, 'hex');
	if (actual.length !== expected.length) return false;
	return timingSafeEqual(actual, expected);
}
