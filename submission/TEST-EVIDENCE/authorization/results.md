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

## Visual Verification Artifacts

- **Student Grievance View & Status RBAC UI Guard:** `../screenshots/03_grievance_status_rbac_student_view.jpg`  
  *Demonstrates student inspecting grievance `GRV-0002` ("Corridor tube lights not working") where status is displayed as "In Progress" with the server-enforced RBAC restriction: "Only the warden can change the status of a grievance. You will see updates here." Also verifies attachment display (`corridor-light-off.png`).*
- **Cross-Student IDOR Attempt Blocked (UI):** `../screenshots/07_idor_blocked_cross_student_grievance.jpg`  
  *Demonstrates Student Priya Nair attempting to access Aarav's grievance `GRV-0002` via direct URL `/student/grievances/GRV-0002`. The API rejects the request with HTTP 403, and the frontend safely displays "Grievance not found. This grievance does not exist or may have been removed." without leaking any grievance metadata or server internals.*
