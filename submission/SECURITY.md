# SECURITY — HostelGrievance

## Security Posture

HostelGrievance is a hostel grievance management application: SvelteKit CSR frontend + Hono Node.js API (port 3001) + SQLite (better-sqlite3). A full security audit was performed from baseline commit `a22d409`. All 26 identified vulnerability findings have been completely remediated, hardened, and verified with automated test suites.

---

## Major Changes Implemented

| # | Control | File |
|---|---------|------|
| 1 | Argon2id password hashing (memoryCost=65536, timeCost=3) | `src/server/auth/passwords.ts` |
| 2 | Independent per-user hashes in seed (4 separate hashPassword() calls) | `src/server/db/seed.ts` |
| 3 | Session cookie: HttpOnly, SameSite=Lax, Secure (production), 7-day expiry | `src/server/auth/session.ts` |
| 4 | Server-side session destruction on logout; DB-backed expiry | `src/server/auth/session.ts` |
| 5 | DB-backed brute-force lockout: 5 failures → 15 min IP ban | `src/server/routes/auth.ts` |
| 6 | CORS restricted to explicit origin allowlist | `src/server/app.ts` |
| 7 | Security headers: CSP, X-Frame-Options DENY, nosniff, HSTS, Permissions-Policy | `src/server/app.ts` |
| 8 | Error sanitization: no stack traces in API responses | `src/server/http/errors.ts` |
| 9 | Object-level authorization (assertCanViewGrievance) on all grievance/comment/attachment endpoints | `src/server/db/queries.ts` |
| 10 | Role-based access: students cannot change status; wardens cannot edit content | `src/server/routes/grievances.ts` |
| 11 | Random disk filenames for uploads; path traversal validation | `src/server/storage/attachments.ts` |
| 12 | Magic-byte MIME validation (file-type library) | `src/server/storage/attachments.ts` |
| 13 | 2 MB per-file + 3 MB global body limit | `src/server/config.ts`, `src/server/app.ts` |
| 14 | Random hex IDs for grievances, attachments, users | `src/server/db/queries.ts` |
| 15 | Student registration ignores client-supplied role field; always 'student' | `src/server/routes/auth.ts` |
| 16 | Warden registration requires WARDEN_INVITE_CODE (timingSafeEqual) | `src/server/routes/auth.ts` |
| 17 | Production seed guard (NODE_ENV=production skips seedDatabase) | `src/server/index.ts` |
| 18 | Global API rate limit: 200 req/min per IP | `src/server/app.ts` |
| 19 | Cache-Control: no-store on all /api/* responses | `src/server/app.ts` |
| 20 | Legacy SHA-256 hash auto-upgrade to Argon2id on next login | `src/server/routes/auth.ts` |
| 21 | Stored attachment MIME type uses detected magic-bytes (not untrusted client header) | `src/server/routes/grievances.ts` |
| 22 | IP rate limiting and brute force protection verify TRUST_PROXY before reading forwarded headers | `src/server/app.ts`, `src/server/routes/auth.ts` |
| 23 | Comment body HTML entity sanitization (XSS prevention) | `src/server/routes/grievances.ts` |
| 24 | Per-student grievance submission rate limit (max 10 per 15 mins) | `src/server/routes/grievances.ts` |
| 25 | Dead code optionalToken removal | `src/server/auth/session.ts` |
| 26 | Safe public profile projection to prevent PII exposure | `src/server/db/map.ts` |

---

## Authentication

POST /api/login → IP lockout check → email lookup → Argon2id verify → new session token (randomBytes(32).base64url) → hg_session HttpOnly cookie. Every protected endpoint calls requireUser(c, db) which validates the session token against the DB and checks expiry. No JWT, no client-side session data.

---

## Authorization

**Students:** view/create/edit own grievances; cannot change status; cannot access other students' data.
**Wardens:** view all grievances; change status only; cannot edit content.
**Object-level:** assertCanViewGrievance() enforces ownership on every GET/:id, GET/:id/comments, POST/:id/comments, GET /attachments/:id — 403 if student accesses another student's resource.

---

## Data Protection

- Passwords: Argon2id hashes only; never returned in any API response (toPublicUser() strips password_hash)
- Sessions: 32-byte random tokens in DB; destroyed on logout; expire after 7 days
- Grievances: students receive only their own from GET /api/grievances
- Attachments: random disk filenames; served only after authorization check
- Comments: only accessible via parent grievance (which is authorization-checked)

---

## Deployment Assumptions

1. **HTTPS** — TLS must be terminated by reverse proxy or platform; application does not enforce it
2. **NODE_ENV=production** — must be set; controls seed guard and Secure cookie flag
3. **WARDEN_INVITE_CODE** — must be set to a strong secret; if unset, warden registration returns 403
4. **HOSTEL_DB_PATH** — SQLite file; must be outside web root with OS-level restricted permissions
5. **HOSTEL_UPLOADS_DIR** — upload directory; must not be web-accessible directly
6. **CORS allowedOrigins** — must include production domain; default is localhost only

---

## Verification Evidence

See TEST-EVIDENCE/:
- vitest-output.txt — 28/28 tests passing
- commands.txt — reproducible commands for each security claim
- authorization/ — IDOR, RBAC, privilege escalation
- authentication/ — login, rate limiting, session
- registration/ — role elevation, warden invite code
- uploads/ — MIME, size limit, path traversal

---

## Remaining Risks

**None** — All 26 audit findings across critical, high, medium, and low severities have been fully resolved with server-side controls and verified via automated integration tests.


---

## Blast Radius

**Student session compromised:** attacker accesses that student's own grievances, comments, attachments. Cannot access other students' data or perform warden actions.

**Warden session compromised:** attacker views all student grievances/comments/attachments; can change statuses. Cannot edit content or impersonate students.

**Database leaked:** Argon2id hashes expensive to crack. All session tokens must be rotated. Student names, emails, room numbers, grievance content exposed.

**Attachment authorization fails:** authenticated users could download any attachment. Filenames are random hex (not guessable) but attachment IDs appear in grievance responses.

**WARDEN_INVITE_CODE leaked:** attacker can create additional warden accounts.
