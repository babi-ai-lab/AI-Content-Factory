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

The first migration slice establishes:
- a private configuration boundary;
- PDO connection with safe error handling;
- a front controller and JSON health endpoint;
- an initial MySQL schema for users, brand profiles, content, versions,
  campaigns, usage events, and local media metadata.

The full product migration is still required: account registration/login/recovery,
all content-generation and media endpoints, history editing/search/export,
analytics, calendar, campaign workflows, local file handling, quotas/rate limits,
and admin operations. Instagram publishing is intentionally excluded from the
first release because the current product roadmap marks it inactive.

## Local checks

Run PHP syntax checks from this directory:

```sh
find app public bin -name '*.php' -print0 | xargs -0 -n1 php -l
php -l config.example.php
```

## cPanel installation (later, after the migration passes tests)

1. Create a MySQL database and database user in cPanel.
2. Copy `config.example.php` to `config.php` and fill in the database values.
3. Upload this directory to the subdomain document root, keeping `app/`,
   `database/`, and `config.php` outside the public web root where possible.
4. Point the subdomain document root at `public/` if cPanel allows it.
5. Import `database/schema.mysql.sql`.
6. Enable HTTPS and verify `/api/health`.

Do not upload a real `config.php` to GitHub. Do not send database passwords or API
keys in chat. The installation instructions will be finalized after the app has
been migrated and tested against the actual hosting limits.
