# Authentication Test Results
Date: 2026-08-29

## Test AUTH-01: Valid login

Command: POST /api/login {email:"student@example.test",password:"student123"}
Expected: 200, Set-Cookie hg_session; HttpOnly; SameSite=Lax
Observed: 200 (verified via npm test, test "login returns session cookie")
Cookie flags verified: HttpOnly=true, SameSite=Lax (npm test, test L)
Result: PASS

## Test AUTH-02: Invalid password

Command: POST /api/login {email:"student@example.test",password:"wrongpassword"}
Expected: 401, {error:"Invalid email or password."}
Observed: 401 (verified via npm test)
Result: PASS

## Test AUTH-03: Invalid email

Command: POST /api/login {email:"nobody@example.com",password:"anything"}
Expected: 401, {error:"Invalid email or password."} — same message as wrong password (no user enumeration)
Observed: 401 (verified via npm test)
Result: PASS

## Test AUTH-04: Brute-force lockout

Command: 5x POST /api/login with wrong password for same email
Expected: First 4 = 401, 5th attempt = 429 with Retry-After header
Observed: 429 with Retry-After after 5 failures (verified via npm test — brute-force test)
Lockout duration: 15 minutes (LOGIN_LOCKOUT_MS = 15 * 60 * 1000 in config.ts)
Result: PASS

## Test AUTH-05: Logout destroys server-side session

Command:
  POST /api/login → get cookie
  POST /api/logout with cookie
  GET  /api/me with same cookie

Expected: 401 after logout (session destroyed)
Observed: 401 (verified via npm test — logout test)
Result: PASS

## Test AUTH-06: Session cookie flags

Verified in npm test:
  - HttpOnly: true — JS cannot read token
  - SameSite: Lax — CSRF protection
  - maxAge: 604800 — 7-day expiry
  - secure: true in production (NODE_ENV check in session.ts line 62)
Result: PASS

## Visual Verification Artifacts

- **Login Page Interface:** `../screenshots/04_login_page_credentials.jpg`  
  *Demonstrates university authentication interface with role separation.*
- **Session Cookie Flags in Browser DevTools:** `../screenshots/02_session_cookie_httponly_samesite.jpg`  
  *Shows `hg_session` cookie in Network response headers with `HttpOnly` flag, `SameSite=Lax`, and active session state.*
