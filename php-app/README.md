# PHP runtime scaffold (ParsPack)

This is the first isolated PHP runtime scaffold. It does not replace the current Next.js production app.

## Requirements
- PHP 8.1+
- PDO and pdo_mysql
- mbstring
- MySQL 8.0.16+ or MariaDB 10.6+
- Apache with rewrite support (optional for the health endpoint)

## Local setup
1. Copy `config/config.example.php` to `config/config.local.php`.
2. Enter the dedicated MySQL database credentials in that local file.
3. Run `../database/migrations/001_initial_schema.sql` against the empty database.
4. Set the subdomain document root to this directory's `public/` folder.
5. Open `/health`; a successful response reports PHP runtime and database connectivity.

## Security notes
- Never put `config.local.php` inside the public document root.
- Do not commit real secrets.
- HTTPS is required for secure session cookies.
- Authentication, CSRF protection, authorization policies, rate limiting and audit logging must be implemented before user-facing routes are added.
- The health endpoint exposes only a generic status; detailed exceptions go to the server error log.
- Do not point Production traffic at this scaffold yet.
