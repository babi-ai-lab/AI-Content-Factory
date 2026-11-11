<?php
declare(strict_types=1);

namespace App\Core;

use PDO;
use PDOException;
use RuntimeException;

final class Database
{
    private static ?PDO $connection = null;

    public static function connection(array $config): PDO
    {
        if (self::$connection instanceof PDO) {
            return self::$connection;
        }

        $db = $config['database'] ?? [];
        foreach (['host', 'name', 'username', 'password'] as $key) {
            if (!array_key_exists($key, $db) || ($key !== 'password' && $db[$key] === '')) {
                throw new RuntimeException('Database configuration is incomplete.');
            }
        }

        $charset = $db['charset'] ?? 'utf8mb4';
        if (!preg_match('/^[a-zA-Z0-9_]+$/', $charset)) {
            throw new RuntimeException('Invalid database charset.');
        }

        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=%s',
            $db['host'],
            (int) ($db['port'] ?? 3306),
            $db['name'],
            $charset
        );

        try {
            self::$connection = new PDO($dsn, $db['username'], $db['password'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_STRINGIFY_FETCHES => false,
            ]);
        } catch (PDOException $exception) {
            // Never expose connection details or credentials to the client.
            throw new RuntimeException('Database connection failed.', 0, $exception);
        }

        return self::$connection;
    }
}
