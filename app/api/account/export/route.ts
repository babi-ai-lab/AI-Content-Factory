import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ACCOUNT_EXPORT_TABLES, createAccountExportPayload } from "@/lib/account-export.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 250;
const MAX_ROWS_PER_TABLE = 5_000;
const MAX_EXPORT_BYTES = 15 * 1024 * 1024;

async function readAccountRows(
  client: any,
  descriptor: (typeof ACCOUNT_EXPORT_TABLES)[number],
  remainingBytes: number,
) {
  const rows: Record<string, unknown>[] = [];
  let estimatedBytes = 0;

  for (let offset = 0; offset <= MAX_ROWS_PER_TABLE; offset += PAGE_SIZE) {
    const { data, error } = await client
      .from(descriptor.table)
      .select(descriptor.columns)
      .order(descriptor.orderBy, { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Unable to export ${descriptor.key}: ${error.message}`);
    }

    const page = Array.isArray(data) ? data as Record<string, unknown>[] : [];
    if (offset === MAX_ROWS_PER_TABLE && page.length > 0) {
      throw new RangeError("Account export exceeds the safe per-table row limit.");
    }

    estimatedBytes += Buffer.byteLength(JSON.stringify(page), "utf8");
    if (estimatedBytes > remainingBytes) {
      throw new RangeError("Account export exceeds the safe response size.");
    }

    rows.push(...page);
    if (page.length < PAGE_SIZE) return { rows, estimatedBytes };
  }

  throw new RangeError("Account export exceeds the safe per-table row limit.");
}

export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) {
    return NextResponse.json({ error: "برای دریافت نسخه پشتیبان، ابتدا وارد حساب کاربری شو." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "تنظیمات احراز هویت سرور کامل نیست." }, { status: 500 });
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "نشست کاربری معتبر نیست. دوباره وارد حساب شو." }, { status: 401 });
  }

  try {
    const data: Record<string, Record<string, unknown>[]> = {};
    let estimatedBytes = 0;
    for (const descriptor of ACCOUNT_EXPORT_TABLES) {
      const result = await readAccountRows(client, descriptor, MAX_EXPORT_BYTES - estimatedBytes);
      data[descriptor.key] = result.rows;
      estimatedBytes += result.estimatedBytes;
    }
    const payload = createAccountExportPayload(user, data);
    const serialized = JSON.stringify(payload, null, 2);
    if (Buffer.byteLength(serialized, "utf8") > MAX_EXPORT_BYTES) {
      return NextResponse.json(
        { error: "حجم نسخه پشتیبان از سقف امن یک‌باره بیشتر است. برای دریافت نسخه کامل با پشتیبانی تماس بگیر." },
        { status: 413, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(serialized, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="ai-content-factory-account-${date}.json"`,
        "Cache-Control": "private, no-store, max-age=0",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json(
        { error: "حجم اطلاعات حساب از سقف خروجی یک‌باره بیشتر است. برای دریافت نسخه کامل با پشتیبانی تماس بگیر." },
        { status: 413, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    console.error("Account data export failed:", error);
    return NextResponse.json(
      { error: "ساخت نسخه پشتیبان حساب انجام نشد. کمی بعد دوباره تلاش کن." },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
