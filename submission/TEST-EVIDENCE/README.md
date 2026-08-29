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
- screenshots/ — visual verification test evidence & screenshots

## Visual Evidence / Screenshots

| Screenshot | Description | Verification Area |
|------------|-------------|-------------------|
| `screenshots/01_npm_test_28_passed.jpg` | Complete test suite execution passing 28/28 security tests (baseline + RBAC suites) | Test Automation |
| `screenshots/02_session_cookie_httponly_samesite.jpg` | Browser DevTools showing authenticated student session with `HttpOnly`, `SameSite=Lax`, and 7-day expiration | Authentication & Cookies |
| `screenshots/03_grievance_status_rbac_student_view.jpg` | Student view showing RBAC status enforcement ("Only warden can change status") & attachment handling | Authorization & RBAC |
| `screenshots/04_login_page_credentials.jpg` | Login interface showing university account authentication form | Authentication |
| `screenshots/05_initial_failed_tests_reproduction.jpg` | Pre-remediation / initial vulnerability reproduction test run (14 failures prior to hardening) | Vulnerability Verification |

## How to Reproduce

Prerequisites: Node.js >= 18, npm

1. Install: `npm install --engine-strict=false`
2. Create `.env`: `WARDEN_INVITE_CODE=GIETWarden2024SecureKey`
3. Run tests: `npm test`
4. Start API: `npm run dev:api`
5. Run manual commands from `commands.txt`

## Test Suite

28 automated integration tests in `src/server/app.test.ts` covering:
- Authentication (login, logout, session)
- Brute-force lockout
- Registration (student, warden, role elevation)
- RBAC (student vs warden access)
- IDOR (cross-student grievance access)
- Upload validation (MIME, size)
- Security headers and cookie flags

