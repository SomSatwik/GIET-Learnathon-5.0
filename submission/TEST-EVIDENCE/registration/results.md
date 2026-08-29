# Registration Test Results
Date: 2026-08-29

## Test REG-01: Student registration — role forced server-side

Command:
  POST /api/register {name:"Attacker",email:"attacker@test.com",password:"Attack1234",
                     confirmPassword:"Attack1234",room:"X-1",role:"warden"}

Expected: 201, response.user.role === "student" (client-supplied role ignored)
Observed: 201, role=student (verified via npm test — test C: "role elevation via student registration")
Source: auth.ts line 174: createUser(db, { id, name, email, passwordHash, role: 'student', room })
Result: PASS

## Test REG-02: Warden registration — wrong invite code

Command:
  POST /api/register/warden {name:"Evil",email:"evil@test.com",password:"Evil1234",
                              confirmPassword:"Evil1234",inviteCode:"wrongcode"}

Expected: 403 Forbidden
Observed: 403 (verified via npm test — warden registration blocked without valid code)
Result: PASS

## Test REG-03: Warden registration — correct invite code

Command:
  POST /api/register/warden {name:"NewWarden",email:"newwarden@giet.edu",password:"Warden1234",
                              confirmPassword:"Warden1234",inviteCode:"GIETWarden2024SecureKey"}

Expected: 201, response.user.role === "warden"
Observed: 201, role=warden (verified via npm test)
Source: auth.ts line 238: createUser(db, { id, name, email, passwordHash, role: 'warden', room: null })
Result: PASS

## Test REG-04: Duplicate email

Command:
  POST /api/register {email:"student@example.test",...}

Expected: 409 Conflict
Observed: 409 (verified via npm test — duplicate email test)
Result: PASS

## Test REG-05: Short password rejected

Command:
  POST /api/register {password:"short",...}

Expected: 400 (password must be at least 8 characters)
Observed: 400 (verified via npm test)
Result: PASS

## Test REG-06: Mismatched password confirmation

Command:
  POST /api/register {password:"Password1",confirmPassword:"Different1",...}

Expected: 400 (passwords do not match)
Observed: 400 (verified via npm test)
Result: PASS
