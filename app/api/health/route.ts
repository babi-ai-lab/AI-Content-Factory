import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight process health endpoint for the hosting platform.
 * It deliberately exposes no environment variables, credentials, or user data.
 */
export async function GET() {
  return NextResponse.json(
    { status: "ok" },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
