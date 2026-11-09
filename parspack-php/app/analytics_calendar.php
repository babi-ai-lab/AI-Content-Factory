<?php
declare(strict_types=1);

function analytics_calendar_route(string $path, string $method): bool
{
    if ($path === '/api/analytics' && $method === 'GET') {
        $userId = require_user_id();
        analytics_summary($userId);
    }
    if ($path === '/api/calendar/ics' && $method === 'GET') {
        $userId = require_user_id();
        calendar_export_ics($userId);
    }
    if ($path === '/api/calendar' && $method === 'GET') {
        $userId = require_user_id();
        calendar_range($userId);
    }
    return false;
}

function analytics_summary(string $userId): never
{
    $period = (string)($_GET['period'] ?? '30');
    if (!in_array($period, ['7', '30', 'all'], true)) {
        json_response(['ok' => false, 'error' => ['code' => 'ANALYTICS_PERIOD_INVALID', 'message' => 'بازه تحلیل معتبر نیست.']], 422);
    }

    $filter = '';
    $params = ['user_id' => $userId];
    if ($period !== 'all') {
        $filter = ' AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ' . (int)$period . ' DAY)';
    }

    $statsStmt = db()->prepare(
        "SELECT
          COUNT(*) AS entries,
          SUM(CASE WHEN COALESCE(JSON_UNQUOTE(JSON_EXTRACT(content, '$.caption')), '') <> '' THEN 1 ELSE 0 END) AS captions,
          SUM(CASE WHEN COALESCE(JSON_UNQUOTE(JSON_EXTRACT(content, '$.reel')), '') <> '' THEN 1 ELSE 0 END) AS reels,
          SUM(CASE WHEN JSON_TYPE(JSON_EXTRACT(content, '$.stories')) = 'ARRAY' THEN JSON_LENGTH(JSON_EXTRACT(content, '$.stories')) ELSE 0 END) AS stories,
          SUM(CASE WHEN COALESCE(JSON_UNQUOTE(JSON_EXTRACT(content, '$.ad')), '') <> '' THEN 1 ELSE 0 END) AS ads,
          SUM(CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(product, '$._factoryMeta.favorite')) = 'true' THEN 1 ELSE 0 END) AS favorites,
          COUNT(DISTINCT COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(product, '$._factoryMeta.folder')), ''), 'عمومی')) AS folders
         FROM content_history WHERE user_id = :user_id" . $filter
    );
    $statsStmt->execute($params);
    $stats = $statsStmt->fetch() ?: [];

    $trend = [];
    $maxDaily = 1;
    $zone = new DateTimeZone('+03:30');
    $today = new DateTimeImmutable('today', $zone);
    for ($offset = 6; $offset >= 0; $offset--) {
        $day = $today->modify('-' . $offset . ' days');
        $startUtc = $day->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
        $endUtc = $day->modify('+1 day')->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
        $trendSql = 'SELECT COUNT(*) FROM content_history WHERE user_id = :user_id AND created_at >= :start_utc AND created_at < :end_utc';
        if ($period !== 'all') $trendSql .= ' AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ' . (int)$period . ' DAY)';
        $trendStmt = db()->prepare($trendSql);
        $trendStmt->execute(['user_id' => $userId, 'start_utc' => $startUtc, 'end_utc' => $endUtc]);
        $count = (int)$trendStmt->fetchColumn();
        $maxDaily = max($maxDaily, $count);
        $trend[] = ['key' => $day->format('Y-m-d'), 'count' => $count];
    }

    $businessStmt = db()->prepare(
        "SELECT COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(product, '$.businessType')), ''), 'other') AS business_type,
                COUNT(*) AS count
         FROM content_history WHERE user_id = :user_id" . $filter . "
         GROUP BY business_type ORDER BY count DESC"
    );
    $businessStmt->execute($params);
    $businessLabels = [
        'retail' => 'فروشگاه و خرده‌فروشی',
        'services' => 'خدمات و مشاغل',
        'restaurant' => 'رستوران و کافه',
        'real_estate' => 'املاک',
        'construction' => 'ساختمان و بازسازی',
        'education' => 'آموزش و دوره‌های آموزشی',
        'fitness' => 'ورزش و تناسب اندام',
        'personal_brand' => 'برند شخصی',
        'other' => 'سایر کسب‌وکارها',
    ];
    $byBusiness = [];
    foreach ($businessStmt->fetchAll() as $row) {
        $type = (string)$row['business_type'];
        $byBusiness[] = ['label' => $businessLabels[$type] ?? $businessLabels['other'], 'count' => (int)$row['count']];
    }

    $usageSql = 'SELECT COUNT(*) AS generations, COALESCE(SUM(prompt_tokens),0) AS prompt_tokens,
                        COALESCE(SUM(candidate_tokens),0) AS candidate_tokens, COALESCE(SUM(total_tokens),0) AS total_tokens
                 FROM ai_usage_events WHERE user_id = :user_id';
    if ($period !== 'all') $usageSql .= ' AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ' . (int)$period . ' DAY)';
    $usageStmt = db()->prepare($usageSql);
    $usageStmt->execute($params);
    $usage = $usageStmt->fetch() ?: [];

    $modelsSql = 'SELECT model, COUNT(*) AS generations, COALESCE(SUM(total_tokens),0) AS total_tokens
                  FROM ai_usage_events WHERE user_id = :user_id';
    if ($period !== 'all') $modelsSql .= ' AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ' . (int)$period . ' DAY)';
    $modelsSql .= ' GROUP BY model ORDER BY generations DESC';
    $modelsStmt = db()->prepare($modelsSql);
    $modelsStmt->execute($params);
    $models = array_map(static fn(array $row): array => [
        'model' => $row['model'],
        'generations' => (int)$row['generations'],
        'totalTokens' => (int)$row['total_tokens'],
    ], $modelsStmt->fetchAll());

    $captions = (int)($stats['captions'] ?? 0);
    $reels = (int)($stats['reels'] ?? 0);
    $stories = (int)($stats['stories'] ?? 0);
    $ads = (int)($stats['ads'] ?? 0);

    json_response([
        'ok' => true,
        'analytics' => [
            'entries' => ['length' => (int)($stats['entries'] ?? 0)],
            'totalPieces' => $captions + $reels + $stories + $ads,
            'favorites' => (int)($stats['favorites'] ?? 0),
            'folders' => (int)($stats['folders'] ?? 0),
            'maxDaily' => $maxDaily,
            'trend' => $trend,
            'formats' => [
                ['label' => 'کپشن', 'count' => $captions],
                ['label' => 'سناریوی ریلز', 'count' => $reels],
                ['label' => 'استوری', 'count' => $stories],
                ['label' => 'تبلیغ', 'count' => $ads],
            ],
            'byBusiness' => $byBusiness,
        ],
        'usage' => [
            'generations' => (int)($usage['generations'] ?? 0),
            'promptTokens' => (int)($usage['prompt_tokens'] ?? 0),
            'candidateTokens' => (int)($usage['candidate_tokens'] ?? 0),
            'totalTokens' => (int)($usage['total_tokens'] ?? 0),
            'models' => $models,
        ],
    ]);
}

