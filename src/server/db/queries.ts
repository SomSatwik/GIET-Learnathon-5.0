import { randomBytes } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import { HttpError } from '../http/errors.ts';
import type {
	AttachmentRow,
	CommentRow,
	GrievanceRow,
	PublicGrievance,
	SessionUser,
	UserRow
} from '../types/index.ts';
import { toPublicAttachment, toPublicComment, toPublicGrievance, toPublicUser } from './map.ts';

export function findUserByEmail(db: Database, email: string): UserRow | undefined {
	return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
}

export function findUserById(db: Database, id: string): UserRow | undefined {
	return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}

export function userCount(db: Database): number {
	const row = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
	return row.n;
}

export function findGrievanceRow(db: Database, id: string): GrievanceRow | undefined {
	return db.prepare('SELECT * FROM grievances WHERE id = ?').get(id) as GrievanceRow | undefined;
}

export function listGrievanceRowsForStudent(db: Database, studentId: string, limit = 50, offset = 0): GrievanceRow[] {
	return db
		.prepare('SELECT * FROM grievances WHERE student_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
		.all(studentId, limit, offset) as GrievanceRow[];
}

export function listAllGrievanceRows(db: Database, limit = 50, offset = 0): GrievanceRow[] {
	return db.prepare('SELECT * FROM grievances ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset) as GrievanceRow[];
}

export function listCommentRows(db: Database, grievanceId: string): CommentRow[] {
	return db
		.prepare('SELECT * FROM comments WHERE grievance_id = ? ORDER BY created_at ASC')
		.all(grievanceId) as CommentRow[];
}

export function listAttachmentRows(db: Database, grievanceId: string): AttachmentRow[] {
	return db
		.prepare('SELECT * FROM attachments WHERE grievance_id = ? ORDER BY created_at ASC')
		.all(grievanceId) as AttachmentRow[];
}

export function findAttachmentRow(db: Database, id: string): AttachmentRow | undefined {
	return db.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as AttachmentRow | undefined;
}

export function assembleGrievance(db: Database, row: GrievanceRow): PublicGrievance {
	const studentRow = findUserById(db, row.student_id);
	if (!studentRow) {
		throw new HttpError(500, 'internal', 'Internal server error.');
	}
	const student = toPublicUser(studentRow);
	const attachments = listAttachmentRows(db, row.id).map(toPublicAttachment);
	const comments = listCommentRows(db, row.id).map((comment) => {
		const authorRow = findUserById(db, comment.author_id);
		if (!authorRow) {
			throw new HttpError(500, 'internal', 'Internal server error.');
		}
		return toPublicComment(comment, toPublicUser(authorRow));
	});
	return toPublicGrievance(row, student, attachments, comments);
}

export function requireGrievance(db: Database, id: string): GrievanceRow {
	const row = findGrievanceRow(db, id);
	if (!row) {
		throw new HttpError(404, 'not_found', 'Grievance was not found.');
	}
	return row;
}

export function assertCanViewGrievance(user: SessionUser, row: GrievanceRow): void {
	switch (user.role) {
		case 'warden':
			return;
		case 'student':
			if (row.student_id !== user.id) {
				throw new HttpError(403, 'unauthorized', 'You cannot access this grievance.');
			}
			return;
		default: {
			const _exhaustive: never = user.role;
			throw new HttpError(500, 'internal', 'Internal server error.');
			void _exhaustive;
		}
	}
}

export function nextGrievanceId(_db: Database): string {
	return `GRV-${randomBytes(6).toString('hex').toUpperCase()}`;
}

export function nextCommentId(_db: Database): string {
	return `cmt-${randomBytes(6).toString('hex')}`;
}

export function nextAttachmentId(_db: Database): string {
	return `att-${randomBytes(6).toString('hex')}`;
}

export function touchGrievance(db: Database, id: string, updatedAt: string): void {
	db.prepare('UPDATE grievances SET updated_at = ? WHERE id = ?').run(updatedAt, id);
}

/** Generate a unique user ID with the given role prefix. */
export function nextUserId(db: Database, role: 'student' | 'warden'): string {
	const prefix = role === 'warden' ? 'war' : 'stu';
	// Retry in the astronomically unlikely event of a collision
	for (let i = 0; i < 5; i++) {
		const candidate = `${prefix}-${randomBytes(6).toString('hex')}`;
		const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(candidate);
		if (!existing) return candidate;
	}
	throw new Error('Could not generate a unique user ID');
}

/** Insert a new user row. The caller is responsible for hashing the password beforehand. */
export function createUser(
	db: Database,
	opts: { id: string; name: string; email: string; passwordHash: string; role: 'student' | 'warden'; room: string | null }
): void {
	db.prepare(
		'INSERT INTO users (id, name, email, password_hash, role, room, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
	).run(opts.id, opts.name, opts.email, opts.passwordHash, opts.role, opts.room, new Date().toISOString());
}
