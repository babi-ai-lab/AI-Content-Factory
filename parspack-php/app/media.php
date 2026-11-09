<?php
declare(strict_types=1);

const AICF_IMAGE_MAX_BYTES = 8388608;

function media_route(string $path, string $method): bool
{
    if ($path === '/api/media' && $method === 'GET') {
        $userId = require_user_id();
        media_list($userId);
    }
    if ($path === '/api/media/generate' && $method === 'POST') {
        require_csrf();
        $userId = require_user_id();
        media_generate($userId);
    }
    if (preg_match('#^/api/media/([a-f0-9-]{36})$#i', $path, $matches)) {
        $userId = require_user_id();
        $id = strtolower($matches[1]);
        if ($method === 'GET') media_stream($userId, $id);
        if ($method === 'DELETE') {
            require_csrf();
            media_delete($userId, $id);
        }
    }
    return false;
}

function media_http_post(string $url, array $headers, array $payload): array
{
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($json)) return ['status' => 0, 'body' => null];

    if (function_exists('curl_init')) {
        $handle = curl_init($url);
        curl_setopt_array($handle, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $json,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 15,
            CURLOPT_TIMEOUT => 90,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);
        $body = curl_exec($handle);
        $status = (int)curl_getinfo($handle, CURLINFO_HTTP_CODE);
        curl_close($handle);
        return ['status' => $status, 'body' => is_string($body) ? $body : null];
    }

    if (!extension_loaded('openssl') || !filter_var(ini_get('allow_url_fopen'), FILTER_VALIDATE_BOOLEAN)) {
        return ['status' => 0, 'body' => null];
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => implode("\r\n", $headers) . "\r\n",
            'content' => $json,
            'timeout' => 90,
            'ignore_errors' => true,
        ],
        'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
    ]);
    $body = @file_get_contents($url, false, $context);
    $status = 0;
    foreach (($http_response_header ?? []) as $header) {
        if (preg_match('/^HTTP\/\S+\s+(\d{3})/', $header, $matches)) $status = (int)$matches[1];
    }
    return ['status' => $status, 'body' => is_string($body) ? $body : null];
}

function media_reserve_quota(string $userId): array
{
    $stmt = db()->prepare(
        'INSERT INTO media_generation_allowance (user_id, window_started_at, request_count)
         VALUES (:user_id, UTC_TIMESTAMP(), 1)
         ON DUPLICATE KEY UPDATE
           request_count = IF(window_started_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 HOUR), 1, request_count + 1),
           window_started_at = IF(window_started_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 HOUR), UTC_TIMESTAMP(), window_started_at)'
    );
    $stmt->execute(['user_id' => $userId]);
    $read = db()->prepare('SELECT window_started_at, request_count FROM media_generation_allowance WHERE user_id = :user_id');
    $read->execute(['user_id' => $userId]);
    $row = $read->fetch();
    if (!$row) return ['allowed' => false, 'retryAfter' => 3600];
    $count = (int)$row['request_count'];
    $resetAt = strtotime((string)$row['window_started_at'] . ' UTC') + 3600;
    return ['allowed' => $count <= 5, 'retryAfter' => max(1, $resetAt - time())];
}

