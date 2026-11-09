# AI Content Factory — ParsPack PHP Migration

This is an isolated PHP/MySQL migration target for the existing Next.js application.
It is intentionally separate from the current production app. Nothing in the existing
Next.js, Render, or Supabase deployment is changed by this directory.

## Hosting target

- ParsPack cPanel shared hosting
- PHP 8.1+
- MySQL/MariaDB with PDO MySQL
- HTTPS enabled for the subdomain `app.eltbabak.ir`
- No Node.js runtime, VPS, WordPress, or external database

## Current status

**Foundation only — not production-ready and not deployable as the complete product yet.**

The first migration slices establish:
- a private configuration boundary;
- PDO connection with safe error handling;
- a front controller and JSON health endpoint;
- an initial MySQL schema for users, brand profiles, content, versions,
  campaigns, usage events, rate limits and local media metadata;
- local account API foundations: CSRF tokens, session hardening, registration,
  explicit email verification, login/logout and password-reset token handling;
- a PHP text-generation endpoint with bounded input, consent gate, per-user quota,
  Gemini fallback model and response validation;
- user-scoped history create/list/update/delete, cursor pagination, search,
  automatic version snapshots and restore endpoints;
- campaign create/list/update/delete, content linking, checklist stages and
  manually entered performance metrics;
- local analytics aggregation for history and AI token usage, plus scheduled-content
  range queries for the calendar;
- image generation through the configured Cloudflare AI provider, private local file
  storage, per-user hourly quota, MIME/size validation and authenticated media delivery;
- brand profile CRUD, default profile selection, a ten-profile cap and server-side
  profile loading during text generation;
- user data export and password-confirmed account deletion with local media cleanup;
- a CLI hosting diagnostics script that reports capabilities without exposing secrets.

The migration is still incomplete and not production-ready. The authentication
API does not yet have its final browser UI, email-delivery setup must be verified,
and the content-generation browser workflow, history export and advanced filters,
brand-profile management, analytics/calendar browser UI and ICS export, media
generation/private file delivery, account export/deletion, and admin operations
still need to be ported and tested. Campaign API endpoints still need browser
integration and full tests. Instagram publishing is intentionally excluded from the
first release because the current product roadmap marks it inactive.

## Local checks

Run PHP syntax checks from this directory:

```sh
find app public bin -name '*.php' -print0 | xargs -0 -n1 php -l
php -l config.example.php
php -l bin/check-hosting.php
```

## cPanel installation (later, after the migration passes tests)

1. Create a MySQL database and database user in cPanel.
2. Copy `config.example.php` to `config.php` and fill in the database values and a real sender email address configured in cPanel.
3. Upload this directory to the subdomain document root, keeping `app/`,
   `database/`, and `config.php` outside the public web root where possible.
4. Point the subdomain document root at `public/` if cPanel allows it.
5. Import `database/schema.mysql.sql`.
6. Enable HTTPS, run `php bin/check-hosting.php` from cPanel Terminal if available, and verify `/api/health`.

Do not upload a real `config.php` to GitHub. Do not send database passwords or API
keys in chat. The installation instructions will be finalized after the app has
been migrated and tested against the actual hosting limits.
