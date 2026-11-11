<?php
declare(strict_types=1);

namespace App\Core;

use App\Auth\PasswordAuth;
use PDO;

final class AuthGuard
{
    public static function user(PDO $db): array
    {
        $auth = new PasswordAuth($db);
        $user = $auth->currentUser();
        if ($user === null) {
            Http::json(['error' => 'unauthenticated'], 401);
        }
        return $user;
    }
}
