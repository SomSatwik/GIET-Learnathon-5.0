# THREAT MODEL — HostelGrievance
Methodology: STRIDE (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege)

---

## 1. Scope

This threat model covers the HostelGrievance application as deployed in this repository:
- Hono HTTP API server (Node.js, port 3001)
- SvelteKit client-side rendered frontend (port 5173 dev / static in production)
- SQLite database (better-sqlite3, local file)
- Local filesystem upload directory
- All authentication, authorization, grievance, comment, and attachment functionality

---

## 2. System Overview

HostelGrievance allows hostel students to file, track, and discuss maintenance/grievance issues. Wardens review and update grievance statuses. Students upload photo evidence as attachments. All API communication is JSON over HTTP. Authentication uses server-side sessions with HttpOnly cookies. No third-party services or external APIs are used.

---

## 3. Assets

| Asset | Sensitivity | Location |
|-------|------------|----------|
| User passwords | Critical | SQLite DB (Argon2id hashes) |
| Session tokens | Critical | SQLite sessions table + browser cookie |
| Student personal info (name, email, room) | High | SQLite users table |
| Grievance content | High | SQLite grievances table |
| Grievance comments | Medium | SQLite comments table |
| Uploaded attachments (photos) | Medium | Filesystem (uploads/) |
| WARDEN_INVITE_CODE | High | Server environment variable |
| SQLite database file | Critical | Local filesystem |
| Application source code | Medium | Repository |

---

## 4. Actors

| Actor | Trust Level | Description |
|-------|------------|-------------|
| Unauthenticated user | None | Can access /login, /register, /api/register only |
| Registered student | Low | Authenticated; accesses own grievances only |
| Registered warden | Medium | Authenticated; views all grievances; changes status |
| Malicious student | Hostile | Authenticated student attempting to access unauthorized data |
| External attacker | Hostile | Unauthenticated; attempting authentication bypass or DoS |
| Application operator | Trusted | Manages deployment, sets environment variables |

---

## 5. Trust Boundaries

`
Browser (untrusted)
  |  HTTPS (deployment-provided) / HTTP (development)
  v
Hono API Server (port 3001)
  |  IP-based rate limiting (hono-rate-limiter)
  |  CORS allowlist enforcement
  |  Session cookie validation (HttpOnly, DB-backed)
  v
Authentication Layer (requireUser)
  |  Session token → DB lookup → expiry check
  v
Authorization Layer (assertCanViewGrievance, role checks)
  |  Role-based (student/warden) + object-level (student_id ownership)
  v
SQLite Database (better-sqlite3)
  |  Parameterized queries only; no raw string interpolation
  v
Filesystem (uploads/)
  |  Random stored filenames; path-traversal validation
`

---

## 6. Data Flows

### Registration
Browser → POST /api/register → parseRegisterBody (validation) → hashPassword (Argon2id) → INSERT users (role='student' forced) → createSession → Set-Cookie hg_session → 201 response

### Login
Browser → POST /api/login → IP lockout check → findUserByEmail → verifyPassword → recordSuccess → destroyPriorSessions → createSession → Set-Cookie → 200 response

### Session validation (every protected request)
Cookie hg_session → getCookie → readSessionUser (DB JOIN sessions+users, expiry check) → returns SessionUser or throws 401

### Grievance creation
Student → POST /api/grievances (multipart or JSON) → requireUser → role check (student only) → validate title/description/category → INSERT grievances → optional: bufferFromUpload → magic-byte check → newStoredName → writeStoredFile → INSERT attachments → 201

### Grievance viewing
Any authenticated user → GET /api/grievances/:id → requireUser → requireGrievance → assertCanViewGrievance → 200 or 403

### Comment posting
Authenticated user → POST /api/grievances/:id/comments → requireUser → requireGrievance → assertCanViewGrievance → validate body → INSERT comments → 201

