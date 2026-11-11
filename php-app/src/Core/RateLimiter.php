<?php
declare(strict_types=1);

namespace App\Core;

use PDO;
use RuntimeException;
use Throwable;

final class RateLimiter
{
    public function __construct(private PDO $db) {}

    /**
     * Fixed-window limiter using a row lock to keep concurrent requests safe.
     * Rejected requests do not increase the counter.
     */
    public function allow(string $scope, string $clientKey, int $limit, int $windowMinutes): bool
    {
        $key = hash('sha256', $scope . ':' . $clientKey);
        $limit = max(1, $limit);
        $minutes = max(1, min(1440, $windowMinutes));

        $this->db->beginTransaction();

        try {
            // Ensure the bucket exists. A zero count lets the locked check below
            // decide whether this request is allowed before consuming a slot.
            $insert = $this->db->prepare(
                'INSERT IGNORE INTO rate_limit_buckets
                    (bucket_key, window_started_at, request_count, expires_at)
                 VALUES
                    (:bucket_key, UTC_TIMESTAMP(), 0,
                     DATE_ADD(UTC_TIMESTAMP(), INTERVAL ' . ($minutes + 5) . ' MINUTE))'
            );
            $insert->execute(['bucket_key' => $key]);

            // Serialize requests for this bucket so simultaneous calls cannot
            // both consume the final available slot.
            $read = $this->db->prepare(
                'SELECT
                    request_count,
                    (window_started_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ' . $minutes . ' MINUTE)) AS window_expired
                 FROM rate_limit_buckets
                 WHERE bucket_key = :bucket_key
                 FOR UPDATE'
            );
            $read->execute(['bucket_key' => $key]);
            $bucket = $read->fetch(PDO::FETCH_ASSOC);

            if (!is_array($bucket)) {
                throw new RuntimeException('Rate limit bucket could not be loaded.');
            }

            $count = (int) $bucket['request_count'];
            $expired = (int) $bucket['window_expired'] === 1;

            if ($expired) {
                $update = $this->db->prepare(
                    'UPDATE rate_limit_buckets
                     SET request_count = 1,
                         window_started_at = UTC_TIMESTAMP(),
                         expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ' . ($minutes + 5) . ' MINUTE)
                     WHERE bucket_key = :bucket_key'
                );
                $update->execute(['bucket_key' => $key]);
                $allowed = true;
            } elseif ($count >= $limit) {
                // Do not consume or extend the window for a rejected request.
                $allowed = false;
            } else {
                $update = $this->db->prepare(
                    'UPDATE rate_limit_buckets
                     SET request_count = request_count + 1
                     WHERE bucket_key = :bucket_key'
                );
                $update->execute(['bucket_key' => $key]);
                $allowed = true;
            }

            $this->db->commit();
            return $allowed;
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }
    }
}
