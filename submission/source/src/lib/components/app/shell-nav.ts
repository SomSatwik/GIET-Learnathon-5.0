import type { Component } from 'svelte';
import type { Role } from '$lib/types';
import LayoutDashboardIcon from '@lucide/svelte/icons/layout-dashboard';
import ClipboardListIcon from '@lucide/svelte/icons/clipboard-list';
import PlusCircleIcon from '@lucide/svelte/icons/plus-circle';

export interface ShellNavItem {
	label: string;
	href: string;
	icon: Component;
}

export function shellNav(role: Role): ShellNavItem[] {
	switch (role) {
		case 'student':
			return [
				{ label: 'Dashboard', href: '/student', icon: LayoutDashboardIcon },
				{ label: 'Grievances', href: '/student/grievances', icon: ClipboardListIcon },
				{ label: 'New Grievance', href: '/student/grievances/new', icon: PlusCircleIcon }
			];
		case 'warden':
			return [
				{ label: 'Dashboard', href: '/warden', icon: LayoutDashboardIcon },
				{ label: 'Grievances', href: '/warden/grievances', icon: ClipboardListIcon }
			];
		default: {
			const _exhaustive: never = role;
			return _exhaustive;
		}
	}
}

export function activeNavHref(pathname: string, items: ShellNavItem[]): string | undefined {
	return [...items]
		.sort((a, b) => b.href.length - a.href.length)
		.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.href;
}
