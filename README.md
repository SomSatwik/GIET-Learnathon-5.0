# HostelGrievance

University hostel grievance portal — Svelte 5 UI plus a small local Hono + SQLite API. Built as a security-lab baseline, not a production platform.

## Install

```sh
npm install
```

## Database

SQLite lives at `data/hostel.db`. Attachment bytes live in `uploads/`.

```sh
npm run db:reset
```

This recreates the seeded database (3 students, 1 warden, 8 grievances, comments, and sample images).

Run this once after installation, and again whenever you want to return to the original seeded state.

Development logins:

| Role | Email | Password |
| --- | --- | --- |
| Student | `student@example.test` | `student123` |
| Warden | `warden@example.test` | `warden123` |

Additional students (`priya@example.test`, `rohan@example.test`) also use `student123`.

## Run

### Recommended: frontend and API together

From the repository directory, run:

```sh
npm run dev:all
```

This starts both services:

- Frontend: Vite, usually at `http://localhost:5173`
- API: Hono at `http://127.0.0.1:3001`

Open the exact frontend URL printed by Vite. If port `5173` is already in use, Vite will choose another port such as `5174`.

### Alternative: two terminals

If you prefer to run the services separately:

```sh
# Terminal 1 — API
npm run dev:api

# Terminal 2 — frontend
npm run dev
```

Then open the frontend URL printed in Terminal 2.

### Frontend-only mode

```sh
npm run dev
```

This starts only the frontend. Login, grievances, comments, and attachments require the API from `npm run dev:api` to be running as well.

If the browser shows `proxy error`, `ECONNREFUSED 127.0.0.1:3001`, or login requests fail, the API is not running. Stop the frontend with `Ctrl-C` and use `npm run dev:all`, or start the API in a second terminal.

## Check the application

After opening the frontend:

1. Log in with the Student account.
2. Browse the student dashboard and grievance details.
3. Try the create-grievance, comment, and attachment workflows.
4. Log out and log in with the Warden account.
5. Browse the warden dashboard and grievance details.

The challenge focuses on securing the existing application. Do not redesign the UI or change the intended student and warden workflows.

## Check and test

```sh
npm run typecheck
npm test
```

The visible test suite contains baseline behavior checks. Because this repository is intentionally vulnerable, some security assertions may fail before hardening; do not delete or bypass those tests.

The UI talks to the Hono API through `$lib/services` (`credentials: 'include'`). Vite proxies `/api` to port 3001.

The frontend route guard is the authoritative role boundary for navigation; the API handles the data requests behind those routes.

## Security hardening challenge

Treat this repository as an application that must be hardened before public deployment. The goal is to preserve legitimate student and warden workflows while reducing unauthorized access, unsafe input handling, data exposure, and operational blast radius.

You may use any reasonable development or security tools, but findings must be explained and verified. Scanner output by itself is not a submission.

## Submission expectations

Submit a separate package with this structure:

```text
submission/
├── source/
├── deployment/
├── SECURITY.md
├── THREAT-MODEL.md
├── HARDENING.md
└── TEST-EVIDENCE/
```

`HARDENING.md` must contain one concise row per finding using this format:

```text
| ID | Finding | Risk | Change | Verification | Residual Risk |
|----|---------|------|--------|--------------|---------------|
| H-01 | ... | ... | ... | ... | ... |
```

Use your own finding IDs. For each entry, explain what you found, why it matters, what changed, how you verified it, and what risk remains.

`THREAT-MODEL.md` should describe the assets, actors, trust boundaries, authentication and authorization boundaries, data flows, filesystem and runtime boundaries, network assumptions, and important attack paths. Use any clear methodology.

`SECURITY.md` should summarize the protected posture, major changes, remaining risks, deployment assumptions, verification evidence, and the blast radius that remains if one important control fails.

`TEST-EVIDENCE/` should contain commands, test output, screenshots, or short reproducible examples that support the claims. Keep documentation proportional to the security outcome: a finding earns credit when its consequence, remediation, and verification are clear.
