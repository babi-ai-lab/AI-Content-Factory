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

date_default_timezone_set($config['app']['timezone'] ?? 'Asia/Tehran');

$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

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
