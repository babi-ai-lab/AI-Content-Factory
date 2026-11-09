<?php
declare(strict_types=1);

$configFile = dirname(__DIR__) . '/config.php';

if (!is_file($configFile)) {
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'ok' => false,
        'error' => [
            'code' => 'APP_NOT_CONFIGURED',
            'message' => 'برنامه هنوز پیکربندی نشده است.',
        ],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$config = require $configFile;

set_exception_handler(static function (Throwable $error): void {
    error_log('[AI Content Factory] Unhandled application error: ' . $error->getMessage());
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store, private');
    }
    echo json_encode([
        'ok' => false,
        'error' => [
            'code' => 'INTERNAL_ERROR',
            'message' => 'خطای داخلی رخ داد. کمی بعد دوباره تلاش کن.',
        ],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
});

ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');

date_default_timezone_set($config['app']['timezone'] ?? 'Asia/Tehran');

$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

if ($isHttps) {
    header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
}
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');

session_name((string)($config['session']['name'] ?? 'aicf_session'));
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'domain' => '',
    'secure' => (bool)($config['session']['secure'] ?? $isHttps),
    'httponly' => true,
    'samesite' => (string)($config['session']['same_site'] ?? 'Lax'),
]);

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/http.php';
require_once __DIR__ . '/security.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/content_generation.php';
require_once __DIR__ . '/history.php';
require_once __DIR__ . '/campaigns.php';
require_once __DIR__ . '/analytics_calendar.php';
