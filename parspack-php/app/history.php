<?php
declare(strict_types=1);

function history_decode_row(array $row): array
{
    $row['product'] = json_decode((string)$row['product'], true) ?? [];
    $row['content'] = json_decode((string)$row['content'], true) ?? [];
    return $row;
}

function history_validate_payload(array $body, bool $requireBoth = true): ?array
{
    $result = [];
    foreach (['product', 'content'] as $field) {
        if (!array_key_exists($field, $body)) {
            if ($requireBoth) return null;
            continue;
        }
        if (!is_array($body[$field]) || array_is_list($body[$field])) return null;
        $encoded = json_encode($body[$field], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($encoded) || strlen($encoded) > 20000) return null;
        $result[$field] = $encoded;
    }
    if (isset($result['content'])) {
        $content = $body['content'];
        if (!isset($content['caption'], $content['reel'], $content['stories'], $content['ad'])
            || !is_string($content['caption']) || !is_string($content['reel'])
            || !is_array($content['stories']) || !is_string($content['ad']) || count($content['stories']) !== 5) {
            return null;
        }
        foreach (['caption' => 8000, 'reel' => 12000, 'ad' => 6000] as $key => $limit) {
            if (mb_strlen($content[$key], 'UTF-8') > $limit) return null;
        }
        foreach ($content['stories'] as $story) {
            if (!is_string($story) || trim($story) === '' || mb_strlen($story, 'UTF-8') > 1200) return null;
        }
    }
    return $result;
}

function history_route(string $path, string $method): bool
{
    if ($path === '/api/history') {
        $userId = require_user_id();
        if ($method === 'GET') history_list($userId);
        if ($method === 'POST') {
            require_csrf();
            history_create($userId);
        }
        if ($method === 'DELETE') {
            require_csrf();
            $stmt = db()->prepare('DELETE FROM content_history WHERE user_id = :user_id');
            $stmt->execute(['user_id' => $userId]);
            json_response(['ok' => true, 'deleted' => $stmt->rowCount()]);
        }
    }

    if (preg_match('#^/api/history/([a-f0-9-]{36})$#i', $path, $matches)) {
        $userId = require_user_id();
        $id = strtolower($matches[1]);
        if ($method === 'PATCH') {
            require_csrf();
            history_update($userId, $id);
        }
        if ($method === 'DELETE') {
            require_csrf();
            $stmt = db()->prepare('DELETE FROM content_history WHERE id = :id AND user_id = :user_id');
            $stmt->execute(['id' => $id, 'user_id' => $userId]);
            json_response(['ok' => true, 'deleted' => $stmt->rowCount() > 0]);
        }
    }

    if (preg_match('#^/api/history/([a-f0-9-]{36})/versions$#i', $path, $matches) && $method === 'GET') {
        $userId = require_user_id();
        history_versions($userId, strtolower($matches[1]));
    }

    if (preg_match('#^/api/history/([a-f0-9-]{36})/restore/([a-f0-9-]{36})$#i', $path, $matches) && $method === 'POST') {
        require_csrf();
        $userId = require_user_id();
        history_restore($userId, strtolower($matches[1]), strtolower($matches[2]));
    }

    return false;
}

