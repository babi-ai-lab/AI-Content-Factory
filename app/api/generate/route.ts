import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Product = {
  name: string;
  price?: string;
  category?: string;
  fabric?: string;
  colors?: string;
  features: string;
  audience?: string;
  goal?: string;
  tone?: string;
};

function demoContent(p: Product) {
  const price = p.price?.trim() ? `قیمت: ${p.price.trim()}` : "برای اطلاع از قیمت پیام بده.";
  const colors = p.colors?.trim() ? `رنگ‌بندی: ${p.colors.trim()}.` : "";
  const fabric = p.fabric?.trim() ? `جنس: ${p.fabric.trim()}.` : "";
  const features = p.features.trim();
  return {
    caption: `گاهی یک انتخاب ساده، حال‌وهوای استایلت را عوض می‌کند.\n\n${p.name}؛ ${features}.\n${fabric} ${colors}\n\n${price}\n\nبرای دریافت راهنمای انتخاب و ثبت سفارش، پیام بده.\n\n#استایل #پوشاک #خرید_آنلاین`,
    reel: `سناریوی ریلز ۲۰ تا ۲۵ ثانیه‌ای برای ${p.name}\n\nصحنه ۱ (۰ تا ۴ ثانیه): نمای نزدیک از محصول. نوشته روی تصویر: «دنبال یک انتخاب کاربردی برای استایلت هستی؟»\n\nصحنه ۲ (۴ تا ۱۲ ثانیه): نمایش محصول از چند زاویه و جزئیات واقعی آن. گوینده: «${p.name} با این ویژگی‌ها: ${features}.»\n\nصحنه ۳ (۱۲ تا ۱۹ ثانیه): نمایش رنگ‌ها یا نحوه ست‌کردن. ${colors}\n\nصحنه ۴ (۱۹ تا ۲۵ ثانیه): نمایش قیمت و دعوت به اقدام: «برای سفارش و راهنمایی، دایرکت بده.»\n\nنکته تولید: فقط ویژگی‌هایی را نمایش بده که واقعاً در محصول وجود دارند.`,
    stories: [
      `اسلاید ۱ — معرفی: «محصولی که ارزش دیدن جزئیاتش را دارد» | ${p.name}`,
      `اسلاید ۲ — ویژگی: «چه چیزی این محصول را متمایز می‌کند؟» | ${features}`,
      `اسلاید ۳ — مشخصات: ${fabric} ${colors}`,
      `اسلاید ۴ — قیمت: ${price}`,
      "اسلاید ۵ — دعوت به اقدام: «برای سفارش یا پرسیدن سؤال، همین حالا پیام بده.»"
    ],
    ad: `برای استایل روزمره‌ات یک انتخاب تازه ببین.\n\n${p.name}\n${features}\n${fabric} ${colors}\n${price}\n\nمناسب برای: ${p.audience || "مخاطبان فروشگاه"}\n\nبرای دریافت جزئیات و ثبت سفارش پیام بده.`
  };
}

export async function POST(request: NextRequest) {
  try {
    const p = (await request.json()) as Product;
    if (!p || typeof p.name !== "string" || typeof p.features !== "string" || !p.name.trim() || !p.features.trim()) {
      return NextResponse.json({ error: "نام محصول و ویژگی‌های آن الزامی است." }, { status: 400 });
    }

    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ mode: "demo", content: demoContent(p) });
    }

    const baseUrl = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    const model = process.env.AI_MODEL || "gpt-4o-mini";
    const systemPrompt = `تو دستیار تولید محتوای فارسی برای فروشگاه پوشاک و اکسسوری هستی.
فقط از اطلاعاتی که فروشنده داده استفاده کن. هیچ ویژگی، تخفیف، موجودی، ضمانت یا ادعای تأییدنشده‌ای نساز.
خروجی را فقط به صورت JSON معتبر با کلیدهای caption، reel، stories (آرایه پنج‌تایی) و ad برگردان.
لحن را مطابق درخواست تنظیم کن. متن‌ها طبیعی، دقیق، قابل انتشار و فروش‌محور باشند.
در صورت نبود قیمت یا رنگ، درباره آن‌ها ادعای مشخص نکن.`;

    const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(p) }
        ]
      }),
    });

    if (!aiResponse.ok) {
      const detail = await aiResponse.text();
      console.error("AI provider error:", detail);
      return NextResponse.json({ error: "سرویس هوش مصنوعی پاسخ موفق نداد. تنظیمات API را بررسی کن." }, { status: 502 });
    }

    const result = await aiResponse.json();
    const raw = result.choices?.[0]?.message?.content;
    if (!raw) return NextResponse.json({ error: "پاسخ مدل خالی بود." }, { status: 502 });
    const parsed = JSON.parse(raw);
    if (!parsed.caption || !parsed.reel || !Array.isArray(parsed.stories) || !parsed.ad) {
      return NextResponse.json({ error: "ساختار خروجی مدل معتبر نیست." }, { status: 502 });
    }
    return NextResponse.json({ mode: "ai", content: parsed });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "در پردازش درخواست خطایی رخ داد." }, { status: 500 });
  }
}
