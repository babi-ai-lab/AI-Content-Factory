<?php
declare(strict_types=1);

use App\Core\Http;

define('APP_ROOT', __DIR__);

spl_autoload_register(static function (string $class): void {
    $prefix = 'App\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $relative = substr($class, strlen($prefix));
    $file = APP_ROOT . '/src/' . str_replace('\\', '/', $relative) . '.php';
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

$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

session_name($config['app']['session_name'] ?? 'aicf_session');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => (bool) ($config['security']['session_secure'] ?? true) && $isHttps,
    'httponly' => true,
    'samesite' => $config['security']['session_samesite'] ?? 'Lax',
]);

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('X-Frame-Options: DENY');
header('Cache-Control: no-store, private');