function media_generate(string $userId): never
{
    $body = json_body();
    $prompt = trim((string)($body['prompt'] ?? ''));
    $ratio = (string)($body['aspect_ratio'] ?? '4:5');
    $allowedRatios = ['1:1', '4:5', '9:16', '16:9', '3:2', '2:3'];

    if (mb_strlen($prompt, 'UTF-8') < 20 || mb_strlen($prompt, 'UTF-8') > 3000 || !in_array($ratio, $allowedRatios, true)) {
        json_response(['ok' => false, 'error' => ['code' => 'MEDIA_INPUT_INVALID', 'message' => 'توضیحات تصویر یا نسبت ابعاد معتبر نیست.']], 422);
    }

    $historyId = trim((string)($body['content_history_id'] ?? ''));
    if ($historyId !== '') {
        if (!preg_match('/^[a-f0-9-]{36}$/i', $historyId)) {
            json_response(['ok' => false, 'error' => ['code' => 'HISTORY_ID_INVALID', 'message' => 'شناسه محتوای مرتبط معتبر نیست.']], 422);
        }
        $check = db()->prepare('SELECT id FROM content_history WHERE id = :id AND user_id = :user_id LIMIT 1');
        $check->execute(['id' => $historyId, 'user_id' => $userId]);
        if (!$check->fetch()) {
            json_response(['ok' => false, 'error' => ['code' => 'HISTORY_NOT_FOUND', 'message' => 'محتوای مرتبط پیدا نشد.']], 404);
        }
    } else {
        $historyId = null;
    }

    $userStmt = db()->prepare('SELECT ai_data_notice_accepted_at FROM users WHERE id = :id LIMIT 1');
    $userStmt->execute(['id' => $userId]);
    $user = $userStmt->fetch();
    if (!$user || empty($user['ai_data_notice_accepted_at'])) {
        json_response(['ok' => false, 'error' => ['code' => 'AI_DATA_PROCESSING_NOTICE_REQUIRED', 'message' => 'پیش از ارسال اطلاعات به سرویس هوش مصنوعی، اطلاعیه پردازش داده را تأیید کن.']], 428);
    }

    $accountId = trim((string)($GLOBALS['config']['ai']['image_account_id'] ?? ''));
    $apiToken = trim((string)($GLOBALS['config']['ai']['image_api_token'] ?? ''));
    if ($accountId === '' || $apiToken === '') {
        json_response(['ok' => false, 'error' => ['code' => 'IMAGE_PROVIDER_NOT_CONFIGURED', 'message' => 'سرویس تولید تصویر هنوز پیکربندی نشده است.']], 503);
    }
    if (!function_exists('curl_init') && (!extension_loaded('openssl') || !filter_var(ini_get('allow_url_fopen'), FILTER_VALIDATE_BOOLEAN))) {
        json_response(['ok' => false, 'error' => ['code' => 'OUTBOUND_HTTPS_UNAVAILABLE', 'message' => 'ارتباط امن خروجی از هاست فعال نیست. cURL یا OpenSSL باید در cPanel فعال شود.']], 503);
    }

    $quota = media_reserve_quota($userId);
    if (!$quota['allowed']) {
        header('Retry-After: ' . $quota['retryAfter']);
        json_response(['ok' => false, 'error' => ['code' => 'MEDIA_GENERATION_LIMIT', 'message' => 'سهمیه تولید تصویر این حساب در یک ساعت به پایان رسیده است.']], 429);
    }

    $dimensions = [
        '1:1' => [1024, 1024], '4:5' => [832, 1024], '9:16' => [576, 1024],
        '16:9' => [1024, 576], '3:2' => [1024, 672], '2:3' => [672, 1024],
    ];
    [$width, $height] = $dimensions[$ratio];
    $url = 'https://api.cloudflare.com/client/v4/accounts/' . rawurlencode($accountId) . '/ai/run/@cf/black-forest-labs/flux-1-schnell';
    $response = media_http_post($url, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiToken,
    ], ['prompt' => $prompt, 'width' => $width, 'height' => $height]);

    if ($response['status'] === 0 || !is_string($response['body'])) {
        json_response(['ok' => false, 'error' => ['code' => 'IMAGE_PROVIDER_UNAVAILABLE', 'message' => 'ارتباط با سرویس تولید تصویر برقرار نشد.']], 502);
    }
    if ($response['status'] === 429) {
        json_response(['ok' => false, 'error' => ['code' => 'IMAGE_PROVIDER_QUOTA', 'message' => 'ظرفیت سرویس تولید تصویر به پایان رسیده است.']], 429);
    }
    if ($response['status'] < 200 || $response['status'] >= 300) {
        json_response(['ok' => false, 'error' => ['code' => 'IMAGE_PROVIDER_ERROR', 'message' => 'سرویس تولید تصویر موقتاً پاسخ‌گو نیست.']], 502);
    }

    $data = json_decode($response['body'], true);
    $encoded = $data['result']['image'] ?? null;
    if (!is_string($encoded)) {
        json_response(['ok' => false, 'error' => ['code' => 'IMAGE_RESPONSE_INVALID', 'message' => 'پاسخ سرویس تصویر معتبر نیست.']], 502);
    }
    $binary = base64_decode($encoded, true);
    if (!is_string($binary) || $binary === '' || strlen($binary) > AICF_IMAGE_MAX_BYTES) {
        json_response(['ok' => false, 'error' => ['code' => 'IMAGE_SIZE_INVALID', 'message' => 'حجم یا داده تصویر معتبر نیست.']], 502);
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->buffer($binary);
    $extensions = ['image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp'];
    if (!is_string($mime) || !isset($extensions[$mime])) {
        json_response(['ok' => false, 'error' => ['code' => 'IMAGE_MIME_INVALID', 'message' => 'نوع فایل تصویر پشتیبانی نمی‌شود.']], 502);
    }

    $id = uuid_v4();
    $relative = 'generated-media/' . $userId . '/' . $id . '.' . $extensions[$mime];
    $storageRoot = dirname(__DIR__) . '/storage';
    $absolute = $storageRoot . '/' . $relative;
    $directory = dirname($absolute);
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
        json_response(['ok' => false, 'error' => ['code' => 'STORAGE_UNAVAILABLE', 'message' => 'فضای ذخیره‌سازی خصوصی در دسترس نیست.']], 503);
    }
    $written = file_put_contents($absolute, $binary, LOCK_EX);
    if ($written === false || $written !== strlen($binary)) {
        if (is_file($absolute)) @unlink($absolute);
        json_response(['ok' => false, 'error' => ['code' => 'STORAGE_WRITE_FAILED', 'message' => 'ذخیره تصویر انجام نشد.']], 503);
    }
    @chmod($absolute, 0600);

    try {
        $insert = db()->prepare(
            'INSERT INTO generated_media (id, user_id, storage_path, prompt, aspect_ratio, mime_type, byte_size, content_history_id, created_at)
             VALUES (:id, :user_id, :storage_path, :prompt, :aspect_ratio, :mime_type, :byte_size, :content_history_id, UTC_TIMESTAMP())'
        );
        $insert->execute([
            'id' => $id, 'user_id' => $userId, 'storage_path' => $relative, 'prompt' => $prompt,
            'aspect_ratio' => $ratio, 'mime_type' => $mime, 'byte_size' => strlen($binary),
            'content_history_id' => $historyId,
        ]);
    } catch (Throwable $error) {
        @unlink($absolute);
        throw $error;
    }

    json_response(['ok' => true, 'asset' => [
        'id' => $id,
        'url' => '/api/media/' . $id,
        'mime_type' => $mime,
        'byte_size' => strlen($binary),
        'aspect_ratio' => $ratio,
    ]], 201);
}

