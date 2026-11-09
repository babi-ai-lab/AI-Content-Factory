<?php
declare(strict_types=1);

function auth_route(string $path, string $method): bool
{
    if ($path === '/api/auth/csrf' && $method === 'GET') {
        json_response(['ok' => true, 'csrfToken' => csrf_token()]);
    }

    if ($path === '/api/auth/verify' && $method === 'GET') {
        auth_verify_email();
        return true;
    }

    if ($path === '/api/auth/me' && $method === 'GET') {
        $userId = require_user_id();
        $stmt = db()->prepare('SELECT id, email, display_name, email_verified_at, created_at FROM users WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $userId]);
        json_response(['ok' => true, 'user' => $stmt->fetch()]);
    }

    if ($path === '/api/auth/register' && $method === 'POST') {
        require_csrf();
        auth_register();
        return true;
    }

    if ($path === '/api/auth/login' && $method === 'POST') {
        require_csrf();
        auth_login();
        return true;
    }

    if ($path === '/api/auth/logout' && $method === 'POST') {
        require_csrf();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', [
                'expires' => time() - 42000,
                'path' => $params['path'],
                'domain' => $params['domain'],
                'secure' => $params['secure'],
                'httponly' => $params['httponly'],
                'samesite' => $params['samesite'] ?? 'Lax',
            ]);
        }
        session_destroy();
        json_response(['ok' => true]);
    }

    if ($path === '/api/auth/password/request' && $method === 'POST') {
        require_csrf();
        auth_request_password_reset();
        return true;
    }

    if ($path === '/api/auth/password/reset' && $method === 'POST') {
        require_csrf();
        auth_reset_password();
        return true;
    }

    return false;
}

function auth_register(): never
{
    enforce_auth_rate_limit('register', 6);
    $body = json_body();
    $email = strtolower(trim((string)($body['email'] ?? '')));
    $name = trim((string)($body['displayName'] ?? ''));
    $password = (string)($body['password'] ?? '');

    if (filter_var($email, FILTER_VALIDATE_EMAIL) === false || strlen($email) > 190) {
        json_response(['ok' => false, 'error' => ['code' => 'EMAIL_INVALID', 'message' => 'آدرس ایمیل معتبر نیست.']], 422);
    }
    if ($name === '' || mb_strlen($name, 'UTF-8') > 120) {
        json_response(['ok' => false, 'error' => ['code' => 'NAME_INVALID', 'message' => 'نام نمایشی را وارد کن.']], 422);
    }
    $passwordError = validate_password_strength($password);
    if ($passwordError !== null) {
        json_response(['ok' => false, 'error' => ['code' => 'PASSWORD_WEAK', 'message' => $passwordError]], 422);
    }

    $from = trim((string)($GLOBALS['config']['mail']['from_email'] ?? ''));
    if ($from === '') {
        json_response(['ok' => false, 'error' => ['code' => 'MAIL_NOT_CONFIGURED', 'message' => 'ارسال ایمیل تأیید هنوز روی سرور تنظیم نشده است.']], 503);
    }

    $check = db()->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $check->execute(['email' => $email]);
    if ($check->fetch()) {
        json_response(['ok' => true, 'message' => 'اگر این ایمیل قابل ثبت‌نام باشد، پیام راهنما برای آن ارسال می‌شود.']);
    }

    $userId = uuid_v4();
    $token = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $token);

    try {
        db()->beginTransaction();
        $insert = db()->prepare(
            "INSERT INTO users (id, email, password_hash, display_name, status)
             VALUES (:id, :email, :password_hash, :display_name, 'pending_verification')"
        );
        $insert->execute([
            'id' => $userId,
            'email' => $email,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'display_name' => $name,
        ]);

        $verify = db()->prepare(
            'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
             VALUES (:user_id, :token_hash, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR))'
        );
        $verify->execute(['user_id' => $userId, 'token_hash' => $tokenHash]);

        $baseUrl = rtrim((string)($GLOBALS['config']['app']['base_url'] ?? ''), '/');
        $link = $baseUrl . '/api/auth/verify?token=' . rawurlencode($token);
        $sent = send_app_email(
            $email,
            'تأیید ایمیل کارخانه هوشمند تولید محتوا',
            "برای فعال‌سازی حساب روی پیوند زیر کلیک کن:\n\n" . $link . "\n\nاین پیوند تا ۲۴ ساعت معتبر است."
        );

        if (!$sent) {
            db()->rollBack();
            json_response(['ok' => false, 'error' => ['code' => 'MAIL_DELIVERY_FAILED', 'message' => 'ارسال ایمیل تأیید انجام نشد. تنظیمات ایمیل هاست باید بررسی شود.']], 503);
        }

        db()->commit();
        json_response(['ok' => true, 'message' => 'پیوند تأیید به ایمیل شما ارسال شد.']);
    } catch (Throwable $error) {
        if (db()->inTransaction()) {
            db()->rollBack();
        }
        error_log('[AI Content Factory] Registration failed: ' . $error->getMessage());
        json_response(['ok' => false, 'error' => ['code' => 'REGISTER_FAILED', 'message' => 'ثبت‌نام انجام نشد. دوباره تلاش کن.']], 500);
    }
}