### Attachment download
Authenticated user → GET /api/attachments/:id → requireUser → DB lookup attachment → DB lookup grievance → assertCanViewGrievance → readStoredFile (path validation) → binary response

### Warden status update
Warden → PATCH /api/grievances/:id → requireUser → requireGrievance → role=warden branch → validate status → UPDATE grievances → INSERT status_changes (audit trail) → 200

---

## 7. Authentication Boundaries

| Endpoint | Auth Required | Notes |
|----------|--------------|-------|
| POST /api/login | No | Rate-limited by IP |
| POST /api/register | No | Public; role forced server-side |
| POST /api/register/warden | No | Requires WARDEN_INVITE_CODE |
| GET /api/me | Yes | Returns current session user |
| POST /api/logout | No (degrades gracefully) | Clears cookie and DB session |
| GET /api/grievances | Yes | Student=own; warden=all |
| POST /api/grievances | Yes (student only) | |
| GET /api/grievances/:id | Yes | Ownership check |
| PATCH /api/grievances/:id | Yes | Role-split logic |
| GET /api/grievances/:id/comments | Yes | Ownership check |
| POST /api/grievances/:id/comments | Yes | Ownership check |
| GET /api/attachments/:id | Yes | Ownership check via parent grievance |

---

## 8. Authorization Boundaries

**Student permissions (role='student'):**
- Create grievances
- Read/update own grievances (cannot change status)
- Read/post comments on own grievances
- Read/upload attachments on own grievances
- No access to any other student's data

**Warden permissions (role='warden'):**
- Read all grievances from all students
- Change grievance status (open/in_progress/resolved)
- Read/post comments on any grievance
- Cannot edit grievance content (title, description, category)
- Cannot add attachments to grievances

**Object-level check (assertCanViewGrievance):**
- warden → PASS always
- student, grievance.student_id === user.id → PASS
- student, grievance.student_id !== user.id → 403
- unknown role → 500

---

## 9. Filesystem / Runtime Boundaries

| Item | Path | Notes |
|------|------|-------|
| Database | data/hostel.db (configurable via HOSTEL_DB_PATH) | Should be outside web root; OS permissions restricted to app user |
| Uploads | uploads/ (configurable via HOSTEL_UPLOADS_DIR) | Must not be web-accessible directly; served only via /api/attachments/:id |
| Stored filenames | [32-hex-chars].[ext] | Never user-controlled; path traversal validation on read and write |
| Application | Node.js process | Should run as non-root user in production |
| SQLite | Single-file; WAL mode | No network access; single-writer concurrency |

---

## 10. Network Assumptions

