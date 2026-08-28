/**
 * Deterministic mock data for HostelGrievance.
 * All timestamps and IDs are fixed so every run renders identically.
 * This module is the ONLY place raw mock content lives.
 */
import type {
	Attachment,
	Comment,
	Grievance,
	GrievanceCategory,
	GrievanceStatus,
	User
} from '$lib/types';

// Fixed "now" so relative rendering is deterministic: 2026-08-20T10:00:00Z
export const MOCK_NOW = '2026-08-20T10:00:00.000Z';

export const MOCK_USERS: Record<string, User> = {
	'stu-1': {
		id: 'stu-1',
		name: 'Aarav Mehta',
		email: 'aarav.mehta@giet.edu',
		role: 'student',
		room: 'B-204'
	},
	'stu-2': {
		id: 'stu-2',
		name: 'Priya Nair',
		email: 'priya.nair@giet.edu',
		role: 'student',
		room: 'A-112'
	},
	'stu-3': {
		id: 'stu-3',
		name: 'Rohan Das',
		email: 'rohan.das@giet.edu',
		role: 'student',
		room: 'C-008'
	},
	'war-1': {
		id: 'war-1',
		name: 'Mr. K. Sahu',
		email: 'warden@example.test',
		role: 'warden'
	}
};

/** Development-only mock credentials (documented, not real security credentials). */
export const MOCK_CREDENTIALS = [
	{ email: 'student@example.test', password: 'student123', userId: 'stu-1' },
	{ email: 'warden@example.test', password: 'warden123', userId: 'war-1' }
] as const;

export const MOCK_ATTACHMENTS: Record<string, Attachment> = {
	'att-1': { id: 'att-1', filename: 'leaking-tap.jpg', sizeBytes: 482_133, contentType: 'image/jpeg' },
	'att-2': { id: 'att-2', filename: 'corridor-light-off.png', sizeBytes: 1_204_882, contentType: 'image/png' },
	'att-3': { id: 'att-3', filename: 'wifi-speedtest.png', sizeBytes: 655_360, contentType: 'image/png' },
	'att-4': { id: 'att-4', filename: 'mess-area.jpg', sizeBytes: 921_600, contentType: 'image/jpeg' }
};

interface SeedComment {
	id: string;
	grievanceId: string;
	authorId: string;
	body: string;
	createdAt: string;
}

export const MOCK_COMMENTS: SeedComment[] = [
	{
		id: 'cmt-1',
		grievanceId: 'GRV-0001',
		authorId: 'war-1',
		body: 'Logged this with the plumbing team. They will visit on Tuesday between 10am and noon.',
		createdAt: '2026-08-14T05:30:00.000Z'
	},
	{
		id: 'cmt-2',
		grievanceId: 'GRV-0001',
		authorId: 'stu-1',
		body: 'Thank you. The leak has gotten slightly worse, water is reaching the wardrobe now.',
		createdAt: '2026-08-14T09:05:00.000Z'
	},
	{
		id: 'cmt-3',
		grievanceId: 'GRV-0001',
		authorId: 'war-1',
		body: 'Noted — I have flagged it as priority for the visit.',
		createdAt: '2026-08-14T10:12:00.000Z'
	},
	{
		id: 'cmt-4',
		grievanceId: 'GRV-0002',
		authorId: 'war-1',
		body: 'Electrician inspected the fitting; replacement tube lights have been ordered.',
		createdAt: '2026-08-15T07:45:00.000Z'
	},
	{
		id: 'cmt-5',
		grievanceId: 'GRV-0003',
		authorId: 'war-1',
		body: 'ISP has been notified about the outage in Block A. Escalation reference: #48211.',
		createdAt: '2026-08-16T04:20:00.000Z'
	},
	{
		id: 'cmt-6',
		grievanceId: 'GRV-0003',
		authorId: 'stu-2',
		body: 'It came back for an hour yesterday evening and dropped again.',
		createdAt: '2026-08-16T08:40:00.000Z'
	},
	{
		id: 'cmt-7',
		grievanceId: 'GRV-0004',
		authorId: 'war-1',
		body: 'Cleaning schedule for the third floor has been revised. Marking this resolved — please reopen if it regresses.',
		createdAt: '2026-08-17T06:00:00.000Z'
	},
	{
		id: 'cmt-8',
		grievanceId: 'GRV-0006',
		authorId: 'stu-3',
		body: 'Requesting an update when possible — the noise makes it hard to sleep.',
		createdAt: '2026-08-18T15:10:00.000Z'
	},
	{
		id: 'cmt-9',
		grievanceId: 'GRV-0006',
		authorId: 'war-1',
		body: 'Generator maintenance is booked for Friday. Apologies for the disturbance.',
		createdAt: '2026-08-18T16:02:00.000Z'
	},
	{
		id: 'cmt-10',
		grievanceId: 'GRV-0007',
		authorId: 'war-1',
		body: 'Water tank was cleaned and refilled on Sunday. Confirming supply is normal.',
		createdAt: '2026-08-16T03:30:00.000Z'
	}
];

interface SeedGrievance {
	id: string;
	title: string;
	description: string;
	category: GrievanceCategory;
	status: GrievanceStatus;
	studentId: string;
	createdAt: string;
	updatedAt: string;
	attachmentIds: string[];
}

