<?php
declare(strict_types=1);

namespace App\Core;

use PDO;

final class RateLimiter
{
    public function __construct(private PDO $db) {}

    /**
     * Fixed-window limiter backed by an atomic MySQL upsert.
     * Returns true when the caller is within the configured limit.
     */
    public function allow(string $scope, string $clientKey, int $limit, int $windowMinutes): bool
    {
        $key = hash('sha256', $scope . ':' . $clientKey);
        $minutes = max(1, min(1440, $windowMinutes));
        $stmt = $this->db->prepare(
            'INSERT INTO rate_limit_buckets (bucket_key, window_started_at, request_count, expires_at)
             VALUES (:bucket_key, UTC_TIMESTAMP(), 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ' . $minutes . ' MINUTE))
             ON DUPLICATE KEY UPDATE
               request_count = IF(window_started_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ' . $minutes . ' MINUTE), 1, request_count + 1),
               window_started_at = IF(window_started_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ' . $minutes . ' MINUTE), UTC_TIMESTAMP(), window_started_at),
               expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ' . ($minutes + 5) . ' MINUTE)'
        );
        $stmt->execute(['bucket_key' => $key]);
        $read = $this->db->prepare('SELECT request_count FROM rate_limit_buckets WHERE bucket_key = :bucket_key');
        $read->execute(['bucket_key' => $key]);
        return (int) $read->fetchColumn() <= $limit;
    }
}
