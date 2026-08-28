import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { API_PORT, DEFAULT_DB_PATH, DEFAULT_UPLOADS_DIR } from './config.ts';
import { openDatabase } from './db/connection.ts';
import { userCount } from './db/queries.ts';
import { seedDatabase } from './db/seed.ts';
import { ensureUploadsDir } from './storage/attachments.ts';

const dbPath = DEFAULT_DB_PATH;
const uploadsDir = DEFAULT_UPLOADS_DIR;

ensureUploadsDir(uploadsDir);
const db = openDatabase(dbPath);
if (userCount(db) === 0) {
	seedDatabase(db, uploadsDir);
	console.log(`Seeded database at ${dbPath}`);
}

const app = createApp({ db, uploadsDir });

serve({ fetch: app.fetch, port: API_PORT }, (info) => {
	console.log(`HostelGrievance API listening on http://127.0.0.1:${info.port}`);
});
