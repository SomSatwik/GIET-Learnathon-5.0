# Security Audit Report — HostelGrievance (GIET-Learnathon-5.0)

**Auditor:** Antigravity AI  
**Date:** 2026-08-28  
**Stack:** SvelteKit (SSR disabled) + Hono API + better-sqlite3  
**Scope:** Full codebase — backend, frontend, config, dependencies

---

> [!CAUTION]
> **5 CRITICAL / 6 HIGH issues found. Do NOT deploy this application as-is.**  
> The CORS misconfiguration + weak password hashing + session cookie exposure are instant deployment blockers.

---

## CRITICAL

---

### CRIT-1 — Wildcard CORS with `credentials: true` (Reflected Origin)

**Severity:** Critical  
**Location:** [`src/server/app.ts` line 23](file:///c:/Users/hp/OneDrive/Desktop/newIssue/GIET-Learnathon-5.0/src/server/app.ts)

**Issue:**
```ts
app.use('/api/*', cors({ origin: (origin) => origin ?? '*', credentials: true }));
```
The `origin` callback reflects back _whatever origin the request came from_ (`origin ?? '*'`). Combined with `credentials: true`, this is exactly the CORS misconfiguration that OWASP and browsers specifically warn against.

**Why it's exploitable:**  
An attacker creates `https://evil.com` with the following script:
```js
fetch('https://hostelgrievance.giet.edu/api/grievances', {
  credentials: 'include'
}).then(r => r.json()).then(data => sendToAttacker(data));
```
Because the server reflects back `Origin: https://evil.com` in `Access-Control-Allow-Origin` **and** sets `Access-Control-Allow-Credentials: true`, the browser will allow the cross-origin read. The victim student's session cookie is used automatically — the attacker reads all their grievances. With a PATCH request, they can also modify data.

**Fix:**
```ts
const ALLOWED_ORIGINS = new Set([
  'https://yourdomain.giet.edu',
  'http://localhost:5173'  // dev only
]);

app.use('/api/*', cors({
  origin: (origin) => (origin && ALLOWED_ORIGINS.has(origin) ? origin : null),
  credentials: true
}));
```

---

### CRIT-2 — SHA-256 Password Hashing (No Salt, No KDF)

**Severity:** Critical  
**Location:** [`src/server/auth/passwords.ts` lines 3–5](file:///c:/Users/hp/OneDrive/Desktop/newIssue/GIET-Learnathon-5.0/src/server/auth/passwords.ts)

**Issue:**
```ts
export function hashPassword(password: string): string {
  return `sha256:${createHash('sha256').update(password).digest('hex')}`;
}
```
SHA-256 is a **fast, unsalted** hash. It:
- Has no salt → identical passwords produce identical hashes; rainbow table attacks work
- Is too fast → billions of guesses/second on a GPU
- Is not a KDF (Key Derivation Function) → not designed for password storage

**Why it's exploitable:**  
If the SQLite file is exfiltrated (via SSRF, misconfigured deploy, or backup leak), every password in `data/hostel.db` can be cracked. Common passwords like `student123`, `warden123` (the seeded defaults that students may keep!) would crack in milliseconds against any rainbow table.

**Fix:**
```ts
import { hash, verify } from '@node-rs/argon2'; // or bcrypt

export async function hashPassword(password: string): Promise<string> {
  return hash(password, { memoryCost: 65536, timeCost: 3, parallelism: 4 });
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  return verify(stored, password);
}
```
Migrate `src/server/routes/auth.ts` login handler and all DB seed data accordingly.

---

### CRIT-3 — Plaintext Default Credentials Exposed in Production Login UI

**Severity:** Critical  
**Location:** [`src/routes/login/+page.svelte` lines 100–103](file:///c:/Users/hp/OneDrive/Desktop/newIssue/GIET-Learnathon-5.0/src/routes/login/+page.svelte)

**Issue:**
```html
<p>Demo environment — development credentials only:<br />
  Student: student@example.test / student123<br />
  Warden: warden@example.test / warden123
</p>
```
This text is _always_ rendered — there's no `if (dev)` guard. The seed data with these exact credentials is loaded into production on first startup if the user table is empty.

**Why it's exploitable:**  
Any visitor to the login page immediately sees working admin (warden) credentials. The warden role can view **all** student grievances and change any status. There is no MFA, no account lockout, no rate limiting. This is a complete account takeover.

**Fix:**
1. Remove this paragraph entirely for production, or gate it:
   ```svelte
   {#if import.meta.env.DEV}
     <p>Demo credentials: ...</p>
   {/if}
   ```
2. Change seed passwords to a randomly generated value that is logged once to the server console and not hardcoded.
3. Implement rate limiting on `/api/login` (see HIGH-3).

---

### CRIT-4 — Session Cookie Missing `HttpOnly` and `Secure` Flags

**Severity:** Critical  
**Location:** [`src/server/auth/session.ts` lines 49–54](file:///c:/Users/hp/OneDrive/Desktop/newIssue/GIET-Learnathon-5.0/src/server/auth/session.ts)

**Issue:**
```ts
export function setSessionCookie(c: Context, token: string): void {
  setCookie(c, SESSION_COOKIE, token, {
    path: '/',
    maxAge: SESSION_TTL_SECONDS
    // ❌ No httpOnly, no secure, no sameSite
  });
}
```
The session cookie lacks:
- `httpOnly: true` — JavaScript can read `document.cookie` and steal it
- `secure: true` — cookie sent over plain HTTP, visible to MitM
- `sameSite: 'lax'` or `'strict'` — CSRF is possible

**Why it's exploitable:**  
If any XSS exists anywhere on the SvelteKit frontend (even in a third-party component), `document.cookie` leaks the `hg_session` token. Any HTTP network intercept also captures it. The attacker then makes API calls as that user indefinitely (7-day TTL).

**Fix:**
```ts
setCookie(c, SESSION_COOKIE, token, {
  path: '/',
  maxAge: SESSION_TTL_SECONDS,
  httpOnly: true,
  secure: true,          // require HTTPS
  sameSite: 'Lax'
});
```

---

### CRIT-5 — Broken Object-Level Authorization on `GET /api/grievances/:id`

**Severity:** Critical  
**Location:** [`src/server/routes/grievances.ts` lines 200–205](file:///c:/Users/hp/OneDrive/Desktop/newIssue/GIET-Learnathon-5.0/src/server/routes/grievances.ts)

**Issue:**
```ts
grievanceRoutes.get('/:id', (c) => {
  const db = c.get('db');
  requireUser(c, db);               // ✅ checks auth
  const row = requireGrievance(db, c.req.param('id'));
  return c.json({ data: assembleGrievance(db, row) }); // ❌ no ownership check!
});
```
The `assertCanViewGrievance` function **exists in `queries.ts`** but is **never called** for this route. Any authenticated student can read any other student's grievance by guessing or iterating IDs (`GRV-0001`, `GRV-0002`, …).

Note: the _list_ endpoint correctly scopes to the student's own grievances, but the _individual_ GET bypasses this entirely. The test at `app.test.ts:115` tests `GRV-0003` which belongs to `stu-2` while logged in as `stu-1` — and the test **expects a 403**. This test would currently **fail**, confirming the vulnerability.

**Why it's exploitable:**  
```bash
curl -b 'hg_session=<student1_token>' https://hostelgrievance.giet.edu/api/grievances/GRV-0003
# Returns Priya Nair's private grievance data to a different student
```
The IDs are predictable (GRV-0001, GRV-0002…), making full enumeration trivial.

**Fix:**
```ts
grievanceRoutes.get('/:id', (c) => {
  const db = c.get('db');
  const user = requireUser(c, db);   // ✅
  const row = requireGrievance(db, c.req.param('id'));
  assertCanViewGrievance(user, row); // ✅ ADD THIS
  return c.json({ data: assembleGrievance(db, row) });
});
```

---

## HIGH

---

### HIGH-1 — Broken Object-Level Authorization on `GET /api/grievances/:id/comments`

**Severity:** High  
**Location:** [`src/server/routes/grievances.ts` lines 121–133](file:///c:/Users/hp/OneDrive/Desktop/newIssue/GIET-Learnathon-5.0/src/server/routes/grievances.ts)

**Issue:**
```ts
grievanceRoutes.get('/:id/comments', (c) => {
  const db = c.get('db');
  requireUser(c, db);            // auth check only
  const row = requireGrievance(db, c.req.param('id'));
  // ❌ No assertCanViewGrievance call
  const comments = listCommentRows(db, row.id)...
});
```
Same IDOR pattern as CRIT-5 but for comments — private warden/student conversation threads on any grievance are readable by any authenticated user.

**Fix:** Add `assertCanViewGrievance(user, row)` after `requireUser`.

---

### HIGH-2 — Session Not Destroyed Server-Side on Logout

**Severity:** High  
**Location:** [`src/server/routes/auth.ts` lines 36–39](file:///c:/Users/hp/OneDrive/Desktop/newIssue/GIET-Learnathon-5.0/src/server/routes/auth.ts)

**Issue:**
```ts
authRoutes.post('/logout', (c) => {
  clearSessionCookie(c);    // ✅ clears the browser cookie
  return c.json({ ok: true });
  // ❌ Session row is NEVER deleted from the DB
});
```
`destroySession(db, token)` exists in `session.ts` but is never called from the logout route.

**Why it's exploitable:**  
If an attacker has captured the session token (via network sniff, shoulder surf, shared device), they can continue using it even after the legitimate user clicks "Sign out". The token stays valid for its full 7-day TTL.

**Fix:**
```ts
authRoutes.post('/logout', (c) => {
  const db = c.get('db');
  const token = getCookie(c, SESSION_COOKIE);
  if (token) destroySession(db, token);  // ✅ invalidate server-side
  clearSessionCookie(c);
  return c.json({ ok: true });
});
```

---

### HIGH-3 — No Rate Limiting on Login Endpoint (Brute Force)

**Severity:** High  
**Location:** [`src/server/routes/auth.ts` line 11](file:///c:/Users/hp/OneDrive/Desktop/newIssue/GIET-Learnathon-5.0/src/server/routes/auth.ts) / [`src/server/app.ts`](file:///c:/Users/hp/OneDrive/Desktop/newIssue/GIET-Learnathon-5.0/src/server/app.ts)

**Issue:** No middleware applies rate limiting anywhere in the application. `/api/login` accepts unlimited password attempts per second with zero throttling.

**Why it's exploitable:**  
Combined with SHA-256 hashing (fast to verify, CRIT-2) and the known email addresses from grievance responses, an attacker can brute-force passwords directly against the login endpoint.

**Fix:** Add Hono rate-limit middleware scoped to login:
```ts
import { rateLimiter } from 'hono-rate-limiter';

authRoutes.use('/login', rateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: (c) => c.req.header('x-forwarded-for') ?? 'unknown'
}));
```
Additionally: implement progressive delay / account lockout after N failures per email.

---

### HIGH-4 — Verbose Internal Error Messages Leaked to Client

**Severity:** High  
**Location:** [`src/server/http/errors.ts` line 26](file:///c:/Users/hp/OneDrive/Desktop/newIssue/GIET-Learnathon-5.0/src/server/http/errors.ts)

**Issue:**
```ts
export function handleError(err: unknown, c: Context) {
  if (err instanceof HttpError) {
    return jsonError(c, err.status, err.code, err.message);
  }
  console.error(err);
  // ❌ Raw error message (could be SQLite schema, file path, stack trace) sent to client
  return jsonError(c, 500, 'internal', err instanceof Error ? err.message : String(err));
}
```
Unhandled errors (DB constraint violations, file I/O failures, etc.) return the raw `Error.message` to the HTTP client.

**Why it's exploitable:**  
SQLite errors often include table names, column names, and SQL fragments. Node.js file errors include full filesystem paths. This leaks internal architecture for free to any attacker probing the API.

**Fix:**
```ts
return jsonError(c, 500, 'internal', 'An unexpected error occurred.');
// Keep the full error in server logs only
```

---

### HIGH-5 — MIME Type Trusted from Client (File Upload Bypass)

**Severity:** High  
**Location:** [`src/server/storage/attachments.ts` lines 39–48](file:///c:/Users/hp/OneDrive/Desktop/newIssue/GIET-Learnathon-5.0/src/server/storage/attachments.ts) and [`src/server/routes/grievances.ts` lines 100–115](file:///c:/Users/hp/OneDrive/Desktop/newIssue/GIET-Learnathon-5.0/src/server/routes/grievances.ts)

**Issue:**
```ts
export function assertPermittedAttachment(mime: string, size: number): void {
  if (!ALLOWED_ATTACHMENT_TYPES.has(mime)) { ... }  // checks client-supplied MIME only
}
// ...
assertPermittedAttachment(file.type, bytes.byteLength);  // file.type = client-controlled!
```
The MIME type `file.type` comes directly from the multipart `Content-Type` — it is set by the browser/client and is trivially spoofable.

**Why it's exploitable:**  
An attacker sends a PHP webshell or HTML file with `Content-Type: image/png`. It passes validation, gets stored in the `uploads/` directory. If the upload directory is ever served directly (e.g., nginx `alias`), the attacker executes arbitrary code.

**Fix:** Validate the _magic bytes_ of the file content, not the client-supplied MIME:
```ts
import { fileTypeFromBuffer } from 'file-type';

export async function bufferFromUpload(file: File): Promise<Buffer> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const detected = await fileTypeFromBuffer(bytes);
  if (!detected || !ALLOWED_ATTACHMENT_TYPES.has(detected.mime)) {
    throw new HttpError(400, 'bad_request', 'File content does not match an allowed image type.');
  }
  if (bytes.byteLength > MAX_ATTACHMENT_BYTES) { ... }
  return bytes;
}
```

---

### HIGH-6 — `newStoredName` Falls Back to Original Filename (Path Traversal Risk)

**Severity:** High  
**Location:** [`src/server/storage/attachments.ts` lines 35–37](file:///c:/Users/hp/OneDrive/Desktop/newIssue/GIET-Learnathon-5.0/src/server/storage/attachments.ts) called from [`src/server/routes/grievances.ts` line 187](file:///c:/Users/hp/OneDrive/Desktop/newIssue/GIET-Learnathon-5.0/src/server/routes/grievances.ts)

**Issue:**
```ts
// storage/attachments.ts
export function newStoredName(mime: string, originalName?: string): string {
  return originalName ?? `${randomBytes(16).toString('hex')}${extensionForMime(mime)}`;
  //     ^^^^^^^^^^^^^ Uses the attacker-controlled original filename as the stored filename!
}

// routes/grievances.ts line 187
const stored = newStoredName(upload.type, upload.name);  // ❌ passes upload.name
```
When the caller passes `upload.name`, the client's original filename becomes the actual filename on disk. `originalBasename` strips path separators and null bytes, but the `readStoredFile` path-traversal check only happens at _read_ time. The _write_ path (`writeStoredFile`) does **not** canonicalize.

**Why it's exploitable:**  
An attacker uploads a file named `../app.ts` or crafts a multipart body with filename `../config.js`. If `uploadsDir` is inside the project tree (the default `uploads/`), this could overwrite project files.

**Fix:** Always generate a random UUID-based stored filename; never use the original filename for the stored file:
```ts
export function newStoredName(mime: string): string {
  return `${randomBytes(16).toString('hex')}${extensionForMime(mime)}`;
}
// Remove the optional `originalName` parameter entirely.
// Store original_filename in DB only for display — never as the filesystem name.
```
Also add the path-traversal check to `writeStoredFile`, not just `readStoredFile`.

---

## MEDIUM

---

### MED-1 — Session Expiry Not Enforced Server-Side

**Severity:** Medium  
**Location:** [`src/server/auth/session.ts` lines 29–47](file:///c:/Users/hp/OneDrive/Desktop/newIssue/GIET-Learnathon-5.0/src/server/auth/session.ts)

**Issue:** `readSessionUser` fetches the session row and returns the user but **never checks `expires_at`**:
```ts
const row = db.prepare(`SELECT u.id, u.name, u.email, u.role, u.room, u.created_at, s.expires_at
   FROM sessions s JOIN users u ON u.id = s.user_id
   WHERE s.token = ?`).get(token);
// s.expires_at is selected but never compared to now!
```
The `maxAge` on the cookie is cosmetic — the server accepts any token regardless of DB `expires_at`.

**Fix:**
```ts
if (row.expires_at < nowIso()) {
  destroySession(db, token);
  return undefined;
}
```
Also add a periodic cleanup job to purge expired rows.

---

### MED-2 — Student Can Change Their Own Grievance Status (Business Logic Flaw)

**Severity:** Medium  
**Location:** [`src/server/routes/grievances.ts` lines 260–265](file:///c:/Users/hp/OneDrive/Desktop/newIssue/GIET-Learnathon-5.0/src/server/routes/grievances.ts)

**Issue:** In the `PATCH /:id` handler, the student case allows `status` to be updated:
```ts
case 'student': {
  ...
  if (status !== undefined) {
    nextStatus = statusToDb(status);  // ❌ student can set status to 'resolved'!
  }
```
A student can mark their own unresolved grievance as `resolved` (or back to `open`/`in_progress`) without warden approval, bypassing the entire workflow.

**Fix:** Remove status mutation from the student branch of `PATCH`:
```ts
case 'student': {
  if (wantsStatus) {
    throw new HttpError(403, 'unauthorized', 'Students cannot change grievance status.');
  }
  // ... content updates only
}
```

---

### MED-3 — No Content Security Policy (CSP) Headers

**Severity:** Medium  
**Location:** [`src/server/app.ts`](file:///c:/Users/hp/OneDrive/Desktop/newIssue/GIET-Learnathon-5.0/src/server/app.ts), [`src/app.html`](file:///c:/Users/hp/OneDrive/Desktop/newIssue/GIET-Learnathon-5.0/src/app.html)

**Issue:** No `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, or `Strict-Transport-Security` headers are set anywhere.

**Why it's exploitable:**  
- No CSP = any XSS vulnerability can load external scripts, exfiltrate data, etc.
- No `X-Frame-Options` = clickjacking attacks are possible
- No `X-Content-Type-Options: nosniff` = MIME-type sniffing on uploaded files
- No HSTS = SSL stripping attacks

**Fix:** Add security headers middleware in `app.ts`:
```ts
import { secureHeaders } from 'hono/secure-headers';

app.use('*', secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"], // adjust if needed
    imgSrc: ["'self'", 'data:'],
    connectSrc: ["'self'"],
  },
  xFrameOptions: 'DENY',
  xContentTypeOptions: 'nosniff',
  strictTransportSecurity: 'max-age=31536000; includeSubDomains',
}));
```

---

### MED-4 — Session Token Stored in `localStorage` (XSS Amplification)

**Severity:** Medium  
**Location:** [`src/lib/services/api.ts` lines 40–43](file:///c:/Users/hp/OneDrive/Desktop/newIssue/GIET-Learnathon-5.0/src/lib/services/api.ts)

**Issue:**
```ts
localStorage.setItem(SESSION_KEY, JSON.stringify(user));
// ...
restore(): User | null {
  const raw = localStorage.getItem(SESSION_KEY);
  this.currentUser = JSON.parse(raw) as User;
```
User profile data (id, name, email, role) is cached in `localStorage`. While this doesn't store the actual session cookie (that's in the HTTP cookie jar), XSS can read this data. More importantly, `localStorage` never expires — if the user doesn't explicitly sign out, another person on the same machine permanently has their role/identity info.

**Fix:** On `signOut()`, clear `localStorage`. Set a shorter localStorage TTL. Consider using `sessionStorage` instead for browser-session-scoped persistence.

---

### MED-5 — Predictable Sequential IDs Enable Enumeration

**Severity:** Medium  
**Location:** [`src/server/db/queries.ts` lines 98–134](file:///c:/Users/hp/OneDrive/Desktop/newIssue/GIET-Learnathon-5.0/src/server/db/queries.ts)

**Issue:**
```ts
function nextPrefixedId(db, table, prefix): string {
  // ... scans all rows to find max integer suffix
  return `${prefix}${String(max + 1).padStart(...)}`;
}
// Produces: GRV-0001, GRV-0002, att-1, att-2, cmt-1, ...
```
All IDs are sequential integers. This enables O(n) enumeration of all resources.

**Why it's exploitable:**  
Even after fixing the IDOR (CRIT-5), predictable IDs make it trivially easy to find all grievance IDs to then attempt unauthorized access. Attachment IDs (`att-1`, `att-2`) are similarly predictable.

**Also:** This ID generation algorithm is a **race condition** — two concurrent POSTs both read max=5, both generate ID 6, and one fails with a PRIMARY KEY constraint. Use `INSERT OR IGNORE` or a proper sequence.

**Fix:** Use `crypto.randomUUID()` or `nanoid` for all IDs:
```ts
import { randomUUID } from 'node:crypto';
export function nextGrievanceId(): string { return `GRV-${randomUUID()}`; }
```

---

### MED-6 — No Request Body Size Limit (DoS Risk)

**Severity:** Medium  
**Location:** [`src/server/app.ts`](file:///c:/Users/hp/OneDrive/Desktop/newIssue/GIET-Learnathon-5.0/src/server/app.ts), all route handlers

**Issue:** No global body size limit is configured on the Hono server. The `@hono/node-server` adapter reads the full body before handlers run. While `MAX_ATTACHMENT_BYTES = 2 MB` is enforced _after_ buffering, the check occurs in `bufferFromUpload` — the server already consumed memory.

**Why it's exploitable:**  
An attacker POSTs a 500 MB body to `/api/grievances` or `/api/login`. The Node.js process buffers it entirely before the size check fires, causing memory exhaustion (OOM crash = Denial of Service).

**Fix:** Set a body limit middleware:
```ts
import { bodyLimit } from 'hono/body-limit';
app.use('/api/*', bodyLimit({ maxSize: 3 * 1024 * 1024 })); // 3 MB global cap
```

---

### MED-7 — Attachment Download Has No Ownership Check

**Severity:** Medium  
**Location:** [`src/server/routes/attachments.ts` lines 10–26](file:///c:/Users/hp/OneDrive/Desktop/newIssue/GIET-Learnathon-5.0/src/server/routes/attachments.ts)

**Issue:**
```ts
attachmentRoutes.get('/:id', (c) => {
  const db = c.get('db');
  requireUser(c, db);                              // ✅ auth check
  const row = findAttachmentRow(db, c.req.param('id'));
  requireGrievance(db, row.grievance_id);          // ❌ only checks grievance exists, not ownership
  const bytes = readStoredFile(c.get('uploadsDir'), row.stored_filename);
  ...
});
```
The test at `app.test.ts:210-214` explicitly tests that another student gets a 403 on stolen attachments — meaning the test is already designed to catch this but the server-side logic doesn't enforce it.

**Fix:**
```ts
const grievanceRow = requireGrievance(db, row.grievance_id);
assertCanViewGrievance(user, grievanceRow); // add this
```

---

## LOW

---

### LOW-1 — No Password Complexity Policy

**Severity:** Low  
**Location:** Signup flow (if implemented), seed data

**Issue:** `student123` and `warden123` are the seeded passwords. There is no signup endpoint in scope, but if one is added, there is no complexity enforcement. Even the existing seeded passwords are trivially guessable.

**Fix:** Enforce minimum 12 characters, at least 1 number and 1 special character at the point of password creation. Use a library like `zxcvbn` for strength estimation.

---

### LOW-2 — Sensitive Data in `console.error` / Server Logs

**Severity:** Low  
**Location:** [`src/server/http/errors.ts` line 25](file:///c:/Users/hp/OneDrive/Desktop/newIssue/GIET-Learnathon-5.0/src/server/http/errors.ts)

**Issue:**
```ts
console.error(err);  // Logs full error object including potential stack traces with file paths
```
In production, `console.error` typically goes to stdout/stderr which may be ingested by log aggregators. Full stack traces with Node.js internal paths can reveal server structure.

**Fix:** Use a structured logger (e.g., `pino`) with log levels. Scrub PII fields and paths from error logs.

---

### LOW-3 — `Content-Disposition` Header Allows Filename Injection

**Severity:** Low  
**Location:** [`src/server/routes/attachments.ts` lines 21–24](file:///c:/Users/hp/OneDrive/Desktop/newIssue/GIET-Learnathon-5.0/src/server/routes/attachments.ts)

**Issue:**
```ts
c.header(
  'Content-Disposition',
  `inline; filename="${row.original_filename.replaceAll('"', '')}"`
);
```
Only double-quotes are stripped. Characters like `;`, `\r`, `\n`, `*` in filenames can still break the header structure in some HTTP clients, potentially causing header injection or unsafe filename suggestions.

**Fix:** Encode the filename properly using `RFC 5987` encoding:
```ts
const encoded = encodeURIComponent(row.original_filename);
c.header('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);
```

---

### LOW-4 — No Pagination on List Endpoints

**Severity:** Low  
**Location:** [`src/server/routes/grievances.ts` line 37–44](file:///c:/Users/hp/OneDrive/Desktop/newIssue/GIET-Learnathon-5.0/src/server/routes/grievances.ts)

**Issue:** `GET /api/grievances` for a warden returns **all grievances** in a single response with no pagination, limit, or cursor. `assembleGrievance` does N+1 DB queries (one per attachment, one per comment author) for every grievance in the result set.

**Why it's exploitable:**  
With enough data, a single warden API call triggers hundreds of DB queries and produces a massive JSON response, enabling a low-effort application-layer DoS.

**Fix:** Add `?page=&limit=` query parameters; add a DB-side `LIMIT/OFFSET` clause; and consider lazy-loading comments/attachments.

---

### LOW-5 — Uploaded Files Served Inline Without `sandbox` or Separate Origin

**Severity:** Low  
**Location:** [`src/server/routes/attachments.ts` line 19](file:///c:/Users/hp/OneDrive/Desktop/newIssue/GIET-Learnathon-5.0/src/server/routes/attachments.ts)

**Issue:**
```ts
c.header('Content-Type', row.mime_type);  // client-supplied MIME echoed back
```
Files are served `inline` from the same API origin with the stored MIME type. If magic-byte validation (HIGH-5) is bypassed, a malicious HTML or SVG file served as `image/*` from the API origin executes in the browser context of the application.

**Fix:**
1. Implement HIGH-5 (magic byte validation) first
2. Serve uploaded files from a **separate subdomain** (e.g., `uploads.hostelgrievance.giet.edu`) or a CDN with a strict CSP on that origin
3. Use `Content-Disposition: attachment` instead of `inline`

---

### LOW-6 — SQLite WAL File and DB Potentially World-Readable

**Severity:** Low  
**Location:** [`src/server/db/connection.ts`](file:///c:/Users/hp/OneDrive/Desktop/newIssue/GIET-Learnathon-5.0/src/server/db/connection.ts), default path `data/hostel.db`

**Issue:** The database is created with default OS permissions. On a shared Linux server (common for student deployments), the file may be world-readable, exposing all password hashes, PII, and grievance data to any local user.

**Fix:**
```ts
import { chmodSync } from 'node:fs';
const db = new Database(path);
if (path !== ':memory:') chmodSync(path, 0o600);
```
Also: never store `data/hostel.db` inside the webroot. Use a path outside the project directory in production.

---

### LOW-7 — No Audit Trail / Tamper Detection on Status Changes

**Severity:** Low  
**Location:** [`src/server/routes/grievances.ts` lines 280–285](file:///c:/Users/hp/OneDrive/Desktop/newIssue/GIET-Learnathon-5.0/src/server/routes/grievances.ts)

**Issue:** When a warden changes a grievance status, only `updated_at` changes. There is no audit log recording who changed what, when, and from which value.

**Why it matters:** A warden could quietly mark a grievance `resolved` without leaving a trace. Students have no evidence of tampering. In a real hostel administration system, this is a compliance risk.

**Fix:** Add an `audit_log` table and insert a row on every status transition.

---

## Summary Table

| ID | Severity | Category | File |
|---|---|---|---|
| CRIT-1 | **Critical** | CORS Misconfiguration | app.ts |
| CRIT-2 | **Critical** | Weak Password Hashing | auth/passwords.ts |
| CRIT-3 | **Critical** | Hardcoded Credentials in UI | routes/login/+page.svelte |
| CRIT-4 | **Critical** | Session Cookie Flags | auth/session.ts |
| CRIT-5 | **Critical** | IDOR on GET Grievance | routes/grievances.ts |
| HIGH-1 | High | IDOR on GET Comments | routes/grievances.ts |
| HIGH-2 | High | Session Not Invalidated on Logout | routes/auth.ts |
| HIGH-3 | High | No Rate Limiting on Login | routes/auth.ts |
| HIGH-4 | High | Verbose Error Leak | http/errors.ts |
| HIGH-5 | High | Client MIME Trusted for Uploads | storage/attachments.ts |
| HIGH-6 | High | Original Filename Used as Stored Name | storage/attachments.ts |
| MED-1 | Medium | Session Expiry Not Enforced Server-Side | auth/session.ts |
| MED-2 | Medium | Student Can Self-Resolve Grievances | routes/grievances.ts |
| MED-3 | Medium | No CSP / Security Headers | app.ts |
| MED-4 | Medium | User Object in localStorage | services/api.ts |
| MED-5 | Medium | Sequential Predictable IDs + Race Condition | db/queries.ts |
| MED-6 | Medium | No Request Body Size Limit | app.ts |
| MED-7 | Medium | Attachment Download No Ownership Check | routes/attachments.ts |
| LOW-1 | Low | No Password Complexity Policy | seed.ts |
| LOW-2 | Low | Stack Traces in Server Logs | http/errors.ts |
| LOW-3 | Low | Content-Disposition Header Injection | routes/attachments.ts |
| LOW-4 | Low | No Pagination (DoS via N+1) | routes/grievances.ts |
| LOW-5 | Low | Uploaded Files Served Inline Same Origin | routes/attachments.ts |
| LOW-6 | Low | SQLite DB World-Readable Permissions | db/connection.ts |
| LOW-7 | Low | No Audit Trail for Status Changes | routes/grievances.ts |

---

## Categories with No Issues Found ✅

- **SQL Injection:** All DB queries use `better-sqlite3` prepared statements with `?` placeholders. No string concatenation in queries. ✅
- **Command Injection:** No use of `exec`, `eval`, `os.system`, `child_process` with user input. ✅
- **SSTI:** No server-side template rendering. ✅
- **XSS (direct):** Svelte's template system HTML-escapes by default; no `@html` directives found in reviewed files. ✅
- **Hardcoded secrets in env:** `.env` is gitignored; no API keys or secrets committed. ✅
- **Docker misconfig:** No Docker files present. N/A.
- **Path traversal (read):** `readStoredFile` has a solid canonicalization check. ✅ (Write path is still an issue — HIGH-6)
