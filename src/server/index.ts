import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { API_PORT, DEFAULT_DB_PATH, DEFAULT_UPLOADS_DIR } from './config.ts';
import { openDatabase } from './db/connection.ts';
import { userCount } from './db/queries.ts';
import { seedDatabase } from './db/seed.ts';
import { ensureUploadsDir } from './storage/attachments.ts';

(async () => {
	const dbPath = DEFAULT_DB_PATH;
	const uploadsDir = DEFAULT_UPLOADS_DIR;

	ensureUploadsDir(uploadsDir);
	const db = openDatabase(dbPath);
	if (userCount(db) === 0) {
		if (process.env.NODE_ENV === 'production') {
			// In production, never auto-seed demo accounts with known credentials.
			// Initialise the schema (already done by openDatabase) but leave the
			// user table empty.  Create accounts via a proper admin tool instead.
			console.warn(
				'[HostelGrievance] Database is empty and NODE_ENV=production — ' +
				'skipping demo seed. Create users via the admin CLI.'
			);
		} else {
			await seedDatabase(db, uploadsDir);
			console.log(`Seeded development database at ${dbPath}`);
		}
	}

	const app = createApp({ db, uploadsDir });

	serve({ fetch: app.fetch, port: API_PORT }, (info) => {
		console.log(`HostelGrievance API listening on http://127.0.0.1:${info.port}`);
	});
})();