function auth_verify_email(): never
{
    $token = trim((string)($_GET['token'] ?? ''));
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
        http_response_code(400);
        echo 'پیوند تأیید معتبر نیست.';
        exit;
    }

    $tokenHash = hash('sha256', $token);
    try {
        db()->beginTransaction();
        $stmt = db()->prepare(
            'SELECT user_id FROM email_verification_tokens
             WHERE token_hash = :token_hash AND expires_at > UTC_TIMESTAMP()
             LIMIT 1 FOR UPDATE'
        );
        $stmt->execute(['token_hash' => $tokenHash]);
        $row = $stmt->fetch();

        if (!$row) {
            db()->rollBack();
            http_response_code(400);
            echo 'این پیوند منقضی یا قبلاً استفاده شده است.';
            exit;
        }

        $activate = db()->prepare(
            "UPDATE users SET status = 'active', email_verified_at = UTC_TIMESTAMP()
             WHERE id = :user_id AND status = 'pending_verification'"
        );
        $activate->execute(['user_id' => $row['user_id']]);

        $delete = db()->prepare('DELETE FROM email_verification_tokens WHERE user_id = :user_id');
        $delete->execute(['user_id' => $row['user_id']]);
        db()->commit();

        header('Content-Type: text/html; charset=utf-8');
        echo '<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><title>تأیید ایمیل</title><body><main><h1>ایمیل شما تأیید شد</h1><p>اکنون می‌توانید وارد حساب خود شوید.</p><a href="/">بازگشت به برنامه</a></main></body></html>';
        exit;
    } catch (Throwable $error) {
        if (db()->inTransaction()) {
            db()->rollBack();
        }
        error_log('[AI Content Factory] Email verification failed: ' . $error->getMessage());
        http_response_code(500);
        echo 'تأیید ایمیل انجام نشد. دوباره تلاش کنید.';
        exit;
    }
}

function auth_login(): never
{
    enforce_auth_rate_limit('login', 10);
    $body = json_body();
    $email = strtolower(trim((string)($body['email'] ?? '')));
    $password = (string)($body['password'] ?? '');

    $stmt = db()->prepare('SELECT id, password_hash, status, session_version FROM users WHERE email = :email LIMIT 1');
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, (string)$user['password_hash'])) {
        json_response(['ok' => false, 'error' => ['code' => 'LOGIN_INVALID', 'message' => 'ایمیل یا رمز عبور صحیح نیست.']], 401);
    }
    if ($user['status'] !== 'active') {
        json_response(['ok' => false, 'error' => ['code' => 'EMAIL_NOT_VERIFIED', 'message' => 'ابتدا ایمیل خود را تأیید کن.']], 403);
    }

    session_regenerate_id(true);
    $_SESSION['user_id'] = (string)$user['id'];
    $_SESSION['session_version'] = (int)$user['session_version'];
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));

    json_response([
        'ok' => true,
        'csrfToken' => $_SESSION['csrf_token'],
        'user' => ['id' => $user['id'], 'email' => $email],
    ]);
}