function calendar_range(string $userId): never
{
    $start = trim((string)($_GET['start'] ?? ''));
    $end = trim((string)($_GET['end'] ?? ''));
    if ($start === '' || $end === '' || strlen($start) > 40 || strlen($end) > 40 || $start >= $end) {
        json_response(['ok' => false, 'error' => ['code' => 'CALENDAR_RANGE_INVALID', 'message' => 'بازه زمانی تقویم معتبر نیست.']], 422);
    }

    $stmt = db()->prepare(
        "SELECT id, product, content, created_at,
                JSON_UNQUOTE(JSON_EXTRACT(product, '$._factoryMeta.scheduledAt')) AS scheduled_at
         FROM content_history
         WHERE user_id = :user_id
           AND JSON_UNQUOTE(JSON_EXTRACT(product, '$._factoryMeta.scheduledAt')) >= :start_value
           AND JSON_UNQUOTE(JSON_EXTRACT(product, '$._factoryMeta.scheduledAt')) < :end_value
         ORDER BY scheduled_at ASC, id ASC"
    );
    $stmt->execute(['user_id' => $userId, 'start_value' => $start, 'end_value' => $end]);
    $items = $stmt->fetchAll();
    foreach ($items as &$item) {
        $item['product'] = json_decode((string)$item['product'], true) ?? [];
        $item['content'] = json_decode((string)$item['content'], true) ?? [];
    }
    unset($item);

    json_response(['ok' => true, 'items' => $items]);
}