function history_list(string $userId): never
{
    $limit = max(1, min(100, (int)($_GET['limit'] ?? 50)));
    $cursor = trim((string)($_GET['cursor'] ?? ''));
    $search = trim((string)($_GET['q'] ?? ''));

    $where = 'user_id = :user_id';
    $params = ['user_id' => $userId];

    if ($cursor !== '') {
        $decoded = base64_decode(strtr($cursor, '-_', '+/'), true);
        $cursorData = is_string($decoded) ? json_decode($decoded, true) : null;
        if (!is_array($cursorData) || !isset($cursorData['createdAt'], $cursorData['id'])
            || !is_string($cursorData['createdAt']) || !is_string($cursorData['id'])) {
            json_response(['ok' => false, 'error' => ['code' => 'CURSOR_INVALID', 'message' => 'نشانگر صفحه‌بندی معتبر نیست.']], 400);
        }
        $where .= ' AND (created_at < :cursor_date OR (created_at = :cursor_date AND id < :cursor_id))';
        $params['cursor_date'] = $cursorData['createdAt'];
        $params['cursor_id'] = $cursorData['id'];
    }

    if ($search !== '') {
        if (mb_strlen($search, 'UTF-8') > 100) {
            json_response(['ok' => false, 'error' => ['code' => 'SEARCH_TOO_LONG', 'message' => 'عبارت جست‌وجو بیش از حد طولانی است.']], 422);
        }
        $where .= ' AND (CAST(product AS CHAR) LIKE :search_product OR CAST(content AS CHAR) LIKE :search_content)';
        $needle = '%' . addcslashes($search, '%_\\') . '%';
        $params['search_product'] = $needle;
        $params['search_content'] = $needle;
    }

    $sql = 'SELECT id, product, content, created_at, updated_at FROM content_history WHERE '
        . $where . ' ORDER BY created_at DESC, id DESC LIMIT ' . ($limit + 1);
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    $hasMore = count($rows) > $limit;
    if ($hasMore) array_pop($rows);

    $items = array_map('history_decode_row', $rows);
    $nextCursor = null;
    if ($hasMore && count($rows) > 0) {
        $last = $rows[count($rows) - 1];
        $raw = json_encode(['createdAt' => $last['created_at'], 'id' => $last['id']]);
        $nextCursor = rtrim(strtr(base64_encode((string)$raw), '+/', '-_'), '=');
    }

    json_response(['ok' => true, 'items' => $items, 'hasMore' => $hasMore, 'nextCursor' => $nextCursor]);
}

function history_create(string $userId): never
{
    $body = json_body();
    $payload = history_validate_payload($body);
    if ($payload === null) {
        json_response(['ok' => false, 'error' => ['code' => 'HISTORY_INVALID', 'message' => 'ساختار محتوای ذخیره‌شده معتبر نیست.']], 422);
    }

    $id = uuid_v4();
    $stmt = db()->prepare(
        'INSERT INTO content_history (id, user_id, product, content, created_at, updated_at)
         VALUES (:id, :user_id, :product, :content, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
    );
    $stmt->execute(['id' => $id, 'user_id' => $userId, 'product' => $payload['product'], 'content' => $payload['content']]);

    json_response(['ok' => true, 'item' => [
        'id' => $id,
        'product' => json_decode($payload['product'], true),
        'content' => json_decode($payload['content'], true),
        'created_at' => gmdate('Y-m-d H:i:s'),
    ]], 201);
}

function history_update(string $userId, string $id): never
{
    $body = json_body();
    $payload = history_validate_payload($body, false);
    if ($payload === null || $payload === []) {
        json_response(['ok' => false, 'error' => ['code' => 'HISTORY_INVALID', 'message' => 'ساختار تغییرات معتبر نیست.']], 422);
    }

    try {
        db()->beginTransaction();
        $read = db()->prepare('SELECT product, content FROM content_history WHERE id = :id AND user_id = :user_id LIMIT 1 FOR UPDATE');
        $read->execute(['id' => $id, 'user_id' => $userId]);
        $current = $read->fetch();
        if (!$current) {
            db()->rollBack();
            json_response(['ok' => false, 'error' => ['code' => 'HISTORY_NOT_FOUND', 'message' => 'محتوای موردنظر پیدا نشد.']], 404);
        }

        if (isset($payload['content']) && $payload['content'] !== $current['content']) {
            $version = db()->prepare(
                'INSERT INTO content_versions (id, history_id, user_id, content, created_at)
                 VALUES (:id, :history_id, :user_id, :content, UTC_TIMESTAMP())'
            );
            $version->execute([
                'id' => uuid_v4(),
                'history_id' => $id,
                'user_id' => $userId,
                'content' => $current['content'],
            ]);
        }

        $sets = [];
        $params = ['id' => $id, 'user_id' => $userId];
        if (isset($payload['product'])) {
            $sets[] = 'product = :product';
            $params['product'] = $payload['product'];
        }
        if (isset($payload['content'])) {
            $sets[] = 'content = :content';
            $params['content'] = $payload['content'];
        }
        $sets[] = 'updated_at = UTC_TIMESTAMP()';

        $update = db()->prepare('UPDATE content_history SET ' . implode(', ', $sets) . ' WHERE id = :id AND user_id = :user_id');
        $update->execute($params);
        db()->commit();

        json_response(['ok' => true, 'saved' => true, 'versionCreated' => isset($payload['content']) && $payload['content'] !== $current['content']]);
    } catch (Throwable $error) {
        if (db()->inTransaction()) db()->rollBack();
        throw $error;
    }
}

function history_versions(string $userId, string $historyId): never
{
    $owner = db()->prepare('SELECT id FROM content_history WHERE id = :id AND user_id = :user_id LIMIT 1');
    $owner->execute(['id' => $historyId, 'user_id' => $userId]);
    if (!$owner->fetch()) {
        json_response(['ok' => false, 'error' => ['code' => 'HISTORY_NOT_FOUND', 'message' => 'محتوای موردنظر پیدا نشد.']], 404);
    }

    $stmt = db()->prepare(
        'SELECT id, history_id, content, created_at FROM content_versions
         WHERE history_id = :history_id AND user_id = :user_id
         ORDER BY created_at DESC, id DESC LIMIT 10'
    );
    $stmt->execute(['history_id' => $historyId, 'user_id' => $userId]);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$row) $row['content'] = json_decode((string)$row['content'], true) ?? [];
    unset($row);
    json_response(['ok' => true, 'versions' => $rows]);
}

