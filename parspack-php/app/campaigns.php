<?php
declare(strict_types=1);

function campaign_decode(array $row): array
{
    foreach (['channels', 'stages'] as $field) {
        $row[$field] = json_decode((string)$row[$field], true) ?? [];
    }
    foreach (['budget_amount', 'spend_amount', 'revenue_amount'] as $field) $row[$field] = (float)$row[$field];
    foreach (['impressions', 'clicks', 'leads', 'conversions'] as $field) $row[$field] = (int)$row[$field];
    return $row;
}

function campaign_route(string $path, string $method): bool
{
    if ($path === '/api/campaigns') {
        $userId = require_user_id();
        if ($method === 'GET') campaign_list($userId);
        if ($method === 'POST') {
            require_csrf();
            campaign_create($userId);
        }
    }

    if (preg_match('#^/api/campaigns/([a-f0-9-]{36})$#i', $path, $matches)) {
        $userId = require_user_id();
        $id = strtolower($matches[1]);
        if ($method === 'PATCH') {
            require_csrf();
            campaign_update($userId, $id);
        }
        if ($method === 'DELETE') {
            require_csrf();
            $stmt = db()->prepare('DELETE FROM marketing_campaigns WHERE id = :id AND user_id = :user_id');
            $stmt->execute(['id' => $id, 'user_id' => $userId]);
            json_response(['ok' => true, 'deleted' => $stmt->rowCount() > 0]);
        }
    }

    if (preg_match('#^/api/campaigns/([a-f0-9-]{36})/content$#i', $path, $matches) && $method === 'POST') {
        require_csrf();
        $userId = require_user_id();
        campaign_link_content($userId, strtolower($matches[1]));
    }

    if (preg_match('#^/api/campaign-links/([a-f0-9-]{36})$#i', $path, $matches) && $method === 'DELETE') {
        require_csrf();
        $userId = require_user_id();
        $stmt = db()->prepare('DELETE FROM marketing_campaign_content WHERE id = :id AND user_id = :user_id');
        $stmt->execute(['id' => strtolower($matches[1]), 'user_id' => $userId]);
        json_response(['ok' => true, 'deleted' => $stmt->rowCount() > 0]);
    }

    return false;
}

function campaign_list(string $userId): never
{
    $campaignStmt = db()->prepare(
        'SELECT id, name, goal, audience, channels, status, stages, currency_label,
                budget_amount, spend_amount, impressions, clicks, leads, conversions,
                revenue_amount, created_at, updated_at
         FROM marketing_campaigns WHERE user_id = :user_id
         ORDER BY created_at DESC'
    );
    $campaignStmt->execute(['user_id' => $userId]);
    $campaigns = array_map('campaign_decode', $campaignStmt->fetchAll());

    $linkStmt = db()->prepare(
        'SELECT id, campaign_id, content_id, notes, created_at
         FROM marketing_campaign_content WHERE user_id = :user_id
         ORDER BY created_at DESC'
    );
    $linkStmt->execute(['user_id' => $userId]);
    $links = $linkStmt->fetchAll();

    $contentStmt = db()->prepare(
        'SELECT id, product, created_at FROM content_history
         WHERE user_id = :user_id ORDER BY created_at DESC LIMIT 50'
    );
    $contentStmt->execute(['user_id' => $userId]);
    $content = $contentStmt->fetchAll();
    foreach ($content as &$item) $item['product'] = json_decode((string)$item['product'], true) ?? [];
    unset($item);

    json_response(['ok' => true, 'campaigns' => $campaigns, 'links' => $links, 'content' => $content]);
}