function media_list(string $userId): never
{
    $stmt = db()->prepare(
        'SELECT id, prompt, aspect_ratio, mime_type, byte_size, content_history_id, created_at
         FROM generated_media WHERE user_id = :user_id ORDER BY created_at DESC LIMIT 40'
    );
    $stmt->execute(['user_id' => $userId]);
    json_response(['ok' => true, 'items' => $stmt->fetchAll()]);
}

function media_stream(string $userId, string $id): never
{
    $stmt = db()->prepare('SELECT storage_path, mime_type, byte_size FROM generated_media WHERE id = :id AND user_id = :user_id LIMIT 1');
    $stmt->execute(['id' => $id, 'user_id' => $userId]);
    $asset = $stmt->fetch();
    if (!$asset) json_response(['ok' => false, 'error' => ['code' => 'MEDIA_NOT_FOUND', 'message' => 'تصویر پیدا نشد.']], 404);

    $root = realpath(dirname(__DIR__) . '/storage');
    $file = realpath(dirname(__DIR__) . '/storage/' . (string)$asset['storage_path']);
    if (!$root || !$file || !str_starts_with($file, $root . DIRECTORY_SEPARATOR) || !is_file($file)) {
        json_response(['ok' => false, 'error' => ['code' => 'MEDIA_FILE_MISSING', 'message' => 'فایل تصویر در دسترس نیست.']], 404);
    }

    header('Content-Type: ' . $asset['mime_type']);
    header('Content-Length: ' . (int)$asset['byte_size']);
    header('Content-Disposition: inline; filename="media-' . $id . '"');
    header('Cache-Control: private, no-store');
    header('X-Content-Type-Options: nosniff');
    readfile($file);
    exit;
}

function media_delete(string $userId, string $id): never
{
    $stmt = db()->prepare('SELECT storage_path FROM generated_media WHERE id = :id AND user_id = :user_id LIMIT 1');
    $stmt->execute(['id' => $id, 'user_id' => $userId]);
    $asset = $stmt->fetch();
    if (!$asset) json_response(['ok' => false, 'error' => ['code' => 'MEDIA_NOT_FOUND', 'message' => 'تصویر پیدا نشد.']], 404);

    $absolute = dirname(__DIR__) . '/storage/' . (string)$asset['storage_path'];
    if (is_file($absolute) && !@unlink($absolute)) {
        json_response(['ok' => false, 'error' => ['code' => 'MEDIA_DELETE_FAILED', 'message' => 'حذف فایل تصویر انجام نشد.']], 500);
    }
    $delete = db()->prepare('DELETE FROM generated_media WHERE id = :id AND user_id = :user_id');
    $delete->execute(['id' => $id, 'user_id' => $userId]);
    json_response(['ok' => true, 'deleted' => $delete->rowCount() > 0]);
}
