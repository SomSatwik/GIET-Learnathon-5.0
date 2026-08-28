import { Hono } from 'hono';
import type { AppEnv } from '../env.ts';
import { requireUser } from '../auth/session.ts';
import {
	assembleGrievance,
	findUserById,
	listAllGrievanceRows,
	listCommentRows,
	listGrievanceRowsForStudent,
	nextAttachmentId,
	nextCommentId,
	nextGrievanceId,
	requireGrievance,
	touchGrievance
} from '../db/queries.ts';
import type { CommentRow, AttachmentRow, GrievanceStatusDb } from '../types/index.ts';
import { toPublicAttachment, toPublicComment, toPublicUser } from '../db/map.ts';
import { HttpError } from '../http/errors.ts';
import { parseCategory, statusToDb } from '../http/status.ts';
import {
	bufferFromUpload,
	newStoredName,
	originalBasename,
	writeStoredFile
} from '../storage/attachments.ts';

function nowIso(): string {
	return new Date().toISOString();
}

function readString(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

export const grievanceRoutes = new Hono<AppEnv>();

grievanceRoutes.get('/', (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	const rows =
		user.role === 'warden' ? listAllGrievanceRows(db) : listGrievanceRowsForStudent(db, user.id);
	return c.json({
		data: rows.map((row) => assembleGrievance(db, row))
	});
});

grievanceRoutes.post('/', async (c) => {
	const db = c.get('db');
	const uploadsDir = c.get('uploadsDir');
	const user = requireUser(c, db);
	if (user.role !== 'student') {
		throw new HttpError(403, 'unauthorized', 'Only students can file grievances.');
	}

	const contentType = c.req.header('content-type') ?? '';
	let title = '';
	let category = '';
	let description = '';
	let upload: File | undefined;

	if (contentType.includes('multipart/form-data')) {
		const body = await c.req.parseBody();
		title = readString(body.title) ?? '';
		category = readString(body.category) ?? '';
		description = readString(body.description) ?? '';
		if (body.file instanceof File) upload = body.file;
		else if (body.attachment instanceof File) upload = body.attachment;
	} else {
		let json: unknown;
		try {
			json = await c.req.json();
		} catch {
			throw new HttpError(400, 'bad_request', 'Request body must be JSON or multipart form data.');
		}
		if (!json || typeof json !== 'object') {
			throw new HttpError(400, 'bad_request', 'Request body must be JSON or multipart form data.');
		}
		title = readString('title' in json ? json.title : undefined) ?? '';
		category = readString('category' in json ? json.category : undefined) ?? '';
		description = readString('description' in json ? json.description : undefined) ?? '';
	}

	title = title.trim();
	description = description.trim();
	if (title.length < 5) {
		throw new HttpError(400, 'bad_request', 'Title must be at least 5 characters.');
	}
	if (description.length < 20) {
		throw new HttpError(400, 'bad_request', 'Description must be at least 20 characters.');
	}
	const parsedCategory = parseCategory(category);

	const id = nextGrievanceId(db);
	const ts = nowIso();
	db.prepare(
		`INSERT INTO grievances (id, student_id, title, category, description, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?, ?)`
	).run(id, user.id, title, parsedCategory, description, ts, ts);

	if (upload) {
		const bytes = await bufferFromUpload(upload);
		const stored = newStoredName(upload.type);
		writeStoredFile(uploadsDir, stored, bytes);
		db.prepare(
			`INSERT INTO attachments (id, grievance_id, original_filename, stored_filename, mime_type, size_bytes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
		).run(
			nextAttachmentId(db),
			id,
			originalBasename(upload.name),
			stored,
			upload.type,
			bytes.byteLength,
			ts
		);
	}

	return c.json({ data: assembleGrievance(db, requireGrievance(db, id)) }, 201);
});

grievanceRoutes.get('/:id/comments', (c) => {
	const db = c.get('db');
	requireUser(c, db);
	const row = requireGrievance(db, c.req.param('id'));
	const comments = listCommentRows(db, row.id).map((comment) => {
		const authorRow = findUserById(db, comment.author_id);
		if (!authorRow) {
			throw new HttpError(500, 'internal', 'Internal server error.');
		}
		return toPublicComment(comment, toPublicUser(authorRow));
	});
	return c.json({ data: comments });
});

grievanceRoutes.post('/:id/comments', async (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	const row = requireGrievance(db, c.req.param('id'));

	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		throw new HttpError(400, 'bad_request', 'JSON body is required.');
	}
	const text =
		body && typeof body === 'object' && 'body' in body && typeof body.body === 'string'
			? body.body.trim()
			: '';
	if (!text) {
		throw new HttpError(400, 'bad_request', 'Comment cannot be empty.');
	}

	const id = nextCommentId(db);
	const ts = nowIso();
	db.prepare(
		`INSERT INTO comments (id, grievance_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)`
	).run(id, row.id, user.id, text, ts);
	touchGrievance(db, row.id, ts);

	const author = findUserById(db, user.id);
	if (!author) {
		throw new HttpError(500, 'internal', 'Internal server error.');
	}
	const commentRow = db.prepare('SELECT * FROM comments WHERE id = ?').get(id) as CommentRow;
	return c.json({ data: toPublicComment(commentRow, toPublicUser(author)) }, 201);
});

grievanceRoutes.post('/:id/attachments', async (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	const row = requireGrievance(db, c.req.param('id'));
	if (user.role !== 'student' || row.student_id !== user.id) {
		throw new HttpError(403, 'unauthorized', 'Only the student owner can add attachments.');
	}
	if (row.status === 'resolved') {
		throw new HttpError(409, 'conflict', 'Resolved grievances cannot be edited.');
	}

	const body = await c.req.parseBody();
	const upload = body.file instanceof File ? body.file : body.attachment instanceof File ? body.attachment : undefined;
	if (!upload) {
		throw new HttpError(400, 'bad_request', 'A file field named file is required.');
	}

	const bytes = await bufferFromUpload(upload);
	const stored = newStoredName(upload.type, upload.name);
	const ts = nowIso();
	writeStoredFile(c.get('uploadsDir'), stored, bytes);
	const id = nextAttachmentId(db);
	db.prepare(
		`INSERT INTO attachments (id, grievance_id, original_filename, stored_filename, mime_type, size_bytes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
	).run(id, row.id, originalBasename(upload.name), stored, upload.type, bytes.byteLength, ts);
	touchGrievance(db, row.id, ts);
	const saved = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as AttachmentRow;
	return c.json({ data: toPublicAttachment(saved) }, 201);
});

grievanceRoutes.get('/:id', (c) => {
	const db = c.get('db');
	requireUser(c, db);
	const row = requireGrievance(db, c.req.param('id'));
	return c.json({ data: assembleGrievance(db, row) });
});

grievanceRoutes.patch('/:id', async (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	const row = requireGrievance(db, c.req.param('id'));

	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		throw new HttpError(400, 'bad_request', 'Request body must be JSON.');
	}
	if (!body || typeof body !== 'object') {
		throw new HttpError(400, 'bad_request', 'Request body must be JSON.');
	}

	const title = 'title' in body ? body.title : undefined;
	const description = 'description' in body ? body.description : undefined;
	const category = 'category' in body ? body.category : undefined;
	const status = 'status' in body ? body.status : undefined;
	const wantsContent = title !== undefined || description !== undefined || category !== undefined;
	const wantsStatus = status !== undefined;

	if (!wantsContent && !wantsStatus) {
		throw new HttpError(400, 'bad_request', 'No updatable fields were provided.');
	}

	switch (user.role) {
		case 'student': {
			if (row.status === 'resolved') {
				throw new HttpError(409, 'conflict', 'Resolved grievances cannot be edited.');
			}
			let nextTitle = row.title;
			let nextDescription = row.description;
			let nextCategory = row.category;
			let nextStatus: GrievanceStatusDb = row.status;
			if (title !== undefined) {
				if (typeof title !== 'string' || title.trim().length < 5) {
					throw new HttpError(400, 'bad_request', 'Title must be at least 5 characters.');
				}
				nextTitle = title.trim();
			}
			if (description !== undefined) {
				if (typeof description !== 'string' || description.trim().length < 20) {
					throw new HttpError(400, 'bad_request', 'Description must be at least 20 characters.');
				}
				nextDescription = description.trim();
			}
			if (category !== undefined) {
				if (typeof category !== 'string') {
					throw new HttpError(400, 'bad_request', 'Invalid grievance category.');
				}
				nextCategory = parseCategory(category);
			}
			if (status !== undefined) {
				if (typeof status !== 'string') {
					throw new HttpError(400, 'bad_request', 'Invalid grievance status.');
				}
				nextStatus = statusToDb(status);
			}
			const ts = nowIso();
			db.prepare(
				'UPDATE grievances SET title = ?, description = ?, category = ?, status = ?, updated_at = ? WHERE id = ?'
			).run(nextTitle, nextDescription, nextCategory, nextStatus, ts, row.id);
			break;
		}
		case 'warden': {
			if (wantsContent) {
				throw new HttpError(403, 'unauthorized', 'Wardens cannot edit grievance content.');
			}
			if (typeof status !== 'string') {
				throw new HttpError(400, 'bad_request', 'Invalid grievance status.');
			}
			const nextStatus = statusToDb(status);
			const ts = nowIso();
			db.prepare('UPDATE grievances SET status = ?, updated_at = ? WHERE id = ?').run(
				nextStatus,
				ts,
				row.id
			);
			break;
		}
		default: {
			const _exhaustive: never = user.role;
			throw new HttpError(500, 'internal', 'Internal server error.');
			void _exhaustive;
		}
	}

	return c.json({ data: assembleGrievance(db, requireGrievance(db, row.id)) });
});
