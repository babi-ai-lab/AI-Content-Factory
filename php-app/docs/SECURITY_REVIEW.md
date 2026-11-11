# Security review — ParsPack PHP application

Date: 2026-11-11
Branch: parspack-php-migration
Pull request: #149

## Scope

This is a focused source-code hardening pass for the PHP application deployed under app.eltbabak.ir. It does not modify the main eltbabak.ir website, production database contents, private local configuration, or hosting account settings.

## Changes in this pass

- Session cookies now follow the private session_secure setting directly instead of silently disabling the Secure attribute when PHP cannot detect HTTPS behind a proxy. Production configuration must keep this setting enabled and serve the app over HTTPS.
- Added HSTS (one year; no includeSubDomains) and browser security headers for static pages in .htaccess.
- Added matching response headers in the PHP bootstrap for application/API responses.
- State-changing requests now require an exact configured Origin. If Origin is absent, the application derives the origin from Referer; if neither is available or the result is not allowlisted, the request is rejected. CSRF token verification remains mandatory.

## Existing controls reviewed

- PDO prepared statements and exception mode.
- Password hashing and verification through PHP password APIs.
- Strict session mode, HttpOnly and SameSite cookie settings.
- Database-backed session validation and logout invalidation.
- CSRF token validation for state-changing API operations.
- Owner-scoped queries for brands, campaigns and content.
- Login rate limit: 8 requests per IP per 15-minute fixed window.
- Generic client-facing 500 response with private server-side diagnostic logging.

## Known limitations / follow-up work

- Login throttling is IP-based only; account-aware and distributed-abuse controls are not implemented.
- Expired rate-limit bucket rows have an expiry timestamp, but automated pruning is not yet implemented.
- Content Security Policy is not enabled because the current management pages use inline JavaScript and CSS; first inventory and test a nonce/hash-based policy before enforcing CSP.
- No independent penetration test, full server configuration audit, or vulnerability scan has been performed.
- Security headers and cookie attributes must be verified on the live host after deployment; source changes and CI lint do not prove host behavior.
- Clear the one-time first_admin_setup_token value from the private local configuration after initial admin creation. Never copy it into Git or support messages.

## Validation status

- Source changes are covered by the repository PHP 8.5 syntax workflow.
- Live functional smoke tests were reported successful by the site owner before this hardening pass.
- The new cookie, Origin/Referer and response-header behavior still requires a post-deployment browser/network check.
- This document is not a security certification or a claim that the application is fully production-hardened.
