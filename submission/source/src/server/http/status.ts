import { HttpError } from './errors.ts';
import type { GrievanceCategory, GrievanceStatusDb, GrievanceStatusUi } from '../types/index.ts';

export const GRIEVANCE_CATEGORIES: readonly GrievanceCategory[] = [
	'Maintenance',
	'Water',
	'Electricity',
	'Internet',
	'Cleanliness',
	'Room',
	'Other'
];

export function statusToUi(status: GrievanceStatusDb): GrievanceStatusUi {
	switch (status) {
		case 'open':
			return 'Open';
		case 'in_progress':
			return 'In Progress';
		case 'resolved':
			return 'Resolved';
		default: {
			const _exhaustive: never = status;
			return _exhaustive;
		}
	}
}

export function statusToDb(status: string): GrievanceStatusDb {
	switch (status) {
		case 'open':
		case 'Open':
			return 'open';
		case 'in_progress':
		case 'In Progress':
			return 'in_progress';
		case 'resolved':
		case 'Resolved':
			return 'resolved';
		default:
			throw new HttpError(400, 'bad_request', 'Invalid grievance status.');
	}
}

export function parseCategory(value: string): GrievanceCategory {
	if ((GRIEVANCE_CATEGORIES as readonly string[]).includes(value)) {
		return value as GrievanceCategory;
	}
	throw new HttpError(400, 'bad_request', 'Invalid grievance category.');
}
