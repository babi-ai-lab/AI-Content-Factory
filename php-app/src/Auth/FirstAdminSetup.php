<?php
declare(strict_types=1);

namespace App\Auth;

use DomainException;
use PDO;
use RuntimeException;

final class FirstAdminSetup
{
    public function __construct(private PDO $db)
    {
    }

    public function create(string $email, string $password, ?string $displayName = null): array
    {
        $email = strtolower(trim($email));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) {
            throw new RuntimeException('ایمیل معتبر نیست.');
        }
        if (strlen($password) < 12 || strlen($password) > 200) {
            throw new RuntimeException('رمز عبور باید حداقل ۱۲ نویسه داشته باشد.');
        }

        $name = $displayName !== null ? trim($displayName) : '';
        $name = $name === '' ? null : substr($name, 0, 120);
        $lockName = 'aicf_first_account_setup';

        $lock = $this->db->prepare('SELECT GET_LOCK(:lock_name, 10)');
        $lock->execute(['lock_name' => $lockName]);
        if ((int) $lock->fetchColumn() !== 1) {
            throw new RuntimeException('راه‌اندازی هم‌زمان است؛ چند لحظه بعد دوباره تلاش کنید.');
        }

        try {
            $this->db->beginTransaction();

            $count = (int) $this->db->query('SELECT COUNT(*) FROM users')->fetchColumn();
            if ($count !== 0) {
                throw new DomainException('راه‌اندازی اولیه قبلاً انجام شده است.');
            }

            $exists = $this->db->prepare('SELECT 1 FROM users WHERE email = :email LIMIT 1');
            $exists->execute(['email' => $email]);
            if ($exists->fetchColumn()) {
                throw new DomainException('این ایمیل قبلاً ثبت شده است.');
            }

            $hash = password_hash($password, PASSWORD_DEFAULT);
            if (!is_string($hash)) {
                throw new RuntimeException('ساخت رمز عبور ناموفق بود.');
            }

            $id = self::uuid();
            $insert = $this->db->prepare(
                "INSERT INTO users (id, email, password_hash, display_name, email_verified_at, status)
                 VALUES (:id, :email, :password_hash, :display_name, UTC_TIMESTAMP(), 'active')"
            );
            $insert->execute([
                'id' => $id,
                'email' => $email,
                'password_hash' => $hash,
                'display_name' => $name,
            ]);

            $this->db->commit();
            return ['id' => $id, 'email' => $email, 'display_name' => $name];
        } catch (\Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        } finally {
            $release = $this->db->prepare('SELECT RELEASE_LOCK(:lock_name)');
            $release->execute(['lock_name' => $lockName]);
        }
    }

    private static function uuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        $hex = bin2hex($bytes);
        return sprintf('%s-%s-%s-%s-%s',
            substr($hex, 0, 8), substr($hex, 8, 4), substr($hex, 12, 4),
            substr($hex, 16, 4), substr($hex, 20, 12)
        );
    }
}
