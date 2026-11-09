<?php
declare(strict_types=1);

/** @var array $config */
function db(): PDO
{
    static $pdo = null;
    global $config;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $db = $config['database'] ?? [];
    $name = trim((string)($db['name'] ?? ''));
    $username = (string)($db['username'] ?? '');

    if ($name === '' || $username === '') {
        throw new RuntimeException('Database configuration is incomplete.');
    }

    $host = (string)($db['host'] ?? 'localhost');
    $port = (int)($db['port'] ?? 3306);
    $charset = (string)($db['charset'] ?? 'utf8mb4');
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $host, $port, $name, $charset);

    $pdo = new PDO($dsn, $username, (string)($db['password'] ?? ''), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_STRINGIFY_FETCHES => false,
    ]);

    return $pdo;
}
