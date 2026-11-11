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

    if ($method === 'GET' && $path === '/') {
        $signedIn = (new PasswordAuth($db))->currentUser() !== null;
        header('Location: ' . ($signedIn ? '/dashboard.html' : '/login.html'), true, 302);
        exit;
    }

    if ($method === 'GET' && $path === '/health') {
        $db->query('SELECT 1');
        Http::json(['ok' => true, 'application' => 'AI Content Factory', 'runtime' => 'php', 'database' => 'connected']);
    }

    if ($method === 'GET' && $path === '/setup/first-admin') {
        $setupToken = $config['security']['first_admin_setup_token'] ?? '';
        $userCount = (int) $db->query('SELECT COUNT(*) FROM users')->fetchColumn();
        if (!is_string($setupToken) || strlen($setupToken) < 32 || $userCount > 0) {
            http_response_code(404);
            header('Content-Type: text/plain; charset=utf-8');
            echo 'Setup is unavailable.';
            exit;
        }
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: no-store, private');
        echo <<<'HTML'
<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>راه‌اندازی اولیه | AI Content Factory</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f4f6fb;color:#1c2b5e;font-family:Tahoma,Arial,sans-serif;min-height:100vh;display:grid;place-items:center;padding:20px}.card{width:min(100%,460px);background:#fff;border:1px solid #e4e8f1;border-radius:18px;padding:28px;box-shadow:0 12px 40px #1c2b5e12}h1{font-size:21px;margin:0 0 10px}p{color:#59657f;line-height:1.9;font-size:13px}label{display:block;font-size:13px;margin:16px 0 7px}input{width:100%;padding:12px;border:1px solid #d7ddeb;border-radius:9px;font:inherit;font-size:14px}button{width:100%;margin-top:22px;padding:13px;border:0;border-radius:9px;background:#1c2b5e;color:white;font:inherit;cursor:pointer}button:disabled{opacity:.55}#result{white-space:pre-wrap;overflow-wrap:anywhere;margin-top:15px;font-size:13px}
</style>
</head>
<body>
<main class="card">
<h1>ساخت اولین حساب</h1>
<p>این فرم فقط برای راه‌اندازی اولیه است و پس از ایجاد اولین حساب، به‌طور خودکار غیرفعال می‌شود.</p>
<form id="setup">
<label for="setup_token">کلید راه‌اندازی</label><input id="setup_token" type="password" autocomplete="off" required>
<label for="display_name">نام نمایشی (اختیاری)</label><input id="display_name" maxlength="120" autocomplete="name">
<label for="email">ایمیل</label><input id="email" type="email" maxlength="254" autocomplete="email" required>
<label for="password">رمز عبور (حداقل ۱۲ نویسه)</label><input id="password" type="password" minlength="12" maxlength="200" autocomplete="new-password" required>
<button id="submit" type="submit">ایجاد حساب</button>
</form>
<div id="result" role="status" aria-live="polite"></div>
</main>
<script>
const form=document.getElementById('setup'),result=document.getElementById('result'),button=document.getElementById('submit');
form.addEventListener('submit',async event=>{
 event.preventDefault();button.disabled=true;result.textContent='در حال ایجاد حساب...';
 try{
  const csrfResponse=await fetch('/api/csrf',{credentials:'same-origin',cache:'no-store'});
  const csrfData=await csrfResponse.json();
  if(!csrfResponse.ok||!csrfData.csrf_token)throw new Error('دریافت توکن امنیتی ناموفق بود.');
  const response=await fetch('/api/setup/first-admin',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrfData.csrf_token},body:JSON.stringify({setup_token:document.getElementById('setup_token').value,email:document.getElementById('email').value,password:document.getElementById('password').value,display_name:document.getElementById('display_name').value})});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||'ایجاد حساب انجام نشد.');
  form.reset();form.hidden=true;result.textContent='حساب با موفقیت ساخته شد. اکنون می‌توانی از مسیر ورود استفاده کنی. شناسه حساب: '+data.user.id;
 }catch(error){result.textContent=error.message||'خطای نامشخص';button.disabled=false;}
});
</script>
</body>
</html>
HTML;
        exit;
    }

    if ($method === 'GET' && $path === '/api/csrf') {
        Http::json(['csrf_token' => Csrf::token()]);
    }

    if ($path === '/api/setup/first-admin' && $method === 'POST') {
        Request::requireCsrf();
        $expectedToken = $config['security']['first_admin_setup_token'] ?? '';
        $input = Request::json();
        $providedToken = is_string($input['setup_token'] ?? null) ? $input['setup_token'] : '';
        if (!is_string($expectedToken) || strlen($expectedToken) < 32
            || !hash_equals($expectedToken, $providedToken)) {
            Http::json(['error' => 'setup_not_available'], 403);
        }

        $email = is_string($input['email'] ?? null) ? $input['email'] : '';
        $password = is_string($input['password'] ?? null) ? $input['password'] : '';
        $displayName = is_string($input['display_name'] ?? null) ? $input['display_name'] : null;
        $user = (new \App\Auth\FirstAdminSetup($db))->create($email, $password, $displayName);
        Http::json(['ok' => true, 'user' => $user], 201);
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
