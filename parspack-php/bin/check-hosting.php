<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$checks = [];
$add = static function (string $name, bool $ok, string $detail) use (&$checks): void {
    $checks[] = [$name, $ok, $detail];
};

$add('PHP >= 8.1', version_compare(PHP_VERSION, '8.1.0', '>='), PHP_VERSION);
foreach (['pdo_mysql', 'mbstring', 'fileinfo'] as $extension) {
    $add('Extension ' . $extension, extension_loaded($extension), extension_loaded($extension) ? 'enabled' : 'missing');
}

$curlReady = extension_loaded('curl');
$streamReady = extension_loaded('openssl') && (bool)ini_get('allow_url_fopen');
$httpsReady = $curlReady || $streamReady;
$add('Outbound HTTPS transport', $httpsReady, $curlReady ? 'cURL is enabled' : ($streamReady ? 'OpenSSL streams are enabled' : 'Enable cURL or OpenSSL with allow_url_fopen'));
$add('allow_url_fopen', $curlReady || (bool)ini_get('allow_url_fopen'), $curlReady ? 'not required; cURL is enabled' : (string)ini_get('allow_url_fopen'));
$add('Session save path', is_dir((string)session_save_path()) && is_writable((string)session_save_path()), (string)session_save_path());
$add('Upload limit', true, (string)ini_get('upload_max_filesize'));
$add('POST limit', true, (string)ini_get('post_max_size'));
$add('Memory limit', true, (string)ini_get('memory_limit'));
$add('Execution time', true, (string)ini_get('max_execution_time'));

$configFile = dirname(__DIR__) . '/config.php';
$add('Private config file', is_file($configFile), is_file($configFile) ? 'present' : 'not installed');

if (is_file($configFile)) {
    try {
        $config = require $configFile;
        $db = $config['database'] ?? [];
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=%s',
            (string)($db['host'] ?? 'localhost'),
            (int)($db['port'] ?? 3306),
            (string)($db['name'] ?? ''),
            (string)($db['charset'] ?? 'utf8mb4')
        );
        new PDO($dsn, (string)($db['username'] ?? ''), (string)($db['password'] ?? ''), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 5,
        ]);
        $add('MySQL connection', true, 'connected');
    } catch (Throwable $error) {
        $add('MySQL connection', false, 'connection failed; details intentionally hidden');
    }
}

$failed = false;
echo "AI Content Factory — ParsPack hosting diagnostics\n";
echo "PHP " . PHP_VERSION . "\n\n";
foreach ($checks as [$name, $ok, $detail]) {
    printf("[%s] %-28s %s\n", $ok ? 'OK' : 'CHECK', $name, $detail);
    if (!$ok) {
        $failed = true;
    }
}
echo "\n" . ($failed ? "Some checks need attention. Do not deploy the full product yet.\n" : "All required baseline checks passed.\n");
exit($failed ? 1 : 0);