function auth_request_password_reset(): never
{
    enforce_auth_rate_limit('password-reset', 5);
    $body = json_body();
    $email = strtolower(trim((string)($body['email'] ?? '')));

    if (filter_var($email, FILTER_VALIDATE_EMAIL) !== false) {
        $stmt = db()->prepare("SELECT id FROM users WHERE email = :email AND status = 'active' LIMIT 1");
        $stmt->execute(['email' => $email]);
        $user = $stmt->fetch();

        if ($user) {
            $token = bin2hex(random_bytes(32));
            $tokenHash = hash('sha256', $token);
            $insert = db()->prepare(
                'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
                 VALUES (:user_id, :token_hash, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 HOUR))'
            );
            $insert->execute(['user_id' => $user['id'], 'token_hash' => $tokenHash]);

            $baseUrl = rtrim((string)($GLOBALS['config']['app']['base_url'] ?? ''), '/');
            $link = $baseUrl . '/?reset_token=' . rawurlencode($token);
            send_app_email($email, 'بازیابی رمز عبور', "برای تعیین رمز جدید از پیوند زیر استفاده کن:\n\n" . $link);
        }
    }

    json_response(['ok' => true, 'message' => 'اگر حساب فعالی با این ایمیل وجود داشته باشد، راهنمای بازیابی ارسال می‌شود.']);
}

function auth_reset_password(): never
{
    enforce_auth_rate_limit('password-reset-submit', 8);
    $body = json_body();
    $token = trim((string)($body['token'] ?? ''));
    $password = (string)($body['password'] ?? '');

    if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
        json_response(['ok' => false, 'error' => ['code' => 'RESET_TOKEN_INVALID', 'message' => 'پیوند بازیابی معتبر نیست.']], 422);
    }
    $passwordError = validate_password_strength($password);
    if ($passwordError !== null) {
        json_response(['ok' => false, 'error' => ['code' => 'PASSWORD_WEAK', 'message' => $passwordError]], 422);
    }

    try {
        db()->beginTransaction();
        $stmt = db()->prepare(
            'SELECT id, user_id FROM password_reset_tokens
             WHERE token_hash = :token_hash AND expires_at > UTC_TIMESTAMP() AND used_at IS NULL
             LIMIT 1 FOR UPDATE'
        );
        $stmt->execute(['token_hash' => hash('sha256', $token)]);
        $reset = $stmt->fetch();

        if (!$reset) {
            db()->rollBack();
            json_response(['ok' => false, 'error' => ['code' => 'RESET_TOKEN_EXPIRED', 'message' => 'پیوند بازیابی منقضی یا قبلاً استفاده شده است.']], 400);
        }

        $update = db()->prepare(
            'UPDATE users SET password_hash = :password_hash, session_version = session_version + 1
             WHERE id = :user_id'
        );
        $update->execute([
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'user_id' => $reset['user_id'],
        ]);

        $delete = db()->prepare('DELETE FROM password_reset_tokens WHERE user_id = :user_id');
        $delete->execute(['user_id' => $reset['user_id']]);
        db()->commit();

        json_response(['ok' => true, 'message' => 'رمز عبور با موفقیت تغییر کرد.']);
    } catch (Throwable $error) {
        if (db()->inTransaction()) {
            db()->rollBack();
        }
        error_log('[AI Content Factory] Password reset failed: ' . $error->getMessage());
        json_response(['ok' => false, 'error' => ['code' => 'RESET_FAILED', 'message' => 'تغییر رمز عبور انجام نشد.']], 500);
    }
}
