<?php
declare(strict_types=1);

namespace App\\Core;

final class Request
{
    public static function json(): array
    {
        $type = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
        if ($type !== 'application/json') {
            Http::json(['error' => 'content_type_must_be_application_json'], 415);
        }
        $raw = file_get_contents('php://input');
        if (!is_string($raw) || strlen($raw) > 1048576) {
            Http::json(['error' => 'request_too_large'], 413);
        }
        try {
            $data = json_decode($raw, true, 64, JSON_THROW_ON_ERROR);
        } catch (\\JsonException) {
            Http::json(['error' => 'invalid_json'], 400);
        }
        if (!is_array($data) || array_is_list($data)) {
            Http::json(['error' => 'json_object_required'], 400);
        }
        return $data;
    }

    public static function method(): string
    {
        return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    }

    public static function path(): string
    {
        return rtrim(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/', '/') ?: '/';
    }

    public static function requireCsrf(array $allowedOrigins = []): void
    {
        if ($allowedOrigins !== []) {
            $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
            if (!is_string($origin) || $origin === '') {
                $referer = $_SERVER['HTTP_REFERER'] ?? '';
                $parts = is_string($referer) ? parse_url($referer) : false;
                if (is_array($parts) && isset($parts['scheme'], $parts['host'])) {
                    $origin = strtolower($parts['scheme']) . '://' . strtolower($parts['host']);
                    if (isset($parts['port'])) {
                        $origin .= ':' . (int) $parts['port'];
                    }
                } else {
                    $origin = '';
                }
            }

            if ($origin === '' || !in_array($origin, $allowedOrigins, true)) {
                Http::json(['error' => 'origin_not_allowed'], 403);
            }
        }

        $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;
        if (!\\App\\Core\\Csrf::verify(is_string($token) ? $token : null)) {
            Http::json(['error' => 'csrf_token_invalid'], 419);
        }
    }
}
