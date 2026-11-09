# Migration map: Next.js/Supabase to ParsPack PHP/MySQL

## Product contract

The production target is the existing ParsPack cPanel account and the subdomain
`app.eltbabak.ir`. The existing WordPress site at `eltbabak.ir` must remain
untouched. The PHP application owns its own database and private file storage.
No Node.js process, VPS, WordPress runtime, Supabase service, or third-party
database is part of the target runtime.

The only planned external runtime calls are inference/provider calls required to
generate AI text or images. These are not application hosting or data storage.
If the owner later requires zero external AI inference too, the current shared
hosting resources cannot realistically host a modern generative model.

## Feature inventory from the current product

| Area | Current implementation | PHP migration target | Release rule |
|---|---|---|---|
| Public landing page | Next.js/React | PHP-rendered responsive page | Keep Persian RTL and existing product positioning |
| Registration/login | Supabase Auth | Local users, password hashes, secure PHP sessions, email verification and reset tokens | Must pass two-user isolation tests |
| Business profiles | Supabase user metadata | `brand_profiles` table with JSON profile data | Preserve up to 10 profiles and verified facts |
| Text generation | Next API + connected text model | PHP service adapter + provider API | Do not return fabricated success on provider failure |
| History | PostgreSQL `content_history` | MySQL `content_history` | Preserve search, folders, tags, favorites, review states and pagination |
| Version history | PostgreSQL `content_versions` | MySQL `content_versions` | Preserve snapshots, compare and restore |
| Quality controls | Existing JS domain modules | Ported PHP domain rules and regression fixtures | Match current business/channel/template rules |
| Calendar | Client-side Jalali calendar | PHP API + browser UI | Manual scheduling only; no auto-publishing claim |
| Campaigns | PostgreSQL campaign tables | MySQL campaign tables | Preserve checklist, content links and manual metrics |
| Analytics | PostgreSQL RPCs | MySQL queries/aggregates | Validate against fixture data |
| AI usage | PostgreSQL usage ledger | MySQL `ai_usage_events` | Record only successful provider responses |
| Image generation | Next API + Cloudflare/Gemini + private Supabase Storage | PHP provider adapter + private local files | Enforce MIME, size, ownership and quotas |
| Instagram | Experimental API; UI disabled | Not in initial migration | Do not expose until separate end-to-end approval |
| Payments/subscriptions | Not implemented in current product | Later phase | Do not activate or invent pricing without owner approval |
| Android/PWA | Existing PWA/Android TWA assets | Re-evaluate after stable PHP frontend | Rebuild manifest/service worker against final URL |

## Hosting constraints to verify

The previous cPanel inspection reported PHP 8.1.34 and confirmed `pdo`,
`pdo_mysql`, `mbstring`, and `fileinfo`. It did not show `curl`,
`openssl`, or `tokenizer`. This is not enough to declare provider connectivity
ready. Before enabling AI generation, verify:
- PHP version is at least 8.1;
- PDO MySQL is enabled;
- outbound HTTPS works from PHP (OpenSSL or another supported TLS transport);
- `allow_url_fopen` or cURL is available for outbound provider requests;
- upload limits and execution time are adequate for image processing.

A shared hosting account with about 1 GB RAM is not a realistic host for local
LLM or image-model inference. AI inference remains an external provider call
unless the hosting plan or inference architecture changes.

## Migration phases

1. **Foundation (in progress):** private config, PDO, front controller, health
   endpoint, initial MySQL schema, PHP lint workflow and hosting diagnostics.
2. **Authentication and account lifecycle (in progress):** CSRF/session foundations,
   registration, explicit email verification, login/logout and password-reset token
   endpoints are drafted; browser UI, delivery verification, account export/deletion,
   password-change UI and two-user isolation tests remain.
3. **Core content (in progress):** the PHP text-generation adapter, input validation,
   business prompts, output validation, consent gate and per-user rate limit are drafted.
   User-scoped history CRUD, cursor pagination, search, version snapshots and restore
   endpoints are drafted; review workflow, advanced filters, export and UI integration remain.
4. **Brand and quality:** profile CRUD, verified facts, FAQ, forbidden claims,
   quality checks and parity tests against existing fixtures.
5. **Campaigns and calendar:** campaign CRUD, linked content, checklist, metrics,
   analytics, Jalali calendar and ICS export.
6. **Media:** private local storage, upload/download/delete, signed or
   session-authorized delivery, image generation, quota and cleanup.
7. **Release hardening:** browser tests, accessibility, rate limiting, backups,
   restore drill, security review, load test and cutover package.

## Cutover safety

- Keep the current `main` branch and current production app unchanged.
- Do not import the MySQL schema into the WordPress database.
- Do not copy production users or content until an explicit data migration and
  backup/restore test exists.
- Do not move DNS or replace the current subdomain until the PHP release passes
  the acceptance checklist.
- Do not commit `config.php`, provider keys, database passwords, OAuth tokens,
  or user data.
