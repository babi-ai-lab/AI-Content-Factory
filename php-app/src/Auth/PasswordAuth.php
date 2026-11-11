<?php
declare(strict_types=1);

namespace App\Auth;

use PDO;
use RuntimeException;

final class PasswordAuth
{
    public function __construct(private PDO $db)
    {
    }

    /**
     * Creates a pending account. Email verification delivery and activation
     * are deliberately separate steps and must be completed before launch.
     */
    public function register(string $email, string $password, ?string $displayName = null): string
    {
        $email = mb_strtolower(trim($email));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 254) {
            throw new RuntimeException('ایمیل معتبر نیست.');
        }
        if (strlen($password) < 12 || strlen($password) > 200) {
            throw new RuntimeException('رمز عبور باید حداقل ۱۲ نویسه داشته باشد.');
        }

        $id = self::uuid();
        $hash = password_hash($password, PASSWORD_DEFAULT);
        if (!is_string($hash)) {
            throw new RuntimeException('ساخت رمز عبور ناموفق بود.');
        }

        $statement = $this->db->prepare(
            'INSERT INTO users (id, email, password_hash, display_name, status)
             VALUES (:id, :email, :password_hash, :display_name, :status)'
        );
        $statement->execute([
            'id' => $id,
            'email' => $email,
            'password_hash' => $hash,
            'display_name' => $displayName !== null ? mb_substr(trim($displayName), 0, 120) : null,
            'status' => 'pending',
        ]);

        return $id;
    }

    public function login(string $email, string $password): array
    {
        $statement = $this->db->prepare(
            'SELECT id, email, password_hash, display_name, status
             FROM users WHERE email = :email LIMIT 1'
        );
        $statement->execute(['email' => mb_strtolower(trim($email))]);
        $user = $statement->fetch();

        // Keep the response identical for unknown users and incorrect passwords.
        if (!is_array($user) || !is_string($user['password_hash'] ?? null)
            || !password_verify($password, $user['password_hash'])) {
            throw new AuthenticationException('ایمیل یا رمز عبور صحیح نیست.');
        }
        if ($user['status'] !== 'active') {
            throw new AuthenticationException('ایمیل یا رمز عبور صحیح نیست.');
        }

        session_regenerate_id(true);
        $sessionId = session_id();
        $sessionHash = hash('sha256', $sessionId);
        $insert = $this->db->prepare(
            'INSERT INTO user_sessions (id, user_id, last_activity_at, expires_at)
             VALUES (:id, :user_id, UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY))'
        );
        $insert->execute(['id' => $sessionHash, 'user_id' => $user['id']]);

        $_SESSION['user_id'] = $user['id'];
        $_SESSION['_csrf'] = bin2hex(random_bytes(32));

        unset($user['password_hash'], $user['status']);
        return $user;
    }

    public function currentUser(): ?array
    {
        $userId = $_SESSION['user_id'] ?? null;
        if (!is_string($userId)) {
            return null;
        }

        $sessionHash = hash('sha256', session_id());
        $statement = $this->db->prepare(
            "SELECT u.id, u.email, u.display_name
             FROM users u
             INNER JOIN user_sessions s ON s.user_id = u.id
             WHERE u.id = :id AND u.status = 'active'
               AND s.id = :session_id AND s.expires_at > UTC_TIMESTAMP()
             LIMIT 1"
        );
        $statement->execute(['id' => $userId, 'session_id' => $sessionHash]);
        $user = $statement->fetch();

        if (!is_array($user)) {
            unset($_SESSION['user_id']);
            return null;
        }

        $touch = $this->db->prepare(
            'UPDATE user_sessions SET last_activity_at = UTC_TIMESTAMP(),
             expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY)
             WHERE id = :id AND user_id = :user_id'
        );
        $touch->execute(['id' => $sessionHash, 'user_id' => $userId]);

        return $user;
    }

    public function logout(): void
    {
        $userId = $_SESSION['user_id'] ?? null;
        $sessionHash = hash('sha256', session_id());

        if (is_string($userId)) {
            $statement = $this->db->prepare(
                'DELETE FROM user_sessions WHERE id = :id AND user_id = :user_id'
            );
            $statement->execute(['id' => $sessionHash, 'user_id' => $userId]);
        }

        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', [
                'expires' => time() - 42000,
                'path' => $params['path'] ?: '/',
                'domain' => $params['domain'],
                'secure' => (bool) $params['secure'],
                'httponly' => (bool) $params['httponly'],
                'samesite' => $params['samesite'] ?: 'Lax',
            ]);
        }
        session_destroy();
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
