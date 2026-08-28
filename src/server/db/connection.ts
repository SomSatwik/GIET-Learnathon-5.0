import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { applySchema } from './schema.ts';

export function openDatabase(path: string): Database.Database {
	if (path !== ':memory:') {
		mkdirSync(dirname(path), { recursive: true });
	}
	const db = new Database(path);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	applySchema(db);
	return db;
}