function campaign_create(string $userId): never
{
    $body = json_body();
    $name = trim((string)($body['name'] ?? ''));
    $goal = trim((string)($body['goal'] ?? ''));
    $audience = trim((string)($body['audience'] ?? ''));
    $channels = $body['channels'] ?? [];

    if ($name === '' || mb_strlen($name, 'UTF-8') > 120 || $goal === '' || mb_strlen($goal, 'UTF-8') > 500
        || mb_strlen($audience, 'UTF-8') > 500 || !is_array($channels) || count($channels) > 8) {
        json_response(['ok' => false, 'error' => ['code' => 'CAMPAIGN_INVALID', 'message' => 'نام، هدف، مخاطب یا کانال‌های کمپین معتبر نیستند.']], 422);
    }

    $cleanChannels = [];
    foreach ($channels as $channel) {
        if (!is_string($channel) || mb_strlen(trim($channel), 'UTF-8') > 60) {
            json_response(['ok' => false, 'error' => ['code' => 'CAMPAIGN_INVALID', 'message' => 'یکی از کانال‌های کمپین معتبر نیست.']], 422);
        }
        $channel = trim($channel);
        if ($channel !== '' && !in_array($channel, $cleanChannels, true)) $cleanChannels[] = $channel;
    }

    $stages = [
        ['id' => 'brief', 'title' => 'تعیین هدف، پیشنهاد و پیام اصلی', 'done' => false],
        ['id' => 'plan', 'title' => 'طراحی برنامه و تقویم محتوا', 'done' => false],
        ['id' => 'produce', 'title' => 'تولید متن و محتوای کمپین', 'done' => false],
        ['id' => 'review', 'title' => 'بازبینی و تأیید محتوا', 'done' => false],
        ['id' => 'publish', 'title' => 'انتشار در کانال‌های انتخاب‌شده', 'done' => false],
        ['id' => 'measure', 'title' => 'بررسی نتایج و جمع‌بندی', 'done' => false],
    ];

    $id = uuid_v4();
    $stmt = db()->prepare(
        'INSERT INTO marketing_campaigns
         (id, user_id, name, goal, audience, channels, status, stages, created_at, updated_at)
         VALUES (:id, :user_id, :name, :goal, :audience, :channels, :status, :stages, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
    );
    $stmt->execute([
        'id' => $id, 'user_id' => $userId, 'name' => $name, 'goal' => $goal,
        'audience' => $audience,
        'channels' => json_encode($cleanChannels, JSON_UNESCAPED_UNICODE),
        'status' => 'draft',
        'stages' => json_encode($stages, JSON_UNESCAPED_UNICODE),
    ]);

    $read = db()->prepare('SELECT * FROM marketing_campaigns WHERE id = :id AND user_id = :user_id LIMIT 1');
    $read->execute(['id' => $id, 'user_id' => $userId]);
    json_response(['ok' => true, 'campaign' => campaign_decode($read->fetch())], 201);
}

function campaign_update(string $userId, string $id): never
{
    $body = json_body();
    $allowed = ['status', 'stages', 'currency_label', 'budget_amount', 'spend_amount', 'impressions', 'clicks', 'leads', 'conversions', 'revenue_amount'];
    $changes = array_intersect_key($body, array_flip($allowed));
    if ($changes === []) {
        json_response(['ok' => false, 'error' => ['code' => 'CAMPAIGN_NO_CHANGES', 'message' => 'تغییری برای ذخیره ارسال نشده است.']], 422);
    }

    $sets = [];
    $params = ['id' => $id, 'user_id' => $userId];

    if (array_key_exists('status', $changes)) {
        if (!in_array($changes['status'], ['draft', 'active', 'paused', 'completed'], true)) {
            json_response(['ok' => false, 'error' => ['code' => 'CAMPAIGN_STATUS_INVALID', 'message' => 'وضعیت کمپین معتبر نیست.']], 422);
        }
        $sets[] = 'status = :status'; $params['status'] = $changes['status'];
    }

    if (array_key_exists('stages', $changes)) {
        if (!is_array($changes['stages']) || count($changes['stages']) > 20) {
            json_response(['ok' => false, 'error' => ['code' => 'CAMPAIGN_STAGES_INVALID', 'message' => 'مراحل کمپین معتبر نیستند.']], 422);
        }
        foreach ($changes['stages'] as $stage) {
            if (!is_array($stage) || !isset($stage['id'], $stage['title'], $stage['done'])
                || !is_string($stage['id']) || !is_string($stage['title']) || !is_bool($stage['done'])
                || mb_strlen($stage['title'], 'UTF-8') > 160) {
                json_response(['ok' => false, 'error' => ['code' => 'CAMPAIGN_STAGES_INVALID', 'message' => 'ساختار یکی از مراحل کمپین معتبر نیست.']], 422);
            }
        }
        $sets[] = 'stages = :stages';
        $params['stages'] = json_encode(array_values($changes['stages']), JSON_UNESCAPED_UNICODE);
    }

    if (array_key_exists('currency_label', $changes)) {
        if (!is_string($changes['currency_label']) || mb_strlen(trim($changes['currency_label']), 'UTF-8') > 20) {
            json_response(['ok' => false, 'error' => ['code' => 'CAMPAIGN_CURRENCY_INVALID', 'message' => 'واحد پول معتبر نیست.']], 422);
        }
        $sets[] = 'currency_label = :currency_label'; $params['currency_label'] = trim($changes['currency_label']);
    }

    foreach (['budget_amount', 'spend_amount', 'revenue_amount'] as $field) {
        if (array_key_exists($field, $changes)) {
            if (!is_numeric($changes[$field]) || !is_finite((float)$changes[$field]) || (float)$changes[$field] < 0 || (float)$changes[$field] > 999999999999.99) {
                json_response(['ok' => false, 'error' => ['code' => 'CAMPAIGN_METRIC_INVALID', 'message' => 'مقادیر مالی باید عددی و نامنفی باشند.']], 422);
            }
            $sets[] = $field . ' = :' . $field; $params[$field] = (float)$changes[$field];
        }
    }

    foreach (['impressions', 'clicks', 'leads', 'conversions'] as $field) {
        if (array_key_exists($field, $changes)) {
            if (!is_numeric($changes[$field]) || (float)$changes[$field] < 0 || floor((float)$changes[$field]) !== (float)$changes[$field] || (float)$changes[$field] > 9000000000000000) {
                json_response(['ok' => false, 'error' => ['code' => 'CAMPAIGN_METRIC_INVALID', 'message' => 'تعدادها باید عدد صحیح و نامنفی باشند.']], 422);
            }
            $sets[] = $field . ' = :' . $field; $params[$field] = (int)$changes[$field];
        }
    }

    $sets[] = 'updated_at = UTC_TIMESTAMP()';
    $stmt = db()->prepare('UPDATE marketing_campaigns SET ' . implode(', ', $sets) . ' WHERE id = :id AND user_id = :user_id');
    $stmt->execute($params);

    $read = db()->prepare('SELECT * FROM marketing_campaigns WHERE id = :id AND user_id = :user_id LIMIT 1');
    $read->execute(['id' => $id, 'user_id' => $userId]);
    $campaign = $read->fetch();
    if (!$campaign) json_response(['ok' => false, 'error' => ['code' => 'CAMPAIGN_NOT_FOUND', 'message' => 'کمپین پیدا نشد.']], 404);

    json_response(['ok' => true, 'campaign' => campaign_decode($campaign)]);
}

function campaign_link_content(string $userId, string $campaignId): never
{
    $body = json_body();
    $contentId = strtolower(trim((string)($body['content_id'] ?? '')));
    if (!preg_match('/^[a-f0-9-]{36}$/i', $contentId)) {
        json_response(['ok' => false, 'error' => ['code' => 'CONTENT_ID_INVALID', 'message' => 'شناسه محتوا معتبر نیست.']], 422);
    }

    $campaign = db()->prepare('SELECT id FROM marketing_campaigns WHERE id = :id AND user_id = :user_id LIMIT 1');
    $campaign->execute(['id' => $campaignId, 'user_id' => $userId]);
    $content = db()->prepare('SELECT id FROM content_history WHERE id = :id AND user_id = :user_id LIMIT 1');
    $content->execute(['id' => $contentId, 'user_id' => $userId]);
    if (!$campaign->fetch() || !$content->fetch()) {
        json_response(['ok' => false, 'error' => ['code' => 'CAMPAIGN_LINK_SCOPE_INVALID', 'message' => 'کمپین یا محتوای انتخاب‌شده در حساب شما پیدا نشد.']], 404);
    }

    $id = uuid_v4();
    try {
        $stmt = db()->prepare(
            'INSERT INTO marketing_campaign_content (id, user_id, campaign_id, content_id, notes, created_at)
             VALUES (:id, :user_id, :campaign_id, :content_id, :notes, UTC_TIMESTAMP())'
        );
        $stmt->execute(['id' => $id, 'user_id' => $userId, 'campaign_id' => $campaignId, 'content_id' => $contentId, 'notes' => '']);
    } catch (PDOException $error) {
        if ((string)$error->getCode() === '23000') {
            json_response(['ok' => false, 'error' => ['code' => 'CONTENT_ALREADY_LINKED', 'message' => 'این محتوا قبلاً به همین کمپین اضافه شده است.']], 409);
        }
        throw $error;
    }

    json_response(['ok' => true, 'link' => ['id' => $id, 'campaign_id' => $campaignId, 'content_id' => $contentId, 'notes' => '', 'created_at' => gmdate('Y-m-d H:i:s')]], 201);
}
