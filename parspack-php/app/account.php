<?php
declare(strict_types=1);

function account_route(string $path, string $method): bool
{
    if ($path === '/api/account/export' && $method === 'GET') {
        $userId = require_user_id();
        account_export($userId);
    }
    if ($path === '/api/account/delete' && $method === 'POST') {
        require_csrf();
        $userId = require_user_id();
        account_delete($userId);
    }
    return false;
}

function account_export(string $userId): never
{
    $userStmt = db()->prepare('SELECT id, email, display_name, email_verified_at, ai_data_notice_accepted_at, created_at, updated_at FROM users WHERE id = :id LIMIT 1');
    $userStmt->execute(['id' => $userId]);
    $user = $userStmt->fetch();

    $collections = [
        'brandProfiles' => ['SELECT id, name, business_type, profile_data, is_default, created_at, updated_at FROM brand_profiles WHERE user_id = :user_id ORDER BY created_at', ['profile_data']],
        'contentHistory' => ['SELECT id, product, content, created_at, updated_at FROM content_history WHERE user_id = :user_id ORDER BY created_at', ['product', 'content']],
        'contentVersions' => ['SELECT id, history_id, content, created_at FROM content_versions WHERE user_id = :user_id ORDER BY created_at', ['content']],
        'campaigns' => ['SELECT id, name, goal, audience, channels, status, stages, currency_label, budget_amount, spend_amount, impressions, clicks, leads, conversions, revenue_amount, created_at, updated_at FROM marketing_campaigns WHERE user_id = :user_id ORDER BY created_at', ['channels', 'stages']],
        'campaignContentLinks' => ['SELECT id, campaign_id, content_id, notes, created_at FROM marketing_campaign_content WHERE user_id = :user_id ORDER BY created_at', []],
        'aiUsage' => ['SELECT id, request_id, model, prompt_tokens, candidate_tokens, total_tokens, created_at FROM ai_usage_events WHERE user_id = :user_id ORDER BY created_at', []],
        'media' => ['SELECT id, prompt, aspect_ratio, mime_type, byte_size, content_history_id, created_at FROM generated_media WHERE user_id = :user_id ORDER BY created_at', []],
    ];

    $export = ['exportedAt' => gmdate('c'), 'user' => $user, 'data' => []];
    foreach ($collections as $key => [$sql, $jsonFields]) {
        $stmt = db()->prepare($sql);
        $stmt->execute(['user_id' => $userId]);
        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            foreach ($jsonFields as $field) $row[$field] = json_decode((string)$row[$field], true) ?? [];
        }
        unset($row);
        $export['data'][$key] = $rows;
    }

    header('Content-Type: application/json; charset=utf-8');
    header('Content-Disposition: attachment; filename="ai-content-factory-export-' . gmdate('Ymd-His') . '.json"');
    header('Cache-Control: private, no-store');
    echo json_encode($export, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function account_delete(string $userId): never
{
    $body = json_body();
    $password = (string)($body['password'] ?? '');
    $confirmation = (string)($body['confirmation'] ?? '');
    if ($confirmation !== 'DELETE' || $password === '') {
        json_response(['ok' => false, 'error' => ['code' => 'ACCOUNT_DELETE_CONFIRMATION_REQUIRED', 'message' => 'برای حذف حساب، رمز عبور و عبارت DELETE را وارد کن.']], 422);
    }

    $userStmt = db()->prepare('SELECT password_hash FROM users WHERE id = :id LIMIT 1');
    $userStmt->execute(['id' => $userId]);
    $user = $userStmt->fetch();
    if (!$user || !password_verify($password, (string)$user['password_hash'])) {
        json_response(['ok' => false, 'error' => ['code' => 'PASSWORD_INVALID', 'message' => 'رمز عبور صحیح نیست.']], 401);
    }

    $mediaStmt = db()->prepare('SELECT storage_path FROM generated_media WHERE user_id = :user_id');
    $mediaStmt->execute(['user_id' => $userId]);
    $paths = array_column($mediaStmt->fetchAll(), 'storage_path');

    $delete = db()->prepare('DELETE FROM users WHERE id = :id');
    $delete->execute(['id' => $userId]);
    if ($delete->rowCount() !== 1) {
        json_response(['ok' => false, 'error' => ['code' => 'ACCOUNT_DELETE_FAILED', 'message' => 'حذف حساب انجام نشد.']], 500);
    }

    $storageRoot = realpath(dirname(__DIR__) . '/storage');
    foreach ($paths as $relative) {
        if (!is_string($relative)) continue;
        $file = realpath(dirname(__DIR__) . '/storage/' . $relative);
        if ($storageRoot && $file && str_starts_with($file, $storageRoot . DIRECTORY_SEPARATOR) && is_file($file)) {
            if (!@unlink($file)) error_log('[AI Content Factory] An orphaned media file remains after account deletion.');
        }
    }

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
    json_response(['ok' => true, 'deleted' => true]);
}
