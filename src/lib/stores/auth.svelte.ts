/**
 * Session state — Svelte 5 runes module.
 * Single source of truth for "who is logged in" across the UI.
 * The future Hono API replaces the backing service, not this module's API.
 */
import { authService } from '$lib/services';
import type { User } from '$lib/types';

// Restored synchronously (mock: localStorage) so route guards can rely on it
// during the very first load without an async race.
let current = $state<User | null>(authService.restore());

export function getSession(): User | null {
	return current;
}

export function isStudent(): boolean {
	return current?.role === 'student';
}

export function isWarden(): boolean {
	return current?.role === 'warden';
}

export async function signIn(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
	const result = await authService.signIn(email, password);
	if (result.ok) {
		current = result.user;
		return { ok: true };
	}
	return { ok: false, error: result.error };
}

export async function signOut(): Promise<void> {
	await authService.signOut();
	current = null;
}