- **HTTP/HTTPS:** Application listens on plain HTTP (port 3001). TLS is assumed to be terminated by a reverse proxy (Nginx, Caddy) or platform (Railway, Fly.io) in production.
- **CORS:** Allowlist enforced server-side. Non-listed origins cannot make credentialed cross-origin requests.
- **Deployment exposure:** In development, API and frontend are localhost-only. In production, only the frontend should be internet-facing; API may be localhost-only if the reverse proxy proxies /api/*.
- **Reverse proxy assumption:** X-Forwarded-For is used for rate limiting. Without a trusted reverse proxy, this header can be spoofed to bypass IP-based lockouts.

---

## 11. Attack Paths

### A. Account Takeover — Credential Guessing
**Threat:** External attacker guesses weak password via repeated login attempts.
**Mitigation:** 5-failure IP lockout for 15 minutes; Argon2id makes offline cracking expensive.
**Residual:** NAT bypass (shared IP); X-Forwarded-For spoofing without proxy trust.

### B. Account Takeover — Session Theft
**Threat:** XSS or network intercept steals session cookie.
**Mitigation:** HttpOnly (no JS access); SameSite=Lax (CSRF protection); Secure flag in production (HTTPS only); session destroyed on logout.
**Residual:** Secure flag requires correct NODE_ENV; no CSP nonce (unsafe-inline for styles).

### C. Privilege Escalation — Student to Warden (Registration)
**Threat:** Student sends {"role":"warden"} in registration request.
**Mitigation:** /api/register ignores client role field; always inserts 'student'.
**Residual:** None.

### D. Privilege Escalation — Warden Registration Without Authorization
**Threat:** Anyone creates a warden account to gain elevated access.
**Mitigation:** /api/register/warden requires WARDEN_INVITE_CODE validated with timingSafeEqual; disabled (403) if env var not set.
**Residual:** Code leakage risk; no code rotation mechanism.

### E. IDOR/BOLA — Student Accesses Another Student's Grievance
**Threat:** Student changes grievance ID in URL (e.g., GRV-0003 when they own GRV-0001).
**Mitigation:** assertCanViewGrievance() on every grievance-related endpoint; 403 on mismatch.
**Residual:** None for student-to-student; warden has broader access by design.

### F. Attachment Disclosure
**Threat:** Student guesses attachment ID or path to download another student's photo.
**Mitigation:** assertCanViewGrievance() via parent grievance; random hex filenames (not enumerable).
**Residual:** Attachment IDs appear in grievance responses (visible to authorized users of that grievance).

### G. Upload Abuse — Malicious File / Path Traversal
**Threat:** Upload HTML/script disguised as image; upload filename ../../etc/passwd.
**Mitigation:** Magic-byte MIME validation; random stored filenames; path boundary validation.
**Residual:** Client-supplied MIME type stored in DB (not re-read from magic bytes after detection).

### H. DoS — Endpoint Flooding
**Threat:** Repeated requests overwhelm the API or fill the database.
**Mitigation:** 200 req/min global IP rate limit; 2 MB file size limit; 3 MB body cap.
**Residual:** No per-user grievance creation rate limit; X-Forwarded-For spoofable.

### I. Information Disclosure — Error Messages
**Threat:** Server errors expose internal details (paths, DB schema, library versions).
**Mitigation:** handleError() returns only {error, code} JSON; details logged server-side only.
**Residual:** None for API consumers.

### J. SQL Injection
**Threat:** User input in SQL queries causes unauthorized data access or modification.
**Mitigation:** All DB queries use better-sqlite3 prepared statements with parameterized placeholders; no raw string SQL construction from user input.
**Residual:** None identified.

---

## 12. Mitigations Map

| Attack | Primary Control | Secondary Control |
|--------|----------------|-------------------|
| Credential guessing | DB-backed brute-force lockout (H-05) | Argon2id makes offline cracking slow (H-01) |
| Session theft | HttpOnly cookie (H-03) | Server-side session (H-04), SameSite=Lax |
| Privilege escalation (student→warden) | Server-side role assignment (H-16) | Invite code mechanism (H-17) |
| IDOR grievance/comment/attachment | assertCanViewGrievance (H-09) | requireUser (authentication) |
| Unauthorized status change | Role-split PATCH logic (H-10) | requireUser |
| Upload path traversal | Random disk filenames (H-11) | Path boundary validation |
| Malicious file upload | Magic-byte detection (H-12) | Type allowlist |
| DoS via uploads | File size limit (H-13) | Global body limit |
| XSS via script upload | MIME validation (H-12) | CSP (H-07) |
| Clickjacking | X-Frame-Options DENY (H-07) | CSP frame-ancestors |
| CSRF | SameSite=Lax cookie (H-03) | CORS allowlist (H-06) |

---

## 13. Residual Risks

1. TLS not enforced by the application itself — depends on deployment platform.
2. X-Forwarded-For spoofing can bypass IP-based rate limiting and lockout.
3. WARDEN_INVITE_CODE has no expiry or rotation mechanism.
4. No per-user rate limiting for grievance creation.
5. SHA-256 legacy upgrade path still active (historical hash format).
6. Uploaded file MIME type stored from client-supplied value (validated but not re-detected).
7. Comment bodies not HTML-sanitized (risk if rendering ever changes).
8. No audit log for failed authorization attempts (only failed logins are logged).
