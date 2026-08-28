import { Hono } from 'hono';
import type { AppEnv } from '../env.ts';
import { createSession, clearSessionCookie, requireUser, setSessionCookie } from '../auth/session.ts';
import { verifyPassword } from '../auth/passwords.ts';
import { findUserByEmail } from '../db/queries.ts';
import { toPublicUser } from '../db/map.ts';
import { HttpError } from '../http/errors.ts';

export const authRoutes = new Hono<AppEnv>();

authRoutes.post('/login', async (c) => {
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
	const email = 'email' in body && typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
	const password = 'password' in body && typeof body.password === 'string' ? body.password : '';
	if (!email || !password) {
		throw new HttpError(400, 'bad_request', 'Email and password are required.');
	}
	const user = findUserByEmail(db, email);
	if (!user || !verifyPassword(password, user.password_hash)) {
		throw new HttpError(401, 'unauthenticated', 'Invalid email or password.');
	}
	const token = createSession(db, user.id);
	setSessionCookie(c, token);
	return c.json({ user: toPublicUser(user) });
});

authRoutes.post('/logout', (c) => {
	clearSessionCookie(c);
	return c.json({ ok: true });
});

authRoutes.get('/me', (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	return c.json({ user: toPublicUser(user) });
});
