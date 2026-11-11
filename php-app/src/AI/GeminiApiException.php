<?php
declare(strict_types=1);

namespace App\AI;

final class GeminiApiException extends \RuntimeException
{
    public function __construct(private int $status, private string $codeName)
    {
        parent::__construct($codeName);
    }

    public function httpStatus(): int { return $this->status; }
    public function publicCode(): string { return $this->codeName; }
}