export const MOCK_GRIEVANCES: SeedGrievance[] = [
	{
		id: 'GRV-0001',
		title: 'Water leaking from bathroom ceiling',
		description:
			'Since Monday there has been a steady leak from the ceiling of the attached bathroom in B-204. Water pools on the floor and has started dripping near the electrical switch board, which feels unsafe.',
		category: 'Water',
		status: 'In Progress',
		studentId: 'stu-1',
		createdAt: '2026-08-13T09:15:00.000Z',
		updatedAt: '2026-08-14T10:12:00.000Z',
		attachmentIds: ['att-1']
	},
	{
		id: 'GRV-0002',
		title: 'Corridor tube lights not working',
		description:
			'Both tube lights in the second floor corridor of Block B have been non-functional for four days. The corridor is completely dark after 7pm.',
		category: 'Electricity',
		status: 'In Progress',
		studentId: 'stu-1',
		createdAt: '2026-08-14T18:30:00.000Z',
		updatedAt: '2026-08-15T07:45:00.000Z',
		attachmentIds: ['att-2']
	},
	{
		id: 'GRV-0003',
		title: 'Hostel Wi-Fi drops every few hours',
		description:
			'The Wi-Fi in Block A disconnects repeatedly, especially between 8pm and midnight. Speed tests show under 1 Mbps when connected. Attached a screenshot from yesterday.',
		category: 'Internet',
		status: 'Open',
		studentId: 'stu-2',
		createdAt: '2026-08-15T20:10:00.000Z',
		updatedAt: '2026-08-16T08:40:00.000Z',
		attachmentIds: ['att-3']
	},
	{
		id: 'GRV-0004',
		title: 'Third floor common area not cleaned',
		description:
			'The common room and corridor on the third floor of Block C have not been swept for over a week. Dust bins are overflowing in the morning.',
		category: 'Cleanliness',
		status: 'Resolved',
		studentId: 'stu-3',
		createdAt: '2026-08-12T07:00:00.000Z',
		updatedAt: '2026-08-17T06:00:00.000Z',
		attachmentIds: []
	},
	{
		id: 'GRV-0005',
		title: 'Window latch broken in A-112',
		description:
			'The window latch in room A-112 is broken and the window cannot be secured. Rain water entered during last week\u2019s storm and damaged books kept near the sill.',
		category: 'Room',
		status: 'Open',
		studentId: 'stu-2',
		createdAt: '2026-08-18T11:25:00.000Z',
		updatedAt: '2026-08-18T11:25:00.000Z',
		attachmentIds: []
	},
	{
		id: 'GRV-0006',
		title: 'Generator noise near C block at night',
		description:
			'The backup generator behind C block runs for long stretches at night and the noise makes it difficult to sleep in the rooms facing the rear. Requesting it be serviced or sound-proofed.',
		category: 'Maintenance',
		status: 'In Progress',
		studentId: 'stu-3',
		createdAt: '2026-08-17T21:45:00.000Z',
		updatedAt: '2026-08-18T16:02:00.000Z',
		attachmentIds: []
	},
	{
		id: 'GRV-0007',
		title: 'Low water pressure on mornings',
		description:
			'Water pressure on taps in C block drops sharply between 6am and 8am. Buckets take very long to fill. It normalises after 9am.',
		category: 'Water',
		status: 'Resolved',
		studentId: 'stu-3',
		createdAt: '2026-08-11T06:50:00.000Z',
		updatedAt: '2026-08-16T03:30:00.000Z',
		attachmentIds: []
	},
	{
		id: 'GRV-0008',
		title: 'Mess tables not wiped before dinner',
		description:
			'For the past few days the dining tables in the mess are not wiped before dinner service. Requesting the housekeeping staff to follow the standard routine.',
		category: 'Other',
		status: 'Open',
		studentId: 'stu-1',
		createdAt: '2026-08-19T13:05:00.000Z',
		updatedAt: '2026-08-19T13:05:00.000Z',
		attachmentIds: ['att-4']
	}
];

/** Fully assembled, immutable seed grievances (as the API would return them). */
export function buildSeedGrievances(): Grievance[] {
	return MOCK_GRIEVANCES.map((g) => {
		const student = MOCK_USERS[g.studentId];
		if (!student) throw new Error(`Unknown studentId ${g.studentId} in seed data`);
		const comments: Comment[] = MOCK_COMMENTS.filter((c) => c.grievanceId === g.id)
			.map((c) => {
				const author = MOCK_USERS[c.authorId];
				if (!author) throw new Error(`Unknown authorId ${c.authorId} in seed data`);
				return { id: c.id, grievanceId: c.grievanceId, authorId: c.authorId, author, body: c.body, createdAt: c.createdAt };
			})
			.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
		return {
			id: g.id,
			title: g.title,
			description: g.description,
			category: g.category,
			status: g.status,
			studentId: g.studentId,
			student,
			createdAt: g.createdAt,
			updatedAt: g.updatedAt,
			attachments: g.attachmentIds
				.map((id) => MOCK_ATTACHMENTS[id])
				.filter((a): a is Attachment => Boolean(a)),
			comments
		};
	});
}
