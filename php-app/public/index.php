<?php
declare(strict_types=1);

require '/home/h369356/ai-content-factory/bootstrap.php';

use App\Auth\PasswordAuth;
use App\Brands\BrandRepository;
use App\Content\ContentRepository;
use App\Core\AuthGuard;
use App\Core\Csrf;
use App\Core\Database;
use App\Core\Http;
use App\Core\Request;

$db = null;
try {
    $db = Database::connection($config);
    $path = Request::path();
    $method = Request::method();

    if ($method === 'GET' && $path === '/health') {
        $db->query('SELECT 1');
        Http::json(['ok' => true, 'application' => 'AI Content Factory', 'runtime' => 'php', 'database' => 'connected']);
    }

    if ($method === 'GET' && $path === '/api/csrf') {
        Http::json(['csrf_token' => Csrf::token()]);
    }

    if ($path === '/api/auth/login' && $method === 'POST') {
        $remoteIp = is_string($_SERVER['REMOTE_ADDR'] ?? null) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
        $limiter = new \App\Core\RateLimiter($db);
        if (!$limiter->allow('auth-login', $remoteIp, 8, 15)) {
            Http::json(['error' => 'too_many_attempts'], 429);
        }
        Request::requireCsrf();
        $input = Request::json();
        $email = is_string($input['email'] ?? null) ? $input['email'] : '';
        $password = is_string($input['password'] ?? null) ? $input['password'] : '';
        if ($email === '' || $password === '' || strlen($password) > 200) {
            Http::json(['error' => 'invalid_credentials'], 422);
        }
        $user = (new PasswordAuth($db))->login($email, $password);
        Http::json(['user' => $user, 'csrf_token' => Csrf::token()]);
    }

    if ($path === '/api/auth/logout' && $method === 'POST') {
        Request::requireCsrf();
        AuthGuard::user($db);
        (new PasswordAuth($db))->logout();
        Http::json(['ok' => true]);
    }

    if ($path === '/api/auth/me' && $method === 'GET') {
        $user = AuthGuard::user($db);
        Http::json(['user' => $user, 'csrf_token' => Csrf::token()]);
    }

    if (str_starts_with($path, '/api/')) {
        $user = AuthGuard::user($db);
        $userId = $user['id'];

        if ($path === '/api/brands' && $method === 'GET') {
            Http::json(['items' => (new BrandRepository($db))->list($userId)]);
        }
        if ($path === '/api/brands' && $method === 'POST') {
            Request::requireCsrf();
            $id = (new BrandRepository($db))->create($userId, Request::json());
            Http::json(['id' => $id], 201);
        }
        if (preg_match('#^/api/brands/([0-9a-f-]{36})$#i', $path, $match)) {
            Request::requireCsrf();
            $repository = new BrandRepository($db);
            if ($method === 'PATCH') {
                if (!$repository->update($userId, $match[1], Request::json())) Http::json(['error' => 'not_found'], 404);
                Http::json(['ok' => true]);
            }
            if ($method === 'DELETE') {
                if (!$repository->delete($userId, $match[1])) Http::json(['error' => 'not_found'], 404);
                Http::json(['ok' => true]);
            }
        }

        if ($path === '/api/campaigns' && $method === 'GET') {
            Http::json(['items' => (new \App\Campaigns\CampaignRepository($db))->list($userId)]);
        }
        if ($path === '/api/campaigns' && $method === 'POST') {
            Request::requireCsrf();
            $id = (new \App\Campaigns\CampaignRepository($db))->create($userId, Request::json());
            Http::json(['id' => $id], 201);
        }
        if (preg_match('#^/api/campaigns/([0-9a-f-]{36})$#i', $path, $match) && $method === 'DELETE') {
            Request::requireCsrf();
            if (!(new \App\Campaigns\CampaignRepository($db))->delete($userId, $match[1])) Http::json(['error' => 'not_found'], 404);
            Http::json(['ok' => true]);
        }

        if ($path === '/api/content' && $method === 'GET') {
            $limit = min(100, max(1, (int) ($_GET['limit'] ?? 25)));
            $offset = min(10000, max(0, (int) ($_GET['offset'] ?? 0)));
            $type = isset($_GET['type']) && is_string($_GET['type']) ? $_GET['type'] : null;
            Http::json(['items' => (new ContentRepository($db))->list($userId, $limit, $offset, $type)]);
        }
        if ($path === '/api/content' && $method === 'POST') {
            Request::requireCsrf();
            $id = (new ContentRepository($db))->create($userId, Request::json());
            Http::json(['id' => $id], 201);
        }
        if (preg_match('#^/api/content/([0-9a-f-]{36})/versions$#i', $path, $versionMatch) && $method === 'GET') {
            $owner = $db->prepare('SELECT 1 FROM content_items WHERE id = :id AND user_id = :user_id');
            $owner->execute(['id' => $versionMatch[1], 'user_id' => $userId]);
            if (!$owner->fetchColumn()) Http::json(['error' => 'not_found'], 404);
            $versions = $db->prepare(
                'SELECT version_number, content_json, plain_text, change_note, created_at
                 FROM content_versions WHERE content_id = :content_id AND user_id = :user_id
                 ORDER BY version_number DESC LIMIT 100'
            );
            $versions->execute(['content_id' => $versionMatch[1], 'user_id' => $userId]);
            Http::json(['items' => $versions->fetchAll()]);
        }

        if (preg_match('#^/api/content/([0-9a-f-]{36})$#i', $path, $match)) {
            $repository = new ContentRepository($db);
            if ($method === 'GET') {
                $item = $repository->find($userId, $match[1]);
                if ($item === null) Http::json(['error' => 'not_found'], 404);
                Http::json(['item' => $item]);
            }
            if ($method === 'PATCH') {
                Request::requireCsrf();
                if (!$repository->update($userId, $match[1], Request::json())) Http::json(['error' => 'not_found'], 404);
                Http::json(['ok' => true]);
            }
            if ($method === 'DELETE') {
                Request::requireCsrf();
                if (!$repository->softDelete($userId, $match[1])) Http::json(['error' => 'not_found'], 404);
                Http::json(['ok' => true]);
            }
        }
    }

    Http::json(['error' => 'not_found'], 404);
} catch (DomainException $exception) {
    Http::json(['error' => $exception->getMessage()], 409);
} catch (InvalidArgumentException $exception) {
    Http::json(['error' => $exception->getMessage()], 422);
} catch (Throwable $exception) {
    $previous = $exception->getPrevious();
    $diagnostic = '[' . date('c') . '] Request failed (' . get_class($exception) . '): ' . $exception->getMessage();
    if ($previous instanceof Throwable) {
        $diagnostic .= "\\nPrevious error (" . get_class($previous) . '): ' . $previous->getMessage();
    }
    $diagnostic .= "\\n";
    @file_put_contents('/home/h369356/ai-content-factory/runtime-errors.log', $diagnostic, FILE_APPEND | LOCK_EX);
    error_log('[AI Content Factory] ' . trim($diagnostic));
    Http::json(['error' => 'internal_server_error'], 500);
}
