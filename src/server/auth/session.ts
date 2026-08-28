import { randomBytes } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from '../config.ts';
import { HttpError } from '../http/errors.ts';
import type { SessionUser } from '../types/index.ts';

function nowIso(): string {
	return new Date().toISOString();
}

function expiryIso(): string {
	return new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
}

export function createSession(db: Database, userId: string): string {
	const token = randomBytes(32).toString('base64url');
	db.prepare(
		'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
	).run(token, userId, nowIso(), expiryIso());
	return token;
}

export function destroySession(db: Database, token: string): void {
	db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function readSessionUser(db: Database, token: string): SessionUser | undefined {
	const row = db
		.prepare(
			`SELECT u.id, u.name, u.email, u.role, u.room, u.created_at, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
		)
		.get(token) as (SessionUser & { expires_at: string }) | undefined;
	if (!row) return undefined;
	return {
		id: row.id,
		name: row.name,
		email: row.email,
		role: row.role,
		room: row.room,
		created_at: row.created_at
	};
}

export function setSessionCookie(c: Context, token: string): void {
	setCookie(c, SESSION_COOKIE, token, {
		path: '/',
		maxAge: SESSION_TTL_SECONDS
	});
}

export function clearSessionCookie(c: Context): void {
	deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

export function requireUser(c: Context, db: Database): SessionUser {
	const token = getCookie(c, SESSION_COOKIE);
	if (!token) {
		throw new HttpError(401, 'unauthenticated', 'Authentication required.');
	}
	const user = readSessionUser(db, token);
	if (!user) {
		throw new HttpError(401, 'unauthenticated', 'Authentication required.');
	}
	return user;
}

export function optionalToken(c: Context): string | undefined {
	return getCookie(c, SESSION_COOKIE);
}
