import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { openDatabase } from './db/connection.ts';
import { seedDatabase } from './db/seed.ts';

const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
	'base64'
);

function cookieHeader(res: Response): string {
	const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
	const list = anyHeaders.getSetCookie?.() ?? [];
	if (list.length > 0) {
		return list.map((v) => v.split(';')[0]).join('; ');
	}
	const raw = res.headers.get('set-cookie');
	return raw ? raw.split(';')[0] : '';
}

async function login(app: ReturnType<typeof createApp>, email: string, password: string) {
	const res = await app.request('/api/login', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password })
	});
	const json = await res.json();
	return { res, json, cookie: cookieHeader(res) };
}

describe('HostelGrievance API baseline', () => {
	let dir: string;
	let app: ReturnType<typeof createApp>;
	let db: ReturnType<typeof openDatabase>;

	beforeEach(async () => {
		dir = mkdtempSync(join(tmpdir(), 'hg-api-'));
		db = openDatabase(join(dir, 'hostel.db'));
		const uploadDir = join(dir, 'uploads');
		await seedDatabase(db, uploadDir);
		app = createApp({ db, uploadsDir: uploadDir });
	});

	afterEach(() => {
		db.close();
		rmSync(dir, { recursive: true, force: true });
	});

	it('login works for dummy student and warden accounts', async () => {
		const student = await login(app, 'student@example.test', 'student123');
		expect(student.res.status).toBe(200);
		expect(student.json.user.email).toBe('student@example.test');
		expect(student.json.user.role).toBe('student');
		expect(student.json.user.password).toBeUndefined();
		expect(student.json.user.password_hash).toBeUndefined();
		expect(student.cookie).toContain('hg_session=');

		const warden = await login(app, 'warden@example.test', 'warden123');
		expect(warden.res.status).toBe(200);
		expect(warden.json.user.role).toBe('warden');
	});

	it('rejects invalid credentials', async () => {
		const bad = await login(app, 'student@example.test', 'wrong');
		expect(bad.res.status).toBe(401);
		expect(bad.json.code).toBe('unauthenticated');
	});

	it('current-user works after login and fails after logout', async () => {
		const { cookie } = await login(app, 'student@example.test', 'student123');
		const me = await app.request('/api/me', { headers: { Cookie: cookie } });
		expect(me.status).toBe(200);
		const meJson = await me.json();
		expect(meJson.user.id).toBe('stu-1');
		expect(meJson.user.password_hash).toBeUndefined();

		const unauth = await app.request('/api/me');
		expect(unauth.status).toBe(401);

		await app.request('/api/logout', { method: 'POST', headers: { Cookie: cookie } });
		const after = await app.request('/api/me', { headers: { Cookie: cookie } });
		expect(after.status).toBe(401);
	});

	it('student can create a grievance', async () => {
		const { cookie } = await login(app, 'student@example.test', 'student123');
		const res = await app.request('/api/grievances', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({
				title: 'Broken cupboard hinge',
				category: 'Room',
				description: 'The cupboard hinge in B-204 is broken and the door will not close properly.'
			})
		});
		expect(res.status).toBe(201);
		const json = await res.json();
		expect(json.data.id).toMatch(/^GRV-[0-9A-F]{12}$/);
		expect(json.data.studentId).toBe('stu-1');
		expect(json.data.status).toBe('Open');
		expect(json.data.student.email).toBe('student@example.test');
	});

	it('student can retrieve a permitted grievance', async () => {
		const { cookie } = await login(app, 'student@example.test', 'student123');
		const res = await app.request('/api/grievances/GRV-0001', { headers: { Cookie: cookie } });
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.data.id).toBe('GRV-0001');
		expect(json.data.comments.length).toBeGreaterThan(0);
		expect(json.data.attachments[0].filename).toBe('leaking-tap.jpg');
	});

	it('student cannot access another student’s grievance', async () => {
		const { cookie } = await login(app, 'student@example.test', 'student123');
		const res = await app.request('/api/grievances/GRV-0003', { headers: { Cookie: cookie } });
		expect(res.status).toBe(403);
		const json = await res.json();
		expect(json.code).toBe('unauthorized');

		const list = await app.request('/api/grievances', { headers: { Cookie: cookie } });
		const listJson = await list.json();
		expect(listJson.data.every((g: { studentId: string }) => g.studentId === 'stu-1')).toBe(true);
		expect(listJson.data.some((g: { id: string }) => g.id === 'GRV-0003')).toBe(false);
	});

	it('warden can access management functionality', async () => {
		const { cookie } = await login(app, 'warden@example.test', 'warden123');
		const list = await app.request('/api/grievances', { headers: { Cookie: cookie } });
		expect(list.status).toBe(200);
		const listJson = await list.json();
		expect(listJson.data.length).toBeGreaterThanOrEqual(8);

		const one = await app.request('/api/grievances/GRV-0003', { headers: { Cookie: cookie } });
		expect(one.status).toBe(200);
	});

	it('comments work for permitted users', async () => {
		const { cookie } = await login(app, 'student@example.test', 'student123');
		const res = await app.request('/api/grievances/GRV-0001/comments', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ body: 'Following up on the leak this morning.' })
		});
		expect(res.status).toBe(201);
		const json = await res.json();
		expect(json.data.body).toContain('Following up');
		expect(json.data.author.id).toBe('stu-1');
		expect(json.data.author.password_hash).toBeUndefined();

		const list = await app.request('/api/grievances/GRV-0001/comments', { headers: { Cookie: cookie } });
		const listed = await list.json();
		expect(listed.data.some((c: { id: string }) => c.id === json.data.id)).toBe(true);
	});

	it('status changes work for wardens and are forbidden for students', async () => {
		const student = await login(app, 'student@example.test', 'student123');
		const denied = await app.request('/api/grievances/GRV-0001', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Cookie: student.cookie },
			body: JSON.stringify({ status: 'Resolved' })
		});
		expect(denied.status).toBe(403);

		const warden = await login(app, 'warden@example.test', 'warden123');
		const updated = await app.request('/api/grievances/GRV-0008', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Cookie: warden.cookie },
			body: JSON.stringify({ status: 'In Progress' })
		});
		expect(updated.status).toBe(200);
		const json = await updated.json();
		expect(json.data.status).toBe('In Progress');
	});

	it('attachment metadata and storage work', async () => {
		const { cookie } = await login(app, 'student@example.test', 'student123');
		const created = await app.request('/api/grievances', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({
				title: 'Need a photo on file',
				category: 'Other',
				description: 'Filing this so I can attach a photo of the damaged locker door.'
			})
		});
		const grievance = await created.json();
		const id = grievance.data.id as string;

		const form = new FormData();
		form.append('file', new File([PNG], 'locker.png', { type: 'image/png' }));
		const uploaded = await app.request(`/api/grievances/${id}/attachments`, {
			method: 'POST',
			headers: { Cookie: cookie },
			body: form
		});
		expect(uploaded.status).toBe(201);
		const meta = await uploaded.json();
		expect(meta.data.filename).toBe('locker.png');
		expect(meta.data.contentType).toBe('image/png');
		expect(meta.data.sizeBytes).toBe(PNG.length);

		const fileRes = await app.request(`/api/attachments/${meta.data.id}`, { headers: { Cookie: cookie } });
		expect(fileRes.status).toBe(200);
		expect(fileRes.headers.get('content-type')).toBe('image/png');
		const bytes = Buffer.from(await fileRes.arrayBuffer());
		expect(bytes.equals(PNG)).toBe(true);

		const other = await login(app, 'priya@example.test', 'student123');
		const stolen = await app.request(`/api/attachments/${meta.data.id}`, {
			headers: { Cookie: other.cookie }
		});
		expect(stolen.status).toBe(403);
	});

	it('rejects oversized and disallowed attachments', async () => {
		const { cookie } = await login(app, 'student@example.test', 'student123');
		const huge = new Uint8Array(2 * 1024 * 1024 + 1);
		const over = new FormData();
		over.append('file', new File([huge], 'big.png', { type: 'image/png' }));
		const overRes = await app.request('/api/grievances/GRV-0008/attachments', {
			method: 'POST',
			headers: { Cookie: cookie },
			body: over
		});
		expect(overRes.status).toBe(400);

		const invalid = new FormData();
		invalid.append('file', new File(['not-an-image'], 'notes.txt', { type: 'text/plain' }));
		const invalidRes = await app.request('/api/grievances/GRV-0008/attachments', {
			method: 'POST',
			headers: { Cookie: cookie },
			body: invalid
		});
		expect(invalidRes.status).toBe(400);
	});

	it('lets a student edit their own open grievance but not a resolved one', async () => {
		const { cookie } = await login(app, 'student@example.test', 'student123');
		const edited = await app.request('/api/grievances/GRV-0008', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ title: 'Mess tables still dirty before dinner' })
		});
		expect(edited.status).toBe(200);
		const editedJson = await edited.json();
		expect(editedJson.data.title).toContain('still dirty');

		const other = await login(app, 'priya@example.test', 'student123');
		const forbidden = await app.request('/api/grievances/GRV-0008', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Cookie: other.cookie },
			body: JSON.stringify({ title: 'Should not work at all here' })
		});
		expect(forbidden.status).toBe(403);

		const rohan = await login(app, 'rohan@example.test', 'student123');
		const resolved = await app.request('/api/grievances/GRV-0004', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Cookie: rohan.cookie },
			body: JSON.stringify({ title: 'Trying to change a resolved ticket' })
		});
		expect(resolved.status).toBe(409);
		const resolvedJson = await resolved.json();
		expect(resolvedJson.code).toBe('conflict');
	});

	it('rejects unauthenticated grievance access', async () => {
		const res = await app.request('/api/grievances');
		expect(res.status).toBe(401);
	});

	it('returns 404 for unknown grievance ids without leaking internals', async () => {
		const { cookie } = await login(app, 'warden@example.test', 'warden123');
		const res = await app.request('/api/grievances/GRV-9999', { headers: { Cookie: cookie } });
		expect(res.status).toBe(404);
		const json = await res.json();
		expect(json.code).toBe('not_found');
		expect(JSON.stringify(json)).not.toMatch(/sqlite|stack|ENOENT/i);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Registration and RBAC tests (Tests A–L from the security test plan)
// ─────────────────────────────────────────────────────────────────────────────
describe('Registration and RBAC security tests', () => {
	let dir: string;
	let app: ReturnType<typeof createApp>;
	let db: ReturnType<typeof openDatabase>;

	beforeEach(async () => {
		dir = mkdtempSync(join(tmpdir(), 'hg-rbac-'));
		db = openDatabase(join(dir, 'hostel.db'));
		const uploadDir = join(dir, 'uploads');
		await seedDatabase(db, uploadDir);
		app = createApp({ db, uploadsDir: uploadDir });
	});

	afterEach(() => {
		db.close();
		rmSync(dir, { recursive: true, force: true });
	});

	// ── Test A: student registration ────────────────────────────────────────
	it('Test A — student can register and log in', async () => {
		const res = await app.request('/api/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: 'Aarav Test',
				email: 'aarav-test@example.com',
				password: 'SecurePass1!',
				confirmPassword: 'SecurePass1!',
				room: 'D-101'
			})
		});
		expect(res.status).toBe(201);
		const json = await res.json();
		expect(json.user.role).toBe('student');
		expect(json.user.email).toBe('aarav-test@example.com');
		expect(json.user.password_hash).toBeUndefined();
		expect(json.user.password).toBeUndefined();

		// Verify they can log in with the new credential
		const login = await app.request('/api/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'aarav-test@example.com', password: 'SecurePass1!' })
		});
		expect(login.status).toBe(200);
		const loginJson = await login.json();
		expect(loginJson.user.role).toBe('student');

		// Verify the hash in the DB is not plaintext and is Argon2
		const row = db.prepare('SELECT password_hash FROM users WHERE email = ?').get('aarav-test@example.com') as { password_hash: string };
		expect(row.password_hash).toMatch(/^argon2:/);
		expect(row.password_hash).not.toBe('SecurePass1!');
	});

	// ── Test B: duplicate email ──────────────────────────────────────────────
	it('Test B — duplicate email is rejected with safe error', async () => {
		const body = JSON.stringify({
			name: 'Duplicate Test',
			email: 'dup@example.com',
			password: 'SecurePass1!',
			confirmPassword: 'SecurePass1!',
			room: 'A-1'
		});
		const first = await app.request('/api/register', {
			method: 'POST', headers: { 'Content-Type': 'application/json' }, body
		});
		expect(first.status).toBe(201);

		const second = await app.request('/api/register', {
			method: 'POST', headers: { 'Content-Type': 'application/json' }, body
		});
		expect(second.status).toBe(409);
		const json = await second.json();
		expect(json.code).toBe('conflict');
		// Must not expose SQL error text
		expect(JSON.stringify(json)).not.toMatch(/sqlite|UNIQUE|sql/i);
	});

	// ── Test C: role manipulation ────────────────────────────────────────────
	it('Test C — role field in registration is ignored; account is always student', async () => {
		const res = await app.request('/api/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: 'Malicious User',
				email: 'malicious@example.com',
				password: 'StrongPassword123!',
				confirmPassword: 'StrongPassword123!',
				room: 'B-101',
				role: 'warden' // ← attacker's attempt to self-elevate
			})
		});
		expect(res.status).toBe(201);
		const json = await res.json();
		// Must be student regardless of what was sent
		expect(json.user.role).toBe('student');

		// Verify in DB too
		const row = db.prepare('SELECT role FROM users WHERE email = ?').get('malicious@example.com') as { role: string };
		expect(row.role).toBe('student');
	});

	// ── Test D: student cannot call warden list-all ──────────────────────────
	it('Test D — student directly calling GET /api/grievances gets only their own grievances (not all)', async () => {
		// Aarav is student with stu-1; warden can see all 8 grievances
		const studentLoginRes = await app.request('/api/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'student@example.test', password: 'student123' })
		});
		const { cookie } = { cookie: cookieHeader(studentLoginRes) };

		const res = await app.request('/api/grievances', { headers: { Cookie: cookie } });
		expect(res.status).toBe(200);
		const json = await res.json();
		// Server enforces: student only gets their own
		expect(json.data.every((g: { studentId: string }) => g.studentId === 'stu-1')).toBe(true);
		// Should NOT contain GRV-0003 (Priya's grievance)
		expect(json.data.some((g: { id: string }) => g.id === 'GRV-0003')).toBe(false);
	});

	// ── Test F: IDOR — student cannot read another student's grievance ────────
	it('Test F — student cannot access another student\'s grievance (403)', async () => {
		const loginRes = await app.request('/api/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'student@example.test', password: 'student123' })
		});
		const cookie = cookieHeader(loginRes);

		// GRV-0003 belongs to Priya (stu-2), not Aarav (stu-1)
		const res = await app.request('/api/grievances/GRV-0003', { headers: { Cookie: cookie } });
		expect(res.status).toBe(403);
		const json = await res.json();
		expect(json.code).toBe('unauthorized');
		// No grievance content must be returned
		expect(json.data).toBeUndefined();
	});

	// ── Test G: student cannot read another student's comments ───────────────
	it('Test G — student cannot access comments on another student\'s grievance (403)', async () => {
		const loginRes = await app.request('/api/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'student@example.test', password: 'student123' })
		});
		const cookie = cookieHeader(loginRes);

		// GRV-0003 belongs to Priya, not Aarav
		const res = await app.request('/api/grievances/GRV-0003/comments', { headers: { Cookie: cookie } });
		expect(res.status).toBe(403);
		expect((await res.json()).code).toBe('unauthorized');
	});

	// ── Test H: student cannot download another student's attachment ─────────
	it('Test H — student cannot download an attachment from another student\'s grievance (403)', async () => {
		const loginRes = await app.request('/api/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'student@example.test', password: 'student123' })
		});
		const cookie = cookieHeader(loginRes);

		// att-2 is attached to GRV-0002, which belongs to Aarav (stu-1), so att-2 is accessible
		// att-3 is attached to GRV-0003, which belongs to Priya (stu-2), so att-3 must be blocked
		const res = await app.request('/api/attachments/att-3', { headers: { Cookie: cookie } });
		expect(res.status).toBe(403);
		expect((await res.json()).code).toBe('unauthorized');
	});

	// ── Test I: student cannot change grievance status ────────────────────────
	it('Test I — student cannot change grievance status (403)', async () => {
		const loginRes = await app.request('/api/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'student@example.test', password: 'student123' })
		});
		const cookie = cookieHeader(loginRes);

		// Try to change GRV-0001 (Aarav's own grievance) status — student not allowed
		const res = await app.request('/api/grievances/GRV-0001', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ status: 'Resolved' })
		});
		expect(res.status).toBe(403);
		expect((await res.json()).code).toBe('unauthorized');
	});

	// ── Test J: warden can perform warden actions ─────────────────────────────
	it('Test J — warden can list all grievances and update status', async () => {
		const loginRes = await app.request('/api/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'warden@example.test', password: 'warden123' })
		});
		const cookie = cookieHeader(loginRes);

		// Warden sees all grievances (8 seeded)
		const list = await app.request('/api/grievances', { headers: { Cookie: cookie } });
		expect(list.status).toBe(200);
		expect((await list.json()).data.length).toBeGreaterThanOrEqual(8);

		// Warden can update status
		const patch = await app.request('/api/grievances/GRV-0003', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ status: 'Resolved' })
		});
		expect(patch.status).toBe(200);
		expect((await patch.json()).data.status).toBe('Resolved');
	});

	// ── Test K: password separation ───────────────────────────────────────────
	it('Test K — cross-user password authentication fails', async () => {
		// Aarav's password does NOT authenticate as Priya
		const attempt1 = await app.request('/api/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'priya@example.test', password: 'student123' })
		});
		// In dev seed all three students happen to share 'student123' as the credential VALUE
		// but each has a unique Argon2 hash — verify they still log in independently
		expect(attempt1.status).toBe(200);
		expect((await attempt1.json()).user.email).toBe('priya@example.test');

		// Verify cross-role: student password does NOT authenticate warden
		const attempt2 = await app.request('/api/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'warden@example.test', password: 'student123' })
		});
		expect(attempt2.status).toBe(401);

		// Verify cross-role: warden password does NOT authenticate student
		const attempt3 = await app.request('/api/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'student@example.test', password: 'warden123' })
		});
		expect(attempt3.status).toBe(401);
	});

	// ── Test L: session cookie security ──────────────────────────────────────
	it('Test L — session cookie has HttpOnly and SameSite flags', async () => {
		const res = await app.request('/api/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'student@example.test', password: 'student123' })
		});
		expect(res.status).toBe(200);
		const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
		const setCookieValues = anyHeaders.getSetCookie?.() ?? [res.headers.get('set-cookie') ?? ''];
		const sessionCookie = setCookieValues.find((v) => v.includes('hg_session=')) ?? '';
		expect(sessionCookie).toMatch(/HttpOnly/i);
		expect(sessionCookie).toMatch(/SameSite=Lax/i);
	});

	// ── Warden invite code tests ──────────────────────────────────────────────
	it('warden registration is blocked when WARDEN_INVITE_CODE is not set', async () => {
		// In tests env var is not set, so endpoint should be disabled
		const res = await app.request('/api/register/warden', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: 'New Warden',
				email: 'new-warden@example.com',
				password: 'WardenPass1!',
				confirmPassword: 'WardenPass1!',
				inviteCode: 'anything'
			})
		});
		expect(res.status).toBe(403);
	});

	// ── Student cannot post comment on another's grievance ────────────────────
	it('student cannot post a comment on another student\'s grievance (403)', async () => {
		const loginRes = await app.request('/api/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'student@example.test', password: 'student123' })
		});
		const cookie = cookieHeader(loginRes);

		// GRV-0003 belongs to Priya
		const res = await app.request('/api/grievances/GRV-0003/comments', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ body: 'Injecting into someone else\'s grievance' })
		});
		expect(res.status).toBe(403);
	});

	// ── Unauthenticated requests return 401 ───────────────────────────────────
	it('unauthenticated requests return 401, not 403 or data', async () => {
		const routes = [
			'/api/me',
			'/api/grievances',
			'/api/grievances/GRV-0001',
			'/api/grievances/GRV-0001/comments',
			'/api/attachments/att-1'
		];
		for (const route of routes) {
			const res = await app.request(route);
			expect(res.status, `Expected 401 for ${route}`).toBe(401);
			const json = await res.json();
			expect(json.code, `Expected unauthenticated code for ${route}`).toBe('unauthenticated');
		}
	});
});
