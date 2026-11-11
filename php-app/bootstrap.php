<?php
declare(strict_types=1);

use App\\Core\\Http;

define('APP_ROOT', __DIR__);

spl_autoload_register(static function (string $class): void {
    $prefix = 'App\\\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $relative = substr($class, strlen($prefix));
    $file = APP_ROOT . '/src/' . str_replace('\\\\', '/', $relative) . '.php';
    if (is_file($file)) {
        require $file;
    }
});

$configFile = APP_ROOT . '/config/config.local.php';
if (!is_file($configFile)) {
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'application_not_configured'], JSON_UNESCAPED_UNICODE);
    exit;
}

$config = require $configFile;
date_default_timezone_set($config['app']['timezone'] ?? 'UTC');

ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
ini_set('session.use_trans_sid', '0');
session_name($config['app']['session_name'] ?? 'aicf_session');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => (bool) ($config['security']['session_secure'] ?? true),
    'httponly' => true,
    'samesite' => $config['security']['session_samesite'] ?? 'Lax',
]);

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('X-Frame-Options: DENY');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
header('Cross-Origin-Opener-Policy: same-origin');
header('X-Permitted-Cross-Domain-Policies: none');
header('Cache-Control: no-store, private');
