# Deployment Guide — HostelGrievance

## Prerequisites
- Node.js >= 18 (tested on v23.7.0)
- npm >= 9

## Installation
`ash
npm install --engine-strict=false
`

## Environment Variables

Create a .env file (never commit it):

`
# Database path (default: data/hostel.db)
HOSTEL_DB_PATH=

# Upload directory (default: uploads/)
HOSTEL_UPLOADS_DIR=

# API port (default: 3001)
HOSTEL_API_PORT=3001

# REQUIRED for production: warden self-registration invite code
# Use a strong random string (32+ chars, alphanumeric)
WARDEN_INVITE_CODE=

# Set to 'production' to:
# - Skip demo seed (no demo credentials inserted)
# - Enable Secure flag on session cookie
NODE_ENV=production
`

## Database Initialization
The database schema is applied automatically on first startup via pplySchema(db). No manual migration steps needed.

## Seed Behavior
- **Development (NODE_ENV != production):** seedDatabase() inserts demo users/grievances/comments on startup if the DB is empty.
- **Production (NODE_ENV=production):** Seeding is skipped entirely. A warning is logged.

Demo credentials (development only):
| Role | Email | Password |
|------|-------|----------|
| Student | student@example.test | student123 |
| Warden | warden@example.test | warden123 |

**Do NOT use demo credentials in production.**

## Running

### Development (both servers)
`ash
npm run dev:all
`
- Frontend: http://localhost:5173
- API: http://localhost:3001

### Production
`ash
# Build frontend
npm run build

# Start API server
node --env-file=.env --import tsx/esm src/server/index.ts

# Serve frontend build with a static file server or reverse proxy
# Example: serve -s build -l 8080
`

## HTTPS
The application does not terminate TLS. In production, place behind a reverse proxy (Nginx, Caddy) that:
1. Terminates TLS
2. Proxies /api/* to http://127.0.0.1:3001
3. Serves the SvelteKit build for all other paths

## CORS
Update llowedOrigins in src/server/app.ts to include your production domain before building for production.

## Security Tests
`ash
npm test
`
Expected output: 28/28 tests passing

## Warden Account Creation
POST /api/register/warden with:
`json
{
  "name": "Warden Name",
  "email": "warden@your-domain.com",
  "password": "StrongPassword123",
  "confirmPassword": "StrongPassword123",
  "inviteCode": "<WARDEN_INVITE_CODE value>"
}
`
Share the invite code only with trusted administrators.

## Secure Configuration Checklist
- [ ] NODE_ENV=production set
- [ ] WARDEN_INVITE_CODE set to strong random secret
- [ ] .env file not committed to version control
- [ ] HTTPS configured on reverse proxy
- [ ] HOSTEL_DB_PATH outside web root with restricted OS permissions
- [ ] HOSTEL_UPLOADS_DIR not web-accessible directly
- [ ] allowedOrigins in app.ts updated to production domain
- [ ] Application process runs as non-root user
