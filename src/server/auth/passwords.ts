import { createHash, timingSafeEqual } from 'node:crypto';

export function hashPassword(password: string): string {
	return `sha256:${createHash('sha256').update(password).digest('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
	const parts = stored.split(':');
	if (parts.length !== 2) return false;
	const [scheme, hash] = parts;
	if (scheme !== 'sha256' || !hash) return false;
	const actual = createHash('sha256').update(password).digest();
	const expected = Buffer.from(hash, 'hex');
	if (actual.length !== expected.length) return false;
	return timingSafeEqual(actual, expected);
}
