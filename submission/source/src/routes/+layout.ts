import { redirect } from '@sveltejs/kit';
import { getSession } from '$lib/stores/auth.svelte';
import type { LayoutLoad } from './$types';

/** Session lives in the browser (cookie + localStorage cache). */
export const ssr = false;

/**
 * Route guard: every non-login route requires a session with the matching role.
 * Runs after +layout.svelte has restored the session.
 */
export const load: LayoutLoad = ({ url }) => {
	const user = getSession();

	// Public routes — accessible without a session
	const isPublic =
		url.pathname === '/login' ||
		url.pathname === '/register' ||
		url.pathname.startsWith('/register/');

	if (isPublic) {
		// If already logged in, redirect away from auth pages to their dashboard
		if (user) {
			redirect(307, user.role === 'student' ? '/student' : '/warden');
		}
		return {};
	}

	// All other routes require a session
	if (!user) {
		redirect(307, '/login');
	}

	const prefix = user.role === 'student' ? '/student' : '/warden';
	if (!url.pathname.startsWith(prefix)) {
		// Wrong role area — send them to their own dashboard instead of a 404.
		redirect(307, prefix);
	}

	return {};
};
