import { Hono } from 'hono';
import type { Database } from 'better-sqlite3';
import type { AppEnv } from '../env.ts';
import { createSession, clearSessionCookie, destroySession, requireUser, setSessionCookie } from '../auth/session.ts';
import { verifyPassword, hashPassword } from '../auth/passwords.ts';
import { findUserByEmail } from '../db/queries.ts';
import { toPublicUser } from '../db/map.ts';
import { HttpError } from '../http/errors.ts';
import { getCookie } from 'hono/cookie';
import { SESSION_COOKIE, MIN_PASSWORD_LENGTH, LOGIN_MAX_ATTEMPTS, LOGIN_LOCKOUT_MS } from '../config.ts';

export const authRoutes = new Hono<AppEnv>();

function nowIso(): string {
	return new Date().toISOString();
}

/** Returns the best available client IP from the request. */
function clientIp(c: { req: { header: (name: string) => string | undefined } }): string {
	return (
		c.req.header('x-real-ip') ??
		c.req.header('x-forwarded-for')?.split(',')[0].trim() ??
		'unknown'
	);
}

/** Returns the ISO lockout-expiry if the IP is currently banned, else null. */
function getLockout(db: Database, ip: string): string | null {
	const row = db
		.prepare('SELECT locked_until FROM login_attempts WHERE ip = ?')
		.get(ip) as { locked_until: string | null } | undefined;
	if (!row || !row.locked_until) return null;
	if (row.locked_until > nowIso()) return row.locked_until;
	return null;
}

/** Records a failed attempt. Locks the IP for LOGIN_LOCKOUT_MS after LOGIN_MAX_ATTEMPTS failures. */
function recordFailure(db: Database, ip: string): void {
	const now = nowIso();
	const existing = db
		.prepare('SELECT fail_count FROM login_attempts WHERE ip = ?')
		.get(ip) as { fail_count: number } | undefined;

	const newCount = (existing?.fail_count ?? 0) + 1;
	const lockedUntil = newCount >= LOGIN_MAX_ATTEMPTS
		? new Date(Date.now() + LOGIN_LOCKOUT_MS).toISOString()
		: null;

	db.prepare(`
		INSERT INTO login_attempts (ip, fail_count, locked_until, last_attempt)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(ip) DO UPDATE SET
			fail_count = excluded.fail_count,
			locked_until = excluded.locked_until,
			last_attempt = excluded.last_attempt
	`).run(ip, newCount, lockedUntil, now);
}

/** Clears the failure counter for an IP after a successful login. */
function recordSuccess(db: Database, ip: string): void {
	db.prepare('DELETE FROM login_attempts WHERE ip = ?').run(ip);
}

authRoutes.post('/login', async (c) => {
	const db = c.get('db');
	const ip = clientIp(c as never);

	// Check DB-backed lockout first — survives server restarts
	const lockedUntil = getLockout(db, ip);
	if (lockedUntil) {
		const retryAfterSecs = Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 1000);
		c.header('Retry-After', String(retryAfterSecs));
		throw new HttpError(429, 'unauthenticated',
			`Too many failed attempts. Try again in ${Math.ceil(retryAfterSecs / 60)} minute(s).`);
	}

	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		throw new HttpError(400, 'bad_request', 'Request body must be JSON.');
	}
	if (!body || typeof body !== 'object') {
		throw new HttpError(400, 'bad_request', 'Request body must be JSON.');
	}
	const email = 'email' in body && typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
	const password = 'password' in body && typeof body.password === 'string' ? body.password : '';
	if (!email || !password) {
		throw new HttpError(400, 'bad_request', 'Email and password are required.');
	}
	if (password.length < MIN_PASSWORD_LENGTH) {
		recordFailure(db, ip);
		throw new HttpError(401, 'unauthenticated', 'Invalid email or password.');
	}

	const user = findUserByEmail(db, email);
	if (!user || !(await verifyPassword(password, user.password_hash))) {
		recordFailure(db, ip);
		throw new HttpError(401, 'unauthenticated', 'Invalid email or password.');
	}

	// Auth succeeded — clear the failure counter and auto-upgrade legacy hash
	recordSuccess(db, ip);
	if (user.password_hash.startsWith('sha256:')) {
		const upgraded = await hashPassword(password);
		db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(upgraded, user.id);
	}

	const token = createSession(db, user.id);
	setSessionCookie(c, token);
	return c.json({ user: toPublicUser(user) });
});

authRoutes.post('/logout', (c) => {
	const db = c.get('db');
	const token = getCookie(c, SESSION_COOKIE);
	if (token) destroySession(db, token);
	clearSessionCookie(c);
	return c.json({ ok: true });
});

authRoutes.get('/me', (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	return c.json({ user: toPublicUser(user) });
});
