<?php
declare(strict_types=1);

namespace App\Content;

use PDO;

final class ContentRepository
{
    public function __construct(private PDO $db)
    {
    }

    public function list(string $userId, int $limit, int $offset, ?string $type): array
    {
        $sql = 'SELECT id, brand_id, title, content_type, content_json, review_status,
                       folder_name, tags_json, is_favorite, created_at, updated_at
                FROM content_items WHERE user_id = :user_id AND deleted_at IS NULL';
        $params = ['user_id' => $userId];
        if ($type !== null && $type !== '') {
            $sql .= ' AND content_type = :content_type';
            $params['content_type'] = $type;
        }
        $sql .= ' ORDER BY updated_at DESC LIMIT ' . $limit . ' OFFSET ' . $offset;
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function create(string $userId, array $data): string
    {
        $id = self::uuid();
        $brandId = isset($data['brand_id']) && is_string($data['brand_id']) ? $data['brand_id'] : null;
        if ($brandId !== null) {
            $check = $this->db->prepare('SELECT 1 FROM brands WHERE id = :id AND user_id = :user_id');
            $check->execute(['id' => $brandId, 'user_id' => $userId]);
            if (!$check->fetchColumn()) {
                throw new \DomainException('brand_not_found');
            }
        }

        $content = $data['content'] ?? null;
        if (!is_array($content)) {
            throw new \InvalidArgumentException('content_object_required');
        }
        $plain = isset($data['plain_text']) && is_string($data['plain_text'])
            ? mb_substr($data['plain_text'], 0, 100000) : null;
        $title = isset($data['title']) && is_string($data['title'])
            ? mb_substr(trim($data['title']), 0, 240) : null;
        $type = isset($data['content_type']) && is_string($data['content_type'])
            ? trim($data['content_type']) : '';
        if ($type === '' || strlen($type) > 60) {
            throw new \InvalidArgumentException('content_type_invalid');
        }

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                "INSERT INTO content_items
                 (id, user_id, brand_id, title, content_type, prompt_data, content_json, plain_text, review_status)
                 VALUES (:id, :user_id, :brand_id, :title, :content_type, :prompt_data, :content_json, :plain_text, 'draft')"
            );
            $stmt->execute([
                'id' => $id, 'user_id' => $userId, 'brand_id' => $brandId, 'title' => $title,
                'content_type' => $type,
                'prompt_data' => isset($data['prompt']) ? json_encode($data['prompt'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) : null,
                'content_json' => json_encode($content, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                'plain_text' => $plain,
            ]);
            $version = $this->db->prepare(
                'INSERT INTO content_versions (content_id, user_id, version_number, content_json, plain_text, change_note)
                 VALUES (:content_id, :user_id, 1, :content_json, :plain_text, :change_note)'
            );
            $version->execute([
                'content_id' => $id, 'user_id' => $userId,
                'content_json' => json_encode($content, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                'plain_text' => $plain, 'change_note' => 'نسخه اولیه',
            ]);
            $this->db->commit();
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $e;
        }
        return $id;
    }

    public function find(string $userId, string $id): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT id, brand_id, title, content_type, content_json, plain_text, review_status,
                    folder_name, tags_json, is_favorite, created_at, updated_at
             FROM content_items WHERE id = :id AND user_id = :user_id AND deleted_at IS NULL LIMIT 1'
        );
        $stmt->execute(['id' => $id, 'user_id' => $userId]);
        return $stmt->fetch() ?: null;
    }

    public function update(string $userId, string $id, array $data): bool
    {
        $current = $this->find($userId, $id);
        if ($current === null) return false;
        $content = $data['content'] ?? json_decode($current['content_json'], true);
        if (!is_array($content)) throw new \InvalidArgumentException('content_object_required');
        $plain = isset($data['plain_text']) && is_string($data['plain_text'])
            ? mb_substr($data['plain_text'], 0, 100000) : $current['plain_text'];
        $title = isset($data['title']) && is_string($data['title'])
            ? mb_substr(trim($data['title']), 0, 240) : $current['title'];

        $this->db->beginTransaction();
        try {
            // Lock the parent row so concurrent edits serialize before version allocation.
            $parentLock = $this->db->prepare(
                'SELECT id FROM content_items WHERE id = :id AND user_id = :user_id AND deleted_at IS NULL FOR UPDATE'
            );
            $parentLock->execute(['id' => $id, 'user_id' => $userId]);
            if (!$parentLock->fetchColumn()) {
                $this->db->rollBack();
                return false;
            }
            $lock = $this->db->prepare('SELECT COALESCE(MAX(version_number), 0) FROM content_versions WHERE content_id = :id');
            $lock->execute(['id' => $id]);
            $next = (int) $lock->fetchColumn() + 1;
            $json = json_encode($content, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
            $update = $this->db->prepare(
                'UPDATE content_items SET title = :title, content_json = :content_json,
                 plain_text = :plain_text, updated_at = UTC_TIMESTAMP()
                 WHERE id = :id AND user_id = :user_id AND deleted_at IS NULL'
            );
            $update->execute([
                'title' => $title, 'content_json' => $json, 'plain_text' => $plain,
                'id' => $id, 'user_id' => $userId,
            ]);
            $version = $this->db->prepare(
                'INSERT INTO content_versions (content_id, user_id, version_number, content_json, plain_text, change_note)
                 VALUES (:content_id, :user_id, :version_number, :content_json, :plain_text, :change_note)'
            );
            $version->execute([
                'content_id' => $id, 'user_id' => $userId, 'version_number' => $next,
                'content_json' => $json, 'plain_text' => $plain, 'change_note' => 'ویرایش محتوا',
            ]);
            $this->db->commit();
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $e;
        }
        return true;
    }

    public function softDelete(string $userId, string $id): bool
    {
        $stmt = $this->db->prepare(
            'UPDATE content_items SET deleted_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP()
             WHERE id = :id AND user_id = :user_id AND deleted_at IS NULL'
        );
        $stmt->execute(['id' => $id, 'user_id' => $userId]);
        return $stmt->rowCount() === 1;
    }

    private static function uuid(): string
    {
        $b = random_bytes(16); $b[6] = chr((ord($b[6]) & 15) | 64); $b[8] = chr((ord($b[8]) & 63) | 128);
        $h = bin2hex($b);
        return substr($h,0,8).'-'.substr($h,8,4).'-'.substr($h,12,4).'-'.substr($h,16,4).'-'.substr($h,20,12);
    }
}
