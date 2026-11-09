<?php
declare(strict_types=1);

function brand_profile_fields(): array
{
    return [
        'brandName' => 120, 'tagline' => 160, 'audience' => 200,
        'valueProposition' => 320, 'voice' => 120, 'preferredTerms' => 300,
        'avoidTerms' => 300, 'cta' => 180, 'verifiedFacts' => 2000,
        'proofPoints' => 1200, 'faq' => 2000, 'prohibitedClaims' => 1200,
    ];
}

function brand_profile_route(string $path, string $method): bool
{
    if ($path === '/api/brands') {
        $userId = require_user_id();
        if ($method === 'GET') brand_profile_list($userId);
        if ($method === 'POST') {
            require_csrf();
            brand_profile_create($userId);
        }
    }
    if (preg_match('#^/api/brands/([a-f0-9-]{36})$#i', $path, $matches)) {
        $userId = require_user_id();
        $id = strtolower($matches[1]);
        if ($method === 'PATCH') {
            require_csrf();
            brand_profile_update($userId, $id);
        }
        if ($method === 'DELETE') {
            require_csrf();
            brand_profile_delete($userId, $id);
        }
    }
    if (preg_match('#^/api/brands/([a-f0-9-]{36})/default$#i', $path, $matches) && $method === 'POST') {
        require_csrf();
        $userId = require_user_id();
        brand_profile_set_default($userId, strtolower($matches[1]));
    }
    return false;
}

function brand_profile_list(string $userId): never
{
    $stmt = db()->prepare(
        'SELECT id, name, business_type, profile_data, is_default, created_at, updated_at
         FROM brand_profiles WHERE user_id = :user_id ORDER BY is_default DESC, updated_at DESC'
    );
    $stmt->execute(['user_id' => $userId]);
    $items = $stmt->fetchAll();
    foreach ($items as &$item) {
        $item['profile_data'] = json_decode((string)$item['profile_data'], true) ?? [];
        $item['is_default'] = (bool)$item['is_default'];
    }
    unset($item);
    json_response(['ok' => true, 'profiles' => $items, 'limit' => 10]);
}

function brand_profile_validate(array $body): ?array
{
    $name = trim((string)($body['name'] ?? $body['brandName'] ?? ''));
    $businessType = (string)($body['business_type'] ?? $body['businessType'] ?? 'other');
    $allowed = ['retail', 'services', 'restaurant', 'real_estate', 'construction', 'education', 'fitness', 'personal_brand', 'other'];
    if ($name === '' || mb_strlen($name, 'UTF-8') > 160 || !in_array($businessType, $allowed, true)) return null;

    $raw = $body['profile_data'] ?? $body['profileData'] ?? $body;
    if (!is_array($raw)) return null;
    $profile = [];
    foreach (brand_profile_fields() as $field => $limit) {
        $value = $raw[$field] ?? '';
        if (!is_string($value)) return null;
        $value = trim($value);
        if (mb_strlen($value, 'UTF-8') > $limit) return null;
        $profile[$field] = $value;
    }
    $profile['brandName'] = $name;
    return ['name' => $name, 'businessType' => $businessType, 'profile' => $profile];
}

