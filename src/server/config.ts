import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = path.resolve(SERVER_DIR, '../..');

export const DEFAULT_DB_PATH =
	process.env.HOSTEL_DB_PATH ?? path.join(REPO_ROOT, 'data', 'hostel.db');

export const DEFAULT_UPLOADS_DIR =
	process.env.HOSTEL_UPLOADS_DIR ?? path.join(REPO_ROOT, 'uploads');

export const API_PORT = Number(process.env.HOSTEL_API_PORT ?? 3001);

export const SESSION_COOKIE = 'hg_session';

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_TYPES = new Set([
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp'
]);

/** Minimum password length enforced at every password-acceptance point. */
export const MIN_PASSWORD_LENGTH = 8;

/** Number of consecutive failed login attempts before an IP is locked out. */
export const LOGIN_MAX_ATTEMPTS = 5;

/** How long (ms) an IP stays locked out after exceeding LOGIN_MAX_ATTEMPTS. */
export const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
