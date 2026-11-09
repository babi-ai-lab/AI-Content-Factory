<?php
declare(strict_types=1);

require dirname(__DIR__) . '/app/bootstrap.php';

$path = request_path();
$method = request_method();

if ($path === '/api/health' && $method === 'GET') {
    try {
        db()->query('SELECT 1');
        json_response([
            'ok' => true,
            'app' => 'AI Content Factory',
            'runtime' => 'php',
            'database' => 'connected',
        ]);
    } catch (Throwable $error) {
        error_log('[AI Content Factory] Database health check failed: ' . $error->getMessage());
        json_response([
            'ok' => false,
            'error' => [
                'code' => 'DATABASE_UNAVAILABLE',
                'message' => 'ارتباط با پایگاه داده برقرار نیست.',
            ],
        ], 503);
    }
}

if ($path === '/' && $method === 'GET') {
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI Content Factory</title><body><main><h1>کارخانه هوشمند تولید محتوا</h1><p>نسخه PHP در حال آماده‌سازی و انتقال مرحله‌ای است.</p></main></body></html>';
    exit;
}

json_response([
    'ok' => false,
    'error' => [
        'code' => 'NOT_FOUND',
        'message' => 'مسیر موردنظر پیدا نشد.',
    ],
], 404);
