<?php
declare(strict_types=1);

/**
 * Copy this file to config.php on the hosting account.
 * Never commit config.php or place real secrets in Git.
 */
return [
    'app' => [
        'name' => 'AI Content Factory',
        'environment' => 'production',
        'base_url' => 'https://app.eltbabak.ir',
        'timezone' => 'Asia/Tehran',
        'debug' => false,
    ],
    'database' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => '',
        'username' => '',
        'password' => '',
        'charset' => 'utf8mb4',
    ],
    'mail' => [
        'from_email' => 'no-reply@eltbabak.ir',
        'from_name' => 'AI Content Factory',
    ],
    'session' => [
        'name' => 'aicf_session',
        'secure' => true,
        'same_site' => 'Lax',
    ],
    'ai' => [
        'text_provider' => 'gemini',
        'text_api_key' => '',
        'text_model' => '',
        'text_fallback_model' => '',
        'image_provider' => 'cloudflare',
        'image_account_id' => '',
        'image_api_token' => '',
    ],
];
