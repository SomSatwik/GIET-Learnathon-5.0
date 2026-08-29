import { Hono } from 'hono';
import type { Database } from 'better-sqlite3';
import type { AppEnv } from './env.ts';
import { handleError, HttpError } from './http/errors.ts';
import { authRoutes } from './routes/auth.ts';
import { grievanceRoutes } from './routes/grievances.ts';
import { attachmentRoutes } from './routes/attachments.ts';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { bodyLimit } from 'hono/body-limit';
import { rateLimiter } from 'hono-rate-limiter';

export type CreateAppOptions = {
	db: Database;
	uploadsDir: string;
	allowedOrigins?: string[];
};

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173', 'http://localhost:4173'];

export function createApp(options: CreateAppOptions) {
	const app = new Hono<AppEnv>();

	const allowedOrigins = new Set(options.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS);

	app.use('*', async (c, next) => {
		c.set('db', options.db);
		c.set('uploadsDir', options.uploadsDir);
		await next();
	});
	app.use(
		'/api/*',
		cors({
			origin: (origin) => (origin && allowedOrigins.has(origin) ? origin : null),
			credentials: true
		})
	);

	// Security headers on all responses — MED-3
	app.use('*', secureHeaders({
		contentSecurityPolicy: {
			defaultSrc: ["'self'"],
			scriptSrc: ["'self'"],
			styleSrc: ["'self'", "'unsafe-inline'"],
			imgSrc: ["'self'", 'data:'],
			connectSrc: ["'self'"],
			fontSrc: ["'self'"],
			objectSrc: ["'none'"],
			frameSrc: ["'none'"]
		},
		xFrameOptions: 'DENY',
		xContentTypeOptions: 'nosniff',
		strictTransportSecurity: 'max-age=31536000; includeSubDomains',
		referrerPolicy: 'strict-origin-when-cross-origin',
		permissionsPolicy: { camera: [], microphone: [], geolocation: [], usb: [] }
	}));

	// Prevent caching of authenticated API responses — LOW-B
	app.use('/api/*', async (c, next) => {
		await next();
		c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
		c.header('Pragma', 'no-cache');
	});

	// Global body cap before any handler buffers the request — MED-6
	app.use('/api/*', bodyLimit({ maxSize: 3 * 1024 * 1024 }));

	// Global API rate limit (200 req/min per IP) covers all endpoints — HIGH-D
	const globalApiLimit = rateLimiter({
		windowMs: 60 * 1000,
		limit: 200,
		standardHeaders: 'draft-6',
		keyGenerator: (c) => {
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
	});
	app.use('/api/*', globalApiLimit);

	app.onError((err, c) => handleError(err, c));

	app.notFound((c) => c.json({ error: 'Not found.', code: 'not_found' }, 404));

	app.get('/api/health', (c) => c.json({ ok: true }));
	app.route('/api', authRoutes);
	app.route('/api/grievances', grievanceRoutes);
	app.route('/api/attachments', attachmentRoutes);

	app.all('/api/*', () => {
		throw new HttpError(404, 'not_found', 'Not found.');
	});

	return app;
}
