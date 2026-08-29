import { timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import type { Database } from 'better-sqlite3';
import type { AppEnv } from '../env.ts';
import { createSession, clearSessionCookie, destroySession, requireUser, setSessionCookie } from '../auth/session.ts';
import { verifyPassword, hashPassword } from '../auth/passwords.ts';
import { findUserByEmail, createUser, nextUserId } from '../db/queries.ts';
import { toPublicUser } from '../db/map.ts';
import { HttpError } from '../http/errors.ts';
import { getCookie } from 'hono/cookie';
import { SESSION_COOKIE, MIN_PASSWORD_LENGTH, LOGIN_MAX_ATTEMPTS, LOGIN_LOCKOUT_MS, WARDEN_INVITE_CODE } from '../config.ts';

export const authRoutes = new Hono<AppEnv>();

function nowIso(): string {
	return new Date().toISOString();
}

/** Returns the best available client IP from the request. */
function clientIp(c: { req: { header: (name: string) => string | undefined } }): string {
	const trustProxy = process.env.TRUST_PROXY === 'true';
	if (trustProxy) {
		return (
			c.req.header('x-forwarded-for')?.split(',')[0].trim() ??
			c.req.header('x-real-ip') ??
			'127.0.0.1'
		);
	}
	return c.req.header('x-real-ip') ?? '127.0.0.1';
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

/** Shared registration body parser and validator. */
async function parseRegisterBody(c: { req: { json(): Promise<unknown> } }) {
	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		throw new HttpError(400, 'bad_request', 'Request body must be JSON.');
	}
	if (!body || typeof body !== 'object') {
		throw new HttpError(400, 'bad_request', 'Request body must be JSON.');
	}
	const b = body as Record<string, unknown>;
	const name     = typeof b.name     === 'string' ? b.name.trim()     : '';
	const email    = typeof b.email    === 'string' ? b.email.trim().toLowerCase() : '';
	const password = typeof b.password === 'string' ? b.password        : '';
	const confirm  = typeof b.confirmPassword === 'string' ? b.confirmPassword : '';
	const room     = typeof b.room     === 'string' ? b.room.trim()     : null;

	if (!name || name.length < 2)   throw new HttpError(400, 'bad_request', 'Full name is required (min 2 characters).');
	if (name.length > 100)           throw new HttpError(400, 'bad_request', 'Name must be 100 characters or fewer.');
	if (!email)                      throw new HttpError(400, 'bad_request', 'Email is required.');
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'bad_request', 'Email address is invalid.');
	if (password.length < MIN_PASSWORD_LENGTH) throw new HttpError(400, 'bad_request', `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
	if (password.length > 128)       throw new HttpError(400, 'bad_request', 'Password must be 128 characters or fewer.');
	if (password !== confirm)        throw new HttpError(400, 'bad_request', 'Passwords do not match.');

	return { name, email, password, room: room || null };
}

/**
 * POST /api/register — public student self-registration.
 * Role is ALWAYS forced to 'student' server-side.
 * Any 'role' field sent by the client is silently ignored.
 */
authRoutes.post('/register', async (c) => {
	const db = c.get('db');
	const { name, email, password, room } = await parseRegisterBody(c);

	if (findUserByEmail(db, email)) {
		throw new HttpError(409, 'conflict', 'An account with that email address already exists.');
	}

	const passwordHash = await hashPassword(password);
	const id = nextUserId(db, 'student');
	// Role is unconditionally 'student' — no client input accepted for role
	createUser(db, { id, name, email, passwordHash, role: 'student', room });

	const token = createSession(db, id);
	setSessionCookie(c, token);
	const user = findUserByEmail(db, email)!;
	return c.json({ user: toPublicUser(user) }, 201);
});

/**
 * POST /api/register/warden — invite-code-gated warden registration.
 * The WARDEN_INVITE_CODE env var must be set on the server.
 * Role is ALWAYS forced to 'warden' server-side after code verification.
 * Never returns the code or confirms its value in responses.
 */
authRoutes.post('/register/warden', async (c) => {
	// If the operator has not configured an invite code, disable this endpoint entirely
	if (!WARDEN_INVITE_CODE) {
		throw new HttpError(403, 'unauthorized', 'Warden registration is not enabled on this server.');
	}

	const db = c.get('db');
	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		throw new HttpError(400, 'bad_request', 'Request body must be JSON.');
	}
	if (!body || typeof body !== 'object') {
		throw new HttpError(400, 'bad_request', 'Request body must be JSON.');
	}
	const b = body as Record<string, unknown>;

	// Validate invite code first — constant-time comparison prevents timing attacks
	const suppliedCode = typeof b.inviteCode === 'string' ? b.inviteCode : '';
	const codeBuffer   = Buffer.from(WARDEN_INVITE_CODE);
	const suppBuffer   = Buffer.from(suppliedCode.padEnd(WARDEN_INVITE_CODE.length));
	const codeMatch =
		suppBuffer.length === codeBuffer.length &&
		timingSafeEqual(codeBuffer, suppBuffer);
	if (!codeMatch) {
		// Return same error as missing-code to not leak whether the code exists
		throw new HttpError(403, 'unauthorized', 'Invalid invitation code.');
	}

	const name     = typeof b.name     === 'string' ? (b.name as string).trim()         : '';
	const email    = typeof b.email    === 'string' ? (b.email as string).trim().toLowerCase() : '';
	const password = typeof b.password === 'string' ? b.password as string              : '';
	const confirm  = typeof b.confirmPassword === 'string' ? b.confirmPassword as string : '';

	if (!name || name.length < 2)   throw new HttpError(400, 'bad_request', 'Full name is required (min 2 characters).');
	if (name.length > 100)           throw new HttpError(400, 'bad_request', 'Name must be 100 characters or fewer.');
	if (!email)                      throw new HttpError(400, 'bad_request', 'Email is required.');
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'bad_request', 'Email address is invalid.');
	if (password.length < MIN_PASSWORD_LENGTH) throw new HttpError(400, 'bad_request', `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
	if (password.length > 128)       throw new HttpError(400, 'bad_request', 'Password must be 128 characters or fewer.');
	if (password !== confirm)        throw new HttpError(400, 'bad_request', 'Passwords do not match.');

	if (findUserByEmail(db, email)) {
		throw new HttpError(409, 'conflict', 'An account with that email address already exists.');
	}

	const passwordHash = await hashPassword(password);
	const id = nextUserId(db, 'warden');
	// Role is unconditionally 'warden' — only set after server-side invite code validation
	createUser(db, { id, name, email, passwordHash, role: 'warden', room: null });

	const token = createSession(db, id);
	setSessionCookie(c, token);
	const user = findUserByEmail(db, email)!;
	return c.json({ user: toPublicUser(user) }, 201);
});
