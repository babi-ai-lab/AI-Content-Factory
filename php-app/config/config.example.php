<?php
declare(strict_types=1);

/**
 * Copy to config.local.php and fill values.
 * Keep config.local.php outside the public document root and out of Git.
 */
return [
    'app' => [
        'environment' => 'production',
        'debug' => false,
        'base_url' => 'https://app.eltbabak.ir',
        'timezone' => 'UTC',
        'session_name' => 'aicf_session',
    ],
    'database' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => '',
        'username' => '',
        'password' => '',
        'charset' => 'utf8mb4',
    ],
    'security' => [
        'session_secure' => true,
        'session_samesite' => 'Lax',
        'allowed_origins' => ['https://app.eltbabak.ir'],
        // Set a random 64+ character value in config.local.php only; never commit it.
        'first_admin_setup_token' => '',
    ],
];
