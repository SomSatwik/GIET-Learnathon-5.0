/**
 * Frontend service contracts — the only seam the future Hono API needs to implement.
 * UI components never import mock data directly; they go through these interfaces.
 */
import type {
	Attachment,
	AuthResult,
	Comment,
	Grievance,
	GrievanceCategory,
	GrievanceStatus,
	Result,
	User
} from '$lib/types';

export interface AttachmentInput {
	filename: string;
	sizeBytes: number;
	contentType: string;
	/** Present when filing against the live API; ignored by the in-memory mock. */
	file?: File;
}

export interface CreateGrievanceInput {
	studentId: string;
	title: string;
	category: GrievanceCategory;
	description: string;
	attachment?: AttachmentInput | null;
}

export interface AuthService {
	/** Validate credentials and return the session user (mock-only). */
	signIn(email: string, password: string): Promise<AuthResult>;
	/** End the session. */
	signOut(): Promise<void>;
	/**
	 * Restore a persisted session synchronously (mock: localStorage).
	 * A real cookie-session API can expose an async hydration path instead;
	 * the UI layer does not depend on how this is implemented.
	 */
	restore(): User | null;
}

export interface UserService {
	getById(id: string): Promise<User | null>;
}

export interface GrievanceService {
	/** All grievances belonging to one student. */
	listForStudent(studentId: string): Promise<Result<Grievance[]>>;
	/** All grievances across students (warden view). */
	listAll(): Promise<Result<Grievance[]>>;
	/** Single grievance by ID, or error when missing. */
	getById(id: string): Promise<Result<Grievance>>;
	create(input: CreateGrievanceInput): Promise<Result<Grievance>>;
	updateStatus(id: string, status: GrievanceStatus): Promise<Result<Grievance>>;
}

export interface CommentService {
	add(grievanceId: string, authorId: string, body: string): Promise<Result<Comment>>;
}

export type { Attachment, AuthResult, Comment, Grievance, GrievanceStatus, Result, User };
