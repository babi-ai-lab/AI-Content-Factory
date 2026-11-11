# ParsPack PHP Migration Plan

## Objective

Move the application runtime, business logic, authentication, persistence, billing, and file handling to the existing ParsPack cPanel hosting account. Do not deploy the application runtime to Render, Vercel, or another hosting provider. Do not use Supabase Auth, Supabase Database, Supabase Storage, or Supabase Edge Functions in the target architecture.

The existing Next.js/Supabase application remains the reference implementation during migration. Do not remove or overwrite it until the PHP replacement has passed acceptance tests and a verified backup/rollback procedure exists.

## Hosting constraints known so far

- Existing hosting is cPanel shared hosting on ParsPack.
- Node.js application support was not present in cPanel.
- PHP extensions previously confirmed available: PDO, PDO_MySQL, mbstring, fileinfo.
- PHP version previously observed: 8.1.34. Confirm the active version and required extensions before implementation.
- No hosting upgrade or VPS purchase is permitted.
- Confirm cPanel Cron Jobs, outbound HTTPS/cURL, upload limits, memory limit, execution time, and MySQL version before enabling scheduled jobs or AI integrations.

## Target architecture

- PHP 8.1-compatible application, using a small Composer-based structure where Composer is available; otherwise provide a reproducible vendor deployment package.
- MySQL on the same ParsPack account.
- Server-rendered public pages and a responsive authenticated dashboard.
- PDO with prepared statements; database migrations versioned in the repository.
- Password hashing with password_hash/password_verify; secure session cookies, CSRF protection, rate limiting, and server-side authorization.
- Local file storage outside the public web root where cPanel layout permits; controlled download endpoints.
- cPanel Cron Jobs for scheduled cleanup, email queue processing, and subscription reminders where available.
- Payment gateway integration through server-side signed callbacks and idempotent transaction processing.
- AI generation provider integration only through server-side PHP adapters and environment/config secrets. Never expose provider keys in browser code. Actual model inference cannot realistically run on ordinary shared hosting; if the requirement means no external AI inference API whatsoever, text/image generation must be limited to locally available deterministic templates unless the host explicitly provides an inference runtime.

## Migration principles

1. Preserve existing features by mapping them to PHP modules before implementation.
2. Do not migrate or copy Supabase data until schema mapping, export, and restore tests are complete.
3. Never store plaintext passwords, payment card data, provider secrets, or gateway secrets in source control.
4. All credit debits and payment fulfillment must be transactional and idempotent.
5. Keep the old production deployment untouched until the replacement is accepted.
6. Do not change DNS or the live app subdomain during development.
7. Build and test on a staging directory/subdomain on the same ParsPack account before cutover.

## Feature migration checklist

- [ ] Public product landing page and Persian RTL UI
- [ ] Registration, login, email verification, password reset
- [ ] Account deletion and user data export
- [ ] User profile and multiple brand profiles
- [ ] Text content generation workflows
- [ ] Image generation workflow and private media library
- [ ] Content history, versions, folders, tags, favorites
- [ ] Content quality checks and brand knowledge
- [ ] Campaign manager and analytics
- [ ] Persian content calendar and ICS export
- [ ] Usage metering and atomic quotas
- [ ] Credit wallet, packages, subscriptions, invoices
- [ ] Iranian payment gateway and verified callbacks
- [ ] Admin dashboard, audit logs, support queue
- [ ] Backup, restore, monitoring, and operational runbook

## Required host verification before coding the runtime

- [ ] Active PHP version (prefer 8.2+ if already available; do not assume an upgrade)
- [ ] PDO, pdo_mysql, mbstring, fileinfo, openssl, curl, json, tokenizer
- [ ] MySQL/MariaDB version and database limits
- [ ] Composer availability or approved offline vendor packaging
- [ ] Cron Jobs availability
- [ ] Outbound HTTPS requests allowed
- [ ] PHP memory_limit, max_execution_time, post_max_size, upload_max_filesize
- [ ] Document root and ability to keep secrets/storage outside public_html

## Deployment and rollback

Deploy to a staging path first. Run migrations against a new database, import only verified exports, run functional/security tests, and verify backups can be restored. Keep the existing live app and DNS unchanged until explicit acceptance. Cutover requires a maintenance window and a tested rollback to the old deployment.
