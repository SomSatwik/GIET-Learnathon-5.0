import { statusToUi } from '../http/status.ts';
import type {
	AttachmentRow,
	CommentRow,
	GrievanceCategory,
	PublicAttachment,
	PublicComment,
	PublicGrievance,
	PublicUser,
	GrievanceRow,
	UserRow
} from '../types/index.ts';

export function toPublicUser(row: Pick<UserRow, 'id' | 'name' | 'email' | 'role' | 'room'>): PublicUser {
	const user: PublicUser = {
		id: row.id,
		name: row.name,
		email: row.email,
		role: row.role
	};
	if (row.room) {
		user.room = row.room;
	}
	return user;
}

export function toPublicAttachment(row: AttachmentRow): PublicAttachment {
	return {
		id: row.id,
		filename: row.original_filename,
		sizeBytes: row.size_bytes,
		contentType: row.mime_type
	};
}

export function toPublicComment(row: CommentRow, author: PublicUser): PublicComment {
	return {
		id: row.id,
		grievanceId: row.grievance_id,
		authorId: row.author_id,
		author,
		body: row.body,
		createdAt: row.created_at
	};
}

export function toPublicGrievance(
	row: GrievanceRow,
	student: PublicUser,
	attachments: PublicAttachment[],
	comments: PublicComment[]
): PublicGrievance {
	return {
		id: row.id,
		title: row.title,
		description: row.description,
		category: row.category as GrievanceCategory,
		status: statusToUi(row.status),
		studentId: row.student_id,
		student,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		attachments,
		comments
	};
}
