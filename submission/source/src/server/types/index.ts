export type Role = 'student' | 'warden';

export type GrievanceStatusDb = 'open' | 'in_progress' | 'resolved';

/** Status strings the Svelte UI already uses. */
export type GrievanceStatusUi = 'Open' | 'In Progress' | 'Resolved';

export type GrievanceCategory =
	| 'Maintenance'
	| 'Water'
	| 'Electricity'
	| 'Internet'
	| 'Cleanliness'
	| 'Room'
	| 'Other';

export interface PublicUser {
	id: string;
	name: string;
	email: string;
	role: Role;
	room?: string;
}

export interface PublicAttachment {
	id: string;
	filename: string;
	sizeBytes: number;
	contentType: string;
}

export interface PublicComment {
	id: string;
	grievanceId: string;
	authorId: string;
	author: PublicUser;
	body: string;
	createdAt: string;
}

export interface PublicGrievance {
	id: string;
	title: string;
	description: string;
	category: GrievanceCategory;
	status: GrievanceStatusUi;
	studentId: string;
	student: PublicUser;
	createdAt: string;
	updatedAt: string;
	attachments: PublicAttachment[];
	comments: PublicComment[];
}

export interface UserRow {
	id: string;
	name: string;
	email: string;
	password_hash: string;
	role: Role;
	room: string | null;
	created_at: string;
}

export interface GrievanceRow {
	id: string;
	student_id: string;
	title: string;
	category: string;
	description: string;
	status: GrievanceStatusDb;
	created_at: string;
	updated_at: string;
}

export interface CommentRow {
	id: string;
	grievance_id: string;
	author_id: string;
	body: string;
	created_at: string;
}

export interface AttachmentRow {
	id: string;
	grievance_id: string;
	original_filename: string;
	stored_filename: string;
	mime_type: string;
	size_bytes: number;
	created_at: string;
}

export interface SessionUser {
	id: string;
	name: string;
	email: string;
	role: Role;
	room: string | null;
	created_at: string;
}

export type ErrorCode =
	| 'bad_request'
	| 'unauthenticated'
	| 'unauthorized'
	| 'not_found'
	| 'conflict'
	| 'internal';
