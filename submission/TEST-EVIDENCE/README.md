# TEST-EVIDENCE — HostelGrievance Security Verification

This directory contains evidence for all security claims made in HARDENING.md, SECURITY.md, and THREAT-MODEL.md.

## Structure

- README.md — this file
- commands.txt — reproducible curl/PowerShell commands
- vitest-output.txt — full npm test output (28/28 passing)
- authorization/ — IDOR, RBAC, privilege escalation test results
- authentication/ — login, brute-force, session test results
- registration/ — role elevation, warden invite code test results
- uploads/ — MIME validation, size limit, path traversal test results

## How to Reproduce

Prerequisites: Node.js >= 18, npm

1. Install: npm install --engine-strict=false
2. Create .env: WARDEN_INVITE_CODE=GIETWarden2024SecureKey
3. Run tests: npm test
4. Start API: npm run dev:api
5. Run manual commands from commands.txt

## Test Suite

28 automated integration tests in src/server/app.test.ts covering:
- Authentication (login, logout, session)
- Brute-force lockout
- Registration (student, warden, role elevation)
- RBAC (student vs warden access)
- IDOR (cross-student grievance access)
- Upload validation (MIME, size)
- Security headers and cookie flags
