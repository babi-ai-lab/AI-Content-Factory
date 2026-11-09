<?php
declare(strict_types=1);

function uuid_v4(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);
    return sprintf('%s-%s-%s-%s-%s',
        substr($hex, 0, 8),
        substr($hex, 8, 4),
        substr($hex, 12, 4),
        substr($hex, 16, 4),
        substr($hex, 20, 12)
    );
}

function json_body(int $maxBytes = 16384): array
{
    $length = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($length > $maxBytes) {
        json_response(['ok' => false, 'error' => ['code' => 'BODY_TOO_LARGE', 'message' => 'حجم درخواست بیش از حد مجاز است.']], 413);
    }

    $stream = fopen('php://input', 'rb');
    if ($stream === false) {
        json_response(['ok' => false, 'error' => ['code' => 'INVALID_BODY', 'message' => 'خواندن درخواست ناموفق بود.']], 400);
    }

    $raw = '';
    while (!feof($stream)) {
        $chunk = fread($stream, min(4096, $maxBytes + 1 - strlen($raw)));
        if ($chunk === false) {
            fclose($stream);
            json_response(['ok' => false, 'error' => ['code' => 'INVALID_BODY', 'message' => 'خواندن درخواست ناموفق بود.']], 400);
        }
        $raw .= $chunk;
        if (strlen($raw) > $maxBytes) {
            fclose($stream);
            json_response(['ok' => false, 'error' => ['code' => 'BODY_TOO_LARGE', 'message' => 'حجم درخواست بیش از حد مجاز است.']], 413);
        }
        if ($chunk === '') break;
    }
    fclose($stream);

    if ($raw === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        json_response(['ok' => false, 'error' => ['code' => 'INVALID_JSON', 'message' => 'ساختار درخواست معتبر نیست.']], 400);
    }

    return $decoded;
}

function csrf_token(): string
{
    if (!isset($_SESSION['csrf_token']) || !is_string($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function require_csrf(): void
{
    $provided = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($_POST['_csrf'] ?? ''));
    $expected = (string)($_SESSION['csrf_token'] ?? '');

    if ($provided === '' || $expected === '' || !hash_equals($expected, $provided)) {
        json_response(['ok' => false, 'error' => ['code' => 'CSRF_INVALID', 'message' => 'درخواست منقضی یا نامعتبر است. صفحه را تازه‌سازی و دوباره تلاش کن.']], 419);
    }
}

function require_user_id(): string
{
    $userId = $_SESSION['user_id'] ?? null;
    $sessionVersion = $_SESSION['session_version'] ?? null;

    if (!is_string($userId) || $userId === '' || !is_int($sessionVersion)) {
        json_response(['ok' => false, 'error' => ['code' => 'AUTH_REQUIRED', 'message' => 'برای ادامه وارد حساب کاربری شو.']], 401);
    }

    $stmt = db()->prepare('SELECT status, session_version FROM users WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $userId]);
    $user = $stmt->fetch();

    if (!$user || $user['status'] !== 'active' || (int)$user['session_version'] !== $sessionVersion) {
        $_SESSION = [];
        session_regenerate_id(true);
        json_response(['ok' => false, 'error' => ['code' => 'SESSION_EXPIRED', 'message' => 'نشست کاربری معتبر نیست؛ دوباره وارد شو.']], 401);
    }

    return $userId;
}

function enforce_auth_rate_limit(string $scope, int $limit = 10, int $windowSeconds = 900): void
{
    $ip = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $key = hash('sha256', $scope . '|' . $ip);

    $stmt = db()->prepare(
        'INSERT INTO auth_rate_limits (bucket_key, window_started_at, request_count)
         VALUES (:bucket, UTC_TIMESTAMP(), 1)
         ON DUPLICATE KEY UPDATE
           request_count = IF(window_started_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 MINUTE), 1, request_count + 1),
           window_started_at = IF(window_started_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 MINUTE), UTC_TIMESTAMP(), window_started_at)'
    );
    $stmt->execute(['bucket' => $key]);

    $check = db()->prepare('SELECT request_count FROM auth_rate_limits WHERE bucket_key = :bucket');
    $check->execute(['bucket' => $key]);
    $count = (int)$check->fetchColumn();

    if ($count > $limit) {
        header('Retry-After: ' . $windowSeconds);
        json_response(['ok' => false, 'error' => ['code' => 'RATE_LIMITED', 'message' => 'تعداد درخواست‌ها زیاد است. چند دقیقه دیگر دوباره تلاش کن.']], 429);
    }
}

function send_app_email(string $to, string $subject, string $body): bool
{
    global $config;

    $from = trim((string)($config['mail']['from_email'] ?? ''));
    $fromName = trim((string)($config['mail']['from_name'] ?? 'AI Content Factory'));

    if ($from === '' || filter_var($from, FILTER_VALIDATE_EMAIL) === false) {
        return false;
    }

    $encodedName = function_exists('mb_encode_mimeheader')
        ? mb_encode_mimeheader($fromName, 'UTF-8')
        : $fromName;

    $encodedSubject = function_exists('mb_encode_mimeheader')
        ? mb_encode_mimeheader($subject, 'UTF-8')
        : $subject;

    $headers = [
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'From: ' . $encodedName . ' <' . $from . '>',
        'X-Mailer: AI-Content-Factory-PHP',
    ];

    return @mail($to, $encodedSubject, $body, implode("\r\n", $headers));
}

function validate_password_strength(string $password): ?string
{
    if (strlen($password) < 10) {
        return 'رمز عبور باید حداقل ۱۰ نویسه داشته باشد.';
    }
    if (!preg_match('/[a-z]/', $password)) {
        return 'رمز عبور باید حداقل یک حرف کوچک انگلیسی داشته باشد.';
    }
    if (!preg_match('/[A-Z]/', $password)) {
        return 'رمز عبور باید حداقل یک حرف بزرگ انگلیسی داشته باشد.';
    }
    if (!preg_match('/[0-9]/', $password)) {
        return 'رمز عبور باید حداقل یک عدد داشته باشد.';
    }
    if (!preg_match('/[^a-zA-Z0-9]/', $password)) {
        return 'رمز عبور باید حداقل یک علامت داشته باشد.';
    }
    return null;
}