function brand_profile_create(string $userId): never
{
    $body = json_body();
    $valid = brand_profile_validate($body);
    if ($valid === null) json_response(['ok' => false, 'error' => ['code' => 'BRAND_PROFILE_INVALID', 'message' => 'اطلاعات پروفایل برند معتبر نیست.']], 422);

    try {
        db()->beginTransaction();
        $owner = db()->prepare('SELECT id FROM users WHERE id = :user_id LIMIT 1 FOR UPDATE');
        $owner->execute(['user_id' => $userId]);
        if (!$owner->fetch()) {
            db()->rollBack();
            json_response(['ok' => false, 'error' => ['code' => 'AUTH_REQUIRED', 'message' => 'حساب کاربری معتبر نیست.']], 401);
        }

        $count = db()->prepare('SELECT COUNT(*) FROM brand_profiles WHERE user_id = :user_id');
        $count->execute(['user_id' => $userId]);
        $profileCount = (int)$count->fetchColumn();
        if ($profileCount >= 10) {
            db()->rollBack();
            json_response(['ok' => false, 'error' => ['code' => 'BRAND_PROFILE_LIMIT', 'message' => 'حداکثر ۱۰ پروفایل برند می‌توانی داشته باشی.']], 409);
        }

        $id = uuid_v4();
        $default = $profileCount === 0 ? 1 : 0;
        $insert = db()->prepare(
            'INSERT INTO brand_profiles (id, user_id, name, business_type, profile_data, is_default, created_at, updated_at)
             VALUES (:id, :user_id, :name, :business_type, :profile_data, :is_default, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
        );
        $insert->execute([
            'id' => $id, 'user_id' => $userId, 'name' => $valid['name'],
            'business_type' => $valid['businessType'],
            'profile_data' => json_encode($valid['profile'], JSON_UNESCAPED_UNICODE),
            'is_default' => $default,
        ]);
        db()->commit();
        json_response(['ok' => true, 'id' => $id, 'is_default' => (bool)$default], 201);
    } catch (Throwable $error) {
        if (db()->inTransaction()) db()->rollBack();
        throw $error;
    }
}

function brand_profile_update(string $userId, string $id): never
{
    $valid = brand_profile_validate(json_body());
    if ($valid === null) json_response(['ok' => false, 'error' => ['code' => 'BRAND_PROFILE_INVALID', 'message' => 'اطلاعات پروفایل برند معتبر نیست.']], 422);
    $stmt = db()->prepare(
        'UPDATE brand_profiles SET name = :name, business_type = :business_type,
         profile_data = :profile_data, updated_at = UTC_TIMESTAMP()
         WHERE id = :id AND user_id = :user_id'
    );
    $stmt->execute([
        'name' => $valid['name'], 'business_type' => $valid['businessType'],
        'profile_data' => json_encode($valid['profile'], JSON_UNESCAPED_UNICODE),
        'id' => $id, 'user_id' => $userId,
    ]);
    if ($stmt->rowCount() === 0) {
        $check = db()->prepare('SELECT id FROM brand_profiles WHERE id = :id AND user_id = :user_id');
        $check->execute(['id' => $id, 'user_id' => $userId]);
        if (!$check->fetch()) json_response(['ok' => false, 'error' => ['code' => 'BRAND_PROFILE_NOT_FOUND', 'message' => 'پروفایل برند پیدا نشد.']], 404);
    }
    json_response(['ok' => true, 'saved' => true]);
}

function brand_profile_set_default(string $userId, string $id): never
{
    try {
        db()->beginTransaction();
        $check = db()->prepare('SELECT id FROM brand_profiles WHERE id = :id AND user_id = :user_id LIMIT 1 FOR UPDATE');
        $check->execute(['id' => $id, 'user_id' => $userId]);
        if (!$check->fetch()) {
            db()->rollBack();
            json_response(['ok' => false, 'error' => ['code' => 'BRAND_PROFILE_NOT_FOUND', 'message' => 'پروفایل برند پیدا نشد.']], 404);
        }
        $clear = db()->prepare('UPDATE brand_profiles SET is_default = 0 WHERE user_id = :user_id');
        $clear->execute(['user_id' => $userId]);
        $set = db()->prepare('UPDATE brand_profiles SET is_default = 1, updated_at = UTC_TIMESTAMP() WHERE id = :id AND user_id = :user_id');
        $set->execute(['id' => $id, 'user_id' => $userId]);
        db()->commit();
        json_response(['ok' => true, 'defaultId' => $id]);
    } catch (Throwable $error) {
        if (db()->inTransaction()) db()->rollBack();
        throw $error;
    }
}

function brand_profile_delete(string $userId, string $id): never
{
    try {
        db()->beginTransaction();
        $check = db()->prepare('SELECT is_default FROM brand_profiles WHERE id = :id AND user_id = :user_id LIMIT 1 FOR UPDATE');
        $check->execute(['id' => $id, 'user_id' => $userId]);
        $profile = $check->fetch();
        if (!$profile) {
            db()->rollBack();
            json_response(['ok' => false, 'error' => ['code' => 'BRAND_PROFILE_NOT_FOUND', 'message' => 'پروفایل برند پیدا نشد.']], 404);
        }
        $delete = db()->prepare('DELETE FROM brand_profiles WHERE id = :id AND user_id = :user_id');
        $delete->execute(['id' => $id, 'user_id' => $userId]);

        if ((int)$profile['is_default'] === 1) {
            $next = db()->prepare('SELECT id FROM brand_profiles WHERE user_id = :user_id ORDER BY updated_at DESC LIMIT 1');
            $next->execute(['user_id' => $userId]);
            $nextId = $next->fetchColumn();
            if (is_string($nextId)) {
                $set = db()->prepare('UPDATE brand_profiles SET is_default = 1 WHERE id = :id AND user_id = :user_id');
                $set->execute(['id' => $nextId, 'user_id' => $userId]);
            }
        }
        db()->commit();
        json_response(['ok' => true, 'deleted' => true]);
    } catch (Throwable $error) {
        if (db()->inTransaction()) db()->rollBack();
        throw $error;
    }
}
