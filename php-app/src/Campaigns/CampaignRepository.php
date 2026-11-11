<?php
declare(strict_types=1);

namespace App\Campaigns;

use PDO;

final class CampaignRepository
{
    public function __construct(private PDO $db) {}

    public function list(string $userId): array
    {
        $stmt = $this->db->prepare(
            'SELECT id, name, objective, audience, channels_json, status, checklist_json,
                    starts_on, ends_on, created_at, updated_at
             FROM campaigns WHERE user_id = :user_id ORDER BY updated_at DESC'
        );
        $stmt->execute(['user_id' => $userId]);
        return $stmt->fetchAll();
    }

    public function create(string $userId, array $data): string
    {
        $name = isset($data['name']) && is_string($data['name']) ? trim($data['name']) : '';
        if ($name === '' || mb_strlen($name) > 200) throw new \InvalidArgumentException('campaign_name_invalid');
        $id = self::uuid();
        $stmt = $this->db->prepare(
            'INSERT INTO campaigns (id, user_id, name, objective, audience, channels_json, checklist_json, starts_on, ends_on)
             VALUES (:id, :user_id, :name, :objective, :audience, :channels, :checklist, :starts_on, :ends_on)'
        );
        $stmt->execute([
            'id' => $id, 'user_id' => $userId, 'name' => $name,
            'objective' => isset($data['objective']) && is_string($data['objective']) ? mb_substr($data['objective'],0,500) : null,
            'audience' => isset($data['audience']) && is_string($data['audience']) ? mb_substr($data['audience'],0,10000) : null,
            'channels' => self::jsonOrNull($data['channels'] ?? null),
            'checklist' => self::jsonOrNull($data['checklist'] ?? null),
            'starts_on' => self::dateOrNull($data['starts_on'] ?? null),
            'ends_on' => self::dateOrNull($data['ends_on'] ?? null),
        ]);
        return $id;
    }

    public function update(string $userId, string $id, array $data): bool
    {
        $existing = $this->db->prepare(
            'SELECT starts_on, ends_on FROM campaigns WHERE id = :id AND user_id = :user_id'
        );
        $existing->execute(['id' => $id, 'user_id' => $userId]);
        $current = $existing->fetch();
        if (!is_array($current)) return false;

        $fields = [];
        $params = ['id' => $id, 'user_id' => $userId];

        if (array_key_exists('name', $data)) {
            if (!is_string($data['name']) || trim($data['name']) === '' || mb_strlen(trim($data['name'])) > 200) {
                throw new \\InvalidArgumentException('campaign_name_invalid');
            }
            $fields[] = 'name = :name';
            $params['name'] = trim($data['name']);
        }
        foreach (['objective' => 500, 'audience' => 10000] as $field => $maxLength) {
            if (!array_key_exists($field, $data)) continue;
            if ($data[$field] !== null && !is_string($data[$field])) {
                throw new \\InvalidArgumentException($field . '_invalid');
            }
            $fields[] = $field . ' = :' . $field;
            $params[$field] = $data[$field] === null ? null : mb_substr(trim($data[$field]), 0, $maxLength);
        }
        foreach (['channels' => 'channels_json', 'checklist' => 'checklist_json'] as $input => $column) {
            if (!array_key_exists($input, $data)) continue;
            $fields[] = $column . ' = :' . $input;
            $params[$input] = self::jsonOrNull($data[$input]);
        }

        $startsOn = array_key_exists('starts_on', $data)
            ? self::dateOrNull($data['starts_on']) : $current['starts_on'];
        $endsOn = array_key_exists('ends_on', $data)
            ? self::dateOrNull($data['ends_on']) : $current['ends_on'];
        if ($startsOn !== null && $endsOn !== null && $endsOn < $startsOn) {
            throw new \\InvalidArgumentException('campaign_end_before_start');
        }
        if (array_key_exists('starts_on', $data)) {
            $fields[] = 'starts_on = :starts_on';
            $params['starts_on'] = $startsOn;
        }
        if (array_key_exists('ends_on', $data)) {
            $fields[] = 'ends_on = :ends_on';
            $params['ends_on'] = $endsOn;
        }

        if (!$fields) return true;
        $fields[] = 'updated_at = UTC_TIMESTAMP()';
        $stmt = $this->db->prepare(
            'UPDATE campaigns SET ' . implode(', ', $fields) . ' WHERE id = :id AND user_id = :user_id'
        );
        $stmt->execute($params);
        return true;
    }

    public function delete(string $userId, string $id): bool
    {
        $stmt = $this->db->prepare('DELETE FROM campaigns WHERE id = :id AND user_id = :user_id');
        $stmt->execute(['id' => $id, 'user_id' => $userId]);
        return $stmt->rowCount() === 1;
    }

    private static function jsonOrNull(mixed $value): ?string
    {
        return $value === null ? null : json_encode($value, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }

    private static function dateOrNull(mixed $value): ?string
    {
        if ($value === null || $value === '') return null;
        if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            throw new \InvalidArgumentException('date_must_be_yyyy_mm_dd');
        }
        $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        if (!$date || $date->format('Y-m-d') !== $value) throw new \InvalidArgumentException('date_invalid');
        return $value;
    }

    private static function uuid(): string
    {
        $b=random_bytes(16); $b[6]=chr((ord($b[6])&15)|64); $b[8]=chr((ord($b[8])&63)|128); $h=bin2hex($b);
        return substr($h,0,8).'-'.substr($h,8,4).'-'.substr($h,12,4).'-'.substr($h,16,4).'-'.substr($h,20,12);
    }
}
