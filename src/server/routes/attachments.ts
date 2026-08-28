import { Hono } from 'hono';
import type { AppEnv } from '../env.ts';
import { requireUser } from '../auth/session.ts';
import { assertCanViewGrievance, findAttachmentRow, requireGrievance } from '../db/queries.ts';
import { readStoredFile } from '../storage/attachments.ts';
import { HttpError } from '../http/errors.ts';

export const attachmentRoutes = new Hono<AppEnv>();

attachmentRoutes.get('/:id', (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	const row = findAttachmentRow(db, c.req.param('id'));
	if (!row) {
		throw new HttpError(404, 'not_found', 'Attachment was not found.');
	}
	const grievanceRow = requireGrievance(db, row.grievance_id);
	assertCanViewGrievance(user, grievanceRow);
	const bytes = readStoredFile(c.get('uploadsDir'), row.stored_filename);
	c.header('Content-Type', row.mime_type);
	c.header('Content-Length', String(bytes.length));
	const encoded = encodeURIComponent(row.original_filename);
	c.header('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);
	return c.body(new Uint8Array(bytes));
});
