# ParsPack handoff checklist

This is the owner-only checklist for the eventual cutover. Do not perform these steps until the migration branch passes all release checks and a tested package is prepared.

## 1. Create an isolated app document root

1. In cPanel, open **Domains**.
2. Add or edit the subdomain `app.eltbabak.ir`.
3. Set its document root to a dedicated folder such as `public_html/aicf/public`.
4. Keep the existing `eltbabak.ir` WordPress document root unchanged.

The PHP package root must be the parent folder `public_html/aicf`; the `app`, `database`, `storage`, and `config.php` paths must remain outside the public document root.

## 2. Create the local database

1. Open **MySQL Databases** in cPanel.
2. Create a dedicated database and database user.
3. Assign the user all privileges on that database.
4. Open **phpMyAdmin**, select the new database, and import `database/schema.mysql.sql`.

Do not reuse the WordPress database or its database user.

## 3. Confirm PHP runtime capabilities

Use PHP 8.1 or newer. In **Select PHP Version** or **MultiPHP INI Editor**, confirm:

- Required: `pdo_mysql`, `mbstring`, `fileinfo`.
- Outbound HTTPS: enable **cURL**, or enable **OpenSSL** together with `allow_url_fopen`.
- `max_execution_time`: at least 120 seconds for image-generation requests.
- `memory_limit`: at least 128 MB.
- `upload_max_filesize`: at least 10 MB.
- `post_max_size`: at least 16 MB.
- PHP `mail()` must be enabled for registration and password recovery emails.

If cURL and OpenSSL are both absent from the extension list, contact ParsPack support and ask them to enable at least one for the PHP version assigned to `app.eltbabak.ir`. Do not purchase a VPS or upgrade the hosting plan.

## 4. Configure email and AI providers

1. Create a sender mailbox such as `no-reply@eltbabak.ir`.
2. Configure SPF/DKIM/DMARC and verify mail delivery.
3. Copy `config.example.php` to `config.php` in the package root.
4. Enter the new MySQL credentials.
5. Enter the Gemini API key for text generation.
6. Enter the Cloudflare account ID and AI API token for image generation, or set the image provider to Gemini and use the Gemini key.
7. Keep `config.php` private; never send credentials in chat or commit them to GitHub.

## 5. Verify before opening to customers

1. Enable SSL for `app.eltbabak.ir`.
2. Check `/api/health` returns a successful database connection.
3. Run `php bin/check-hosting.php` through cPanel Terminal if available.
4. Test registration, email verification, login/logout and password recovery.
5. Test text and image generation, history, brand profiles, campaign operations, calendar and private image delivery.
6. Test two separate accounts to verify that neither can read or change the other's data.
7. Verify backup and restore before accepting paid customers.

## Owner actions are intentionally deferred

No database credentials, API keys, email passwords or cPanel passwords are required until the package is ready. The developer work should finish first; then follow this checklist one step at a time.