function ics_escape(string $value): string
{
    $value = str_replace(["\\\\", ";", ","], ["\\\\\\\\", "\\;", "\\,"], $value);
    return str_replace(["\r\n", "\r", "\n"], "\\n", $value);
}

function ics_fold_line(string $line): string
{
    $characters = preg_split('//u', $line, -1, PREG_SPLIT_NO_EMPTY) ?: str_split($line);
    $result = '';
    $chunk = '';
    foreach ($characters as $character) {
        if ($chunk !== '' && strlen($chunk) + strlen($character) > 73) {
            $result .= $chunk . "\\r\\n ";
            $chunk = $character;
        } else {
            $chunk .= $character;
        }
    }
    return $result . $chunk;
}

function calendar_export_ics(string $userId): never
{
    $start = trim((string)($_GET['start'] ?? ''));
    $end = trim((string)($_GET['end'] ?? ''));
    if ($start === '' || $end === '' || strlen($start) > 40 || strlen($end) > 40 || $start >= $end) {
        json_response(['ok' => false, 'error' => ['code' => 'CALENDAR_RANGE_INVALID', 'message' => 'بازه زمانی تقویم معتبر نیست.']], 422);
    }

    $stmt = db()->prepare(
        "SELECT id, product, content,
                JSON_UNQUOTE(JSON_EXTRACT(product, '$._factoryMeta.scheduledAt')) AS scheduled_at
         FROM content_history
         WHERE user_id = :user_id
           AND JSON_UNQUOTE(JSON_EXTRACT(product, '$._factoryMeta.scheduledAt')) >= :start_value
           AND JSON_UNQUOTE(JSON_EXTRACT(product, '$._factoryMeta.scheduledAt')) < :end_value
         ORDER BY scheduled_at ASC, id ASC"
    );
    $stmt->execute(['user_id' => $userId, 'start_value' => $start, 'end_value' => $end]);

    $lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//ELTBabak//AI Content Factory//FA',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
    ];
    foreach ($stmt->fetchAll() as $row) {
        $product = json_decode((string)$row['product'], true) ?? [];
        $content = json_decode((string)$row['content'], true) ?? [];
        try {
            $date = new DateTimeImmutable((string)$row['scheduled_at']);
        } catch (Throwable $error) {
            continue;
        }
        $startUtc = $date->setTimezone(new DateTimeZone('UTC'))->format('Ymd\THis\Z');
        $title = (string)($product['name'] ?? $product['businessName'] ?? 'محتوای زمان‌بندی‌شده');
        $description = (string)($content['caption'] ?? '');
        $lines[] = 'BEGIN:VEVENT';
        $lines[] = 'UID:' . $row['id'] . '@eltbabak.ir';
        $lines[] = 'DTSTAMP:' . gmdate('Ymd\THis\Z');
        $lines[] = 'DTSTART:' . $startUtc;
        $lines[] = 'SUMMARY:' . ics_escape($title);
        if ($description !== '') $lines[] = 'DESCRIPTION:' . ics_escape($description);
        $lines[] = 'END:VEVENT';
    }
    $lines[] = 'END:VCALENDAR';

    header('Content-Type: text/calendar; charset=utf-8');
    header('Content-Disposition: attachment; filename="ai-content-factory-calendar.ics"');
    header('Cache-Control: private, no-store');
    echo implode("\r\n", $lines) . "\r\n";
    exit;
}
