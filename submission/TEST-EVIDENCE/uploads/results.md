# Upload Security Test Results
Date: 2026-08-29

## Test UP-01: Valid image upload (JPEG)

Command: POST /api/grievances (multipart) with valid JPEG file
Expected: 201, attachment created
Observed: 201 (verified via npm test — upload tests)
Result: PASS

## Test UP-02: Invalid MIME type — text file rejected

Command: POST /api/grievances (multipart) with text/plain file
Expected: 400 (magic-byte detection rejects non-image)
Observed: 400 (verified via npm test — MIME validation test)
Source: storage/attachments.ts lines 62–67: fileTypeFromBuffer() validates magic bytes
Result: PASS

## Test UP-03: File too large — rejected

Command: POST /api/grievances (multipart) with file > 2MB
Expected: 400 (Attachment must be 2 MB or smaller)
Observed: 400 (verified via npm test)
Source: config.ts MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024
Result: PASS

## Test UP-04: Path traversal in filename — blocked

Attack: Upload file with name "../../etc/passwd"
Defense: Original filename stored in DB only (for display); disk filename is randomBytes(16).hex + extension
         readStoredFile() additionally validates resolved path stays inside uploadsDir
Observed: Traversal impossible — disk filename never includes original name
Source: storage/attachments.ts lines 37–38 (newStoredName), lines 80–92 (readStoredFile)
Result: PASS (by design — filename never reaches filesystem)

## Test UP-05: Download without authorization — blocked

Command: GET /api/attachments/:id as student who does not own the parent grievance
Expected: 403 Forbidden
Observed: 403 (verified via npm test — attachment authorization test)
Source: routes/attachments.ts calls assertCanViewGrievance before readStoredFile
Result: PASS
