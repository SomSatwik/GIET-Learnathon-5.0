# Authorization Test Results
Date: 2026-08-29

## Test A-01: IDOR — Student accesses another student's grievance

Setup:
  Student Aarav (stu-1) owns GRV-0001, GRV-0002.
  Student Priya (stu-2) owns GRV-0003.

Command:
  POST /api/login {email:"student@example.test",password:"student123"} → 200, cookie set
  GET  /api/grievances/GRV-0003 with Aarav's cookie

Expected: 403 Forbidden
Observed: 403 Forbidden (verified via npm test, test "student cannot view another student's grievance")
Result: PASS

## Test A-02: Student attempts status change

Command:
  PATCH /api/grievances/GRV-0001 with Aarav's cookie, body: {status:"resolved"}

Expected: 403 Forbidden
Observed: 403 Forbidden (verified via npm test, test "student cannot change grievance status")
Result: PASS

## Test A-03: Warden can view all grievances

Command:
  POST /api/login {email:"warden@example.test",password:"warden123"} → 200, cookie set
  GET  /api/grievances with warden cookie

Expected: all grievances returned (8 seeded)
Observed: 8 grievances (verified via npm test, test "warden can list all grievances")
Result: PASS

## Test A-04: Warden cannot edit grievance content

Command:
  PATCH /api/grievances/GRV-0001 with warden cookie, body: {title:"Changed"}

Expected: 403 Forbidden
Observed: 403 Forbidden (verified via npm test)
Result: PASS

## Test A-05: Unauthenticated access blocked

Command:
  GET /api/grievances (no cookie)

Expected: 401 Unauthorized
Observed: 401 Unauthorized (verified via npm test)
Result: PASS

## Test A-06: Student cannot POST comment on another student's grievance

Command:
  POST /api/grievances/GRV-0003/comments with Aarav's cookie, body: {body:"injected comment"}

Expected: 403 Forbidden
Observed: 403 Forbidden (verified via npm test — added test "student cannot comment on another's grievance")
Result: PASS
