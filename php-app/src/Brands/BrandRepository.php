<?php
declare(strict_types=1);

namespace App\Brands;

use PDO;

final class BrandRepository
{
    public function __construct(private PDO $db) {}

    public function list(string $userId): array
    {
        $stmt = $this->db->prepare(
            'SELECT id, name, business_type, profile_json, verified_facts_json,
                    evidence_json, faq_json, forbidden_claims_json, is_default, created_at, updated_at
             FROM brands WHERE user_id = :user_id ORDER BY is_default DESC, updated_at DESC'
        );
        $stmt->execute(['user_id' => $userId]);
        return $stmt->fetchAll();
    }

    public function create(string $userId, array $data): string
    {
        $name = isset($data['name']) && is_string($data['name']) ? trim($data['name']) : '';
        if ($name === '' || mb_strlen($name) > 160) throw new \InvalidArgumentException('brand_name_invalid');

        $count = $this->db->prepare('SELECT COUNT(*) FROM brands WHERE user_id = :user_id');
        $count->execute(['user_id' => $userId]);
        if ((int) $count->fetchColumn() >= 10) throw new \DomainException('brand_limit_reached');

        $id = self::uuid();
        $profile = is_array($data['profile'] ?? null) ? $data['profile'] : [];
        $stmt = $this->db->prepare(
            'INSERT INTO brands
             (id, user_id, name, business_type, profile_json, verified_facts_json, evidence_json, faq_json, forbidden_claims_json)
             VALUES (:id, :user_id, :name, :business_type, :profile, :facts, :evidence, :faq, :forbidden)'
        );
        $stmt->execute([
            'id' => $id, 'user_id' => $userId, 'name' => $name,
            'business_type' => isset($data['business_type']) && is_string($data['business_type']) ? mb_substr($data['business_type'],0,80) : null,
            'profile' => json_encode($profile, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            'facts' => self::jsonOrNull($data['verified_facts'] ?? null),
            'evidence' => self::jsonOrNull($data['evidence'] ?? null),
            'faq' => self::jsonOrNull($data['faq'] ?? null),
            'forbidden' => self::jsonOrNull($data['forbidden_claims'] ?? null),
        ]);
        return $id;
    }

    public function update(string $userId, string $id, array $data): bool
    {
        $existing = $this->db->prepare('SELECT id FROM brands WHERE id = :id AND user_id = :user_id');
        $existing->execute(['id' => $id, 'user_id' => $userId]);
        if (!$existing->fetchColumn()) return false;

        $fields = []; $params = ['id' => $id, 'user_id' => $userId];
        $map = ['name'=>'name','business_type'=>'business_type','profile'=>'profile_json',
            'verified_facts'=>'verified_facts_json','evidence'=>'evidence_json','faq'=>'faq_json','forbidden_claims'=>'forbidden_claims_json'];
        foreach ($map as $input => $column) {
            if (!array_key_exists($input, $data)) continue;
            $value = $data[$input];
            if ($input === 'name') {
                if (!is_string($value) || trim($value)==='' || mb_strlen($value)>160) throw new \InvalidArgumentException('brand_name_invalid');
                $value = trim($value);
            } elseif ($input === 'business_type') {
                $value = is_string($value) ? mb_substr($value,0,80) : null;
            } else {
                $value = $value === null ? null : json_encode($value, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
            }
            $fields[] = $column . ' = :' . $input; $params[$input] = $value;
        }
        if (!$fields) return true;
        $fields[] = 'updated_at = UTC_TIMESTAMP()';
        $stmt = $this->db->prepare('UPDATE brands SET '.implode(', ', $fields).' WHERE id = :id AND user_id = :user_id');
        $stmt->execute($params);
        return true;
    }

    public function delete(string $userId, string $id): bool
    {
        $stmt = $this->db->prepare('DELETE FROM brands WHERE id = :id AND user_id = :user_id');
        $stmt->execute(['id' => $id, 'user_id' => $userId]);
        return $stmt->rowCount() === 1;
    }

    private static function jsonOrNull(mixed $value): ?string
    {
        return $value === null ? null : json_encode($value, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }

    private static function uuid(): string
    {
        $b=random_bytes(16); $b[6]=chr((ord($b[6])&15)|64); $b[8]=chr((ord($b[8])&63)|128); $h=bin2hex($b);
        return substr($h,0,8).'-'.substr($h,8,4).'-'.substr($h,12,4).'-'.substr($h,16,4).'-'.substr($h,20,12);
    }
}
