
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

type GeneratedContent = {
  caption: string;
  reel: string;
  stories: string[];
  ad: string;
};

function demoContent(p: Product): GeneratedContent {
  const price = p.price?.trim()
    ? `قیمت: ${p.price.trim()}`
    : "برای اطلاع از قیمت پیام بده.";

  const colors = p.colors?.trim()
    ? `رنگ‌بندی: ${p.colors.trim()}.`
    : "";

  const fabric = p.fabric?.trim()
    ? `جنس: ${p.fabric.trim()}.`
    : "";

  const features = p.features.trim();

  return {
    caption: `گاهی یک انتخاب ساده، حال‌وهوای استایلت را عوض می‌کند.

${p.name}؛ ${features}.
${fabric} ${colors}

${price}

برای دریافت راهنمای انتخاب و ثبت سفارش، پیام بده.

#استایل #پوشاک #خرید_آنلاین`,

    reel: `سناریوی ریلز ۲۰ تا ۲۵ ثانیه‌ای برای ${p.name}

صحنه ۱ (۰ تا ۴ ثانیه): نمای نزدیک از محصول. نوشته روی تصویر: «دنبال یک انتخاب کاربردی برای استایلت هستی؟»

صحنه ۲ (۴ تا ۱۲ ثانیه): نمایش محصول از چند زاویه و جزئیات واقعی آن. گوینده: «${p.name} با این ویژگی‌ها: ${features}.»

صحنه ۳ (۱۲ تا ۱۹ ثانیه): نمایش رنگ‌ها یا نحوه ست‌کردن. ${colors}

صحنه ۴ (۱۹ تا ۲۵ ثانیه): نمایش قیمت و دعوت به اقدام: «برای سفارش و راهنمایی، دایرکت بده.»

نکته تولید: فقط ویژگی‌هایی را نمایش بده که واقعاً در محصول وجود دارند.`,

    stories: [
      `اسلاید ۱ — معرفی: «محصولی که ارزش دیدن جزئیاتش را دارد» | ${p.name}`,
      `اسلاید ۲ — ویژگی: «چه چیزی این محصول را متمایز می‌کند؟» | ${features}`,
      `اسلاید ۳ — مشخصات: ${fabric} ${colors}`,
      `اسلاید ۴ — قیمت: ${price}`,
      "اسلاید ۵ — دعوت به اقدام: «برای سفارش یا پرسیدن سؤال، همین حالا پیام بده.»"
    ],

    ad: `برای استایل روزمره‌ات یک انتخاب تازه ببین.

${p.name}
${features}
${fabric} ${colors}
${price}

مناسب برای: ${p.audience || "مخاطبان فروشگاه"}

برای دریافت جزئیات و ثبت سفارش پیام بده.`
  };
}

function extractJson(text: string): GeneratedContent {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  const parsed = JSON.parse(cleaned);

  if (
    typeof parsed.caption !== "string" ||
    typeof parsed.reel !== "string" ||
    !Array.isArray(parsed.stories) ||
    typeof parsed.ad !== "string"
  ) {
    throw new Error("Invalid AI response structure");
  }

  const stories = parsed.stories.filter(
    (item: unknown): item is string => typeof item === "string"
  );

  if (stories.length !== 5) {
    throw new Error("AI must return exactly five stories");
  }

  return {
    caption: parsed.caption,
    reel: parsed.reel,
    stories,
    ad: parsed.ad
  };
}

export async function POST(request: NextRequest) {
  try {
    const p = (await request.json()) as Product;

    if (
      !p ||
      typeof p.name !== "string" ||
      typeof p.features !== "string" ||
      !p.name.trim() ||
      !p.features.trim()
    ) {
      return NextResponse.json(
        { error: "نام محصول و ویژگی‌های آن الزامی است." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // If no Gemini key is configured, use the local demo generator.
    if (!apiKey) {
      return NextResponse.json({
        mode: "demo",
        content: demoContent(p)
      });
    }

    const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

    const systemPrompt = `تو دستیار حرفه‌ای تولید محتوای فارسی برای فروشگاه پوشاک و اکسسوری هستی.

فقط از اطلاعاتی که فروشنده داده استفاده کن.
هیچ ویژگی، تخفیف، موجودی، ضمانت یا ادعای تأییدنشده‌ای نساز.
خروجی را فقط به صورت JSON معتبر با کلیدهای زیر برگردان:
caption: متن کپشن
reel: سناریوی ریلز
stories: آرایه‌ای شامل دقیقاً پنج اسلاید استوری
ad: متن تبلیغاتی

لحن را مطابق درخواست فروشنده تنظیم کن.
متن‌ها طبیعی، دقیق، جذاب، قابل انتشار و فروش‌محور باشند.
در صورت نبود قیمت یا رنگ، درباره آن‌ها ادعای مشخص نکن.
محتوا باید به زبان فارسی باشد.`;

    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

    const aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: JSON.stringify(p)
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json"
        }
      })
    });

    if (!aiResponse.ok) {
      const detail = await aiResponse.text();

      console.error("Gemini API error:", aiResponse.status, detail);

      if (aiResponse.status === 429) {
        return NextResponse.json(
          {
            error: "سهمیه رایگان Gemini فعلاً تمام شده یا تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره امتحان کن."
          },
          { status: 429 }
        );
      }

      if (aiResponse.status === 400 || aiResponse.status === 404) {
        return NextResponse.json(
          {
            error: "مدل یا تنظیمات درخواست Gemini معتبر نیست. نام مدل و تنظیمات API را بررسی کن."
          },
          { status: 502 }
        );
      }

      if (aiResponse.status === 401 || aiResponse.status === 403) {
        return NextResponse.json(
          {
            error: "کلید Gemini معتبر نیست یا دسترسی API برای آن فعال نشده است."
          },
          { status: 502 }
        );
      }

      return NextResponse.json(
        {
          error: "ارتباط با Gemini برقرار نشد. تنظیمات API را بررسی کن."
        },
        { status: 502 }
      );
    }

    const result = await aiResponse.json();

    const raw = result.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || "")
      .join("")
      .trim();

    if (!raw) {
      console.error("Gemini returned an empty response:", result);

      return NextResponse.json(
        { error: "پاسخ مدل خالی بود. دوباره تلاش کن." },
        { status: 502 }
      );
    }

    const content = extractJson(raw);

    return NextResponse.json({
      mode: "ai",
      content
    });

  } catch (error) {
    console.error("Generate API error:", error);

    return NextResponse.json(
      { error: "در پردازش درخواست خطایی رخ داد." },
      { status: 500 }
    );
  }
}
