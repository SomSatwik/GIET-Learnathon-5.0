import type { Database } from 'better-sqlite3';

export type AppEnv = {
	Variables: {
		db: Database;
		uploadsDir: string;
	};
};
