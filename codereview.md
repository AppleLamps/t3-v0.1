# Code Review – LampChat

## Critical

- `src/services/auth.js`: `initialize()` verifies the cookie token but never sets `_token`, so `isLoggedIn()` returns false after refresh and the repository stays in guest/local mode. Authenticated users silently lose access to cloud data and proxy mode. Set `_token` (placeholder) on successful verify and ensure state reinitializes with the Neon repository.
- `api/auth.js`, `api/data.js`: CORS is `Access-Control-Allow-Origin: *` while `Access-Control-Allow-Credentials: true` and cookies are required. Browsers will drop the cookies, breaking login/verify/refresh, and the wildcard is unsafe. Use the request origin (or a configured allowlist), send `Vary: Origin`, and keep credentials true with `SameSite`/`Secure`. Add CSRF protection for cookie-based auth.

## High

- `api/controllers/settings.js`: API keys are stored and returned in plaintext. Persist encrypted at rest (or only server-side), never return the key to the client in authenticated mode, and scrub it from exports/backups.
- `api/controllers/projects.js` (file upload): No validation on file type/size/content; arbitrary base64 blobs can be stored, leading to DB bloat and potential malicious payloads. Enforce max size, allowed MIME types, and strip/scan content; consider offloading to object storage with signed URLs.
- `api/controllers/bulk.js`: Imports run without transactions; partial failures leave inconsistent state. Wrap chat/message imports and settings updates in a transaction or rollback strategy.
- `api/utils/rateLimiter.js`: When Upstash env vars are missing or Redis fails, all requests are allowed. For auth/chat endpoints, fall back to an in-memory limiter or fail closed with clear diagnostics in production.

## Medium

- `api/chat.js`: Proxy path streams external responses without timeout/abort or retry gating; a stalled upstream can hold a serverless execution. Add per-request timeout/abort and surface a clear error to the client.
- `api/auth.js`: Refresh tokens are long-lived cookies without rotation/audit. Consider rotating refresh tokens and revocation/blacklist support; add IP/UA binding metadata.
- `src/services/ChatController.js`: Project file contents are inlined into system prompts without size guard; large or binary data will explode prompt cost. Limit included files, truncate/summarize, and reject non-text types before injecting.

## Quick Wins

- Fix auth token persistence bug to restore Neon/proxy usage for logged-in users.
- Correct CORS/credentials configuration with an allowlist and add CSRF mitigation.
- Encrypt and withhold stored API keys from client responses; rotate existing secrets.