function history_restore(string $userId, string $historyId, string $versionId): never
{
    try {
        db()->beginTransaction();
        $currentStmt = db()->prepare('SELECT content FROM content_history WHERE id = :id AND user_id = :user_id LIMIT 1 FOR UPDATE');
        $currentStmt->execute(['id' => $historyId, 'user_id' => $userId]);
        $current = $currentStmt->fetch();
        if (!$current) {
            db()->rollBack();
            json_response(['ok' => false, 'error' => ['code' => 'HISTORY_NOT_FOUND', 'message' => 'محتوای موردنظر پیدا نشد.']], 404);
        }

        $versionStmt = db()->prepare(
            'SELECT content FROM content_versions WHERE id = :version_id AND history_id = :history_id AND user_id = :user_id LIMIT 1'
        );
        $versionStmt->execute(['version_id' => $versionId, 'history_id' => $historyId, 'user_id' => $userId]);
        $version = $versionStmt->fetch();
        if (!$version) {
            db()->rollBack();
            json_response(['ok' => false, 'error' => ['code' => 'VERSION_NOT_FOUND', 'message' => 'نسخه انتخاب‌شده پیدا نشد.']], 404);
        }

        $snapshot = db()->prepare(
            'INSERT INTO content_versions (id, history_id, user_id, content, created_at)
             VALUES (:id, :history_id, :user_id, :content, UTC_TIMESTAMP())'
        );
        $snapshot->execute(['id' => uuid_v4(), 'history_id' => $historyId, 'user_id' => $userId, 'content' => $current['content']]);

        $update = db()->prepare('UPDATE content_history SET content = :content, updated_at = UTC_TIMESTAMP() WHERE id = :id AND user_id = :user_id');
        $update->execute(['content' => $version['content'], 'id' => $historyId, 'user_id' => $userId]);
        db()->commit();

        json_response(['ok' => true, 'restored' => true]);
    } catch (Throwable $error) {
        if (db()->inTransaction()) db()->rollBack();
        throw $error;
    }
}
