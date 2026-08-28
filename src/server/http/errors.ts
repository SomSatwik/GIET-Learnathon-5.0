import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ErrorCode } from '../types/index.ts';

export class HttpError extends Error {
	readonly status: ContentfulStatusCode;
	readonly code: ErrorCode;

	constructor(status: ContentfulStatusCode, code: ErrorCode, message: string) {
		super(message);
		this.name = 'HttpError';
		this.status = status;
		this.code = code;
	}
}

export function jsonError(c: Context, status: ContentfulStatusCode, code: ErrorCode, error: string) {
	return c.json({ error, code }, status);
}

export function handleError(err: unknown, c: Context) {
	if (err instanceof HttpError) {
		return jsonError(c, err.status, err.code, err.message);
	}
	console.error(err);
	return jsonError(c, 500, 'internal', err instanceof Error ? err.message : String(err));
}
