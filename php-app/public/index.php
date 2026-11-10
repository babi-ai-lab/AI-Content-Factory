<?php
declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use App\Core\Database;
use App\Core\Http;

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

if ($method === 'GET' && ($path === '/health' || $path === '/api/health')) {
    try {
        Database::connection($config)->query('SELECT 1');
        Http::json([
            'ok' => true,
            'application' => 'AI Content Factory',
            'runtime' => 'php',
            'database' => 'connected',
        ]);
    } catch (Throwable $exception) {
        error_log('[AI Content Factory] Health check failed: ' . $exception->getMessage());
        Http::json(['ok' => false, 'error' => 'service_unavailable'], 503);
    }
}

Http::json(['error' => 'not_found'], 404);
