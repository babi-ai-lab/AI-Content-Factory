
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

type ModelResult = {
  response: Response | null;
  networkError?: unknown;
  model: string;
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
    (item: unknown): item is string =>
      typeof item === "string"
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

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Send request to one Gemini model.
// Retry temporary errors before returning the result.
async function callGeminiModel(
  model: string,
  apiKey: string,
  requestBody: object
): Promise<ModelResult> {
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const maxAttempts = 2;

  let lastResponse: Response | null = null;
  let lastNetworkError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(45000)
      });

      lastResponse = response;

      if (response.ok) {
        return {
          response,
          model
        };
      }

      const retryableStatuses = [
        429, 500, 502, 503, 504
      ];

      if (
        !retryableStatuses.includes(response.status) ||
        attempt === maxAttempts
      ) {
        break;
      }

      console.warn(
        `${model} returned ${response.status}. Retry ${attempt}/${maxAttempts}.`
      );

      await wait(1500 * attempt);

    } catch (error) {
      lastNetworkError = error;

      console.error(
        `${model} connection attempt ${attempt} failed:`,
        error
      );

      if (attempt < maxAttempts) {
        await wait(1500 * attempt);
      }
    }
  }

  return {
    response: lastResponse,
    networkError: lastNetworkError,
    model
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
        {
          error: "نام محصول و ویژگی‌های آن الزامی است."
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Demo mode if API key is missing.
    if (!apiKey) {
      return NextResponse.json({
        mode: "demo",
        content: demoContent(p)
      });
    }

    // Primary and fallback models.
    const primaryModel =
      process.env.GEMINI_MODEL || "gemini-3.8-flash";

    const fallbackModel =
      process.env.GEMINI_FALLBACK_MODEL ||
      "gemini-3.5-flash-lite";

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

    const requestBody = {
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
    };

    // First attempt: primary model.
    console.log(`Trying primary Gemini model: ${primaryModel}`);

    let result = await callGeminiModel(
      primaryModel,
      apiKey,
      requestBody
    );

    // Fallback only when the primary model has a temporary
    // availability, rate-limit, or connection problem.
    const shouldFallback =
      !result.response ||
      [429, 500, 502, 503, 504].includes(
        result.response.status
      );

    if (
      shouldFallback &&
      fallbackModel !== primaryModel
    ) {
      console.warn(
        `Primary model ${primaryModel} unavailable. Switching to ${fallbackModel}.`
      );

      result = await callGeminiModel(
        fallbackModel,
        apiKey,
        requestBody
      );
    }

    // Handle connection failures.
    if (!result.response) {
      console.error(
        "Both Gemini model attempts failed:",
        result.networkError
      );

      return NextResponse.json(
        {
          error: "ارتباط با مدل‌های Gemini برقرار نشد. لطفاً چند دقیقه دیگر دوباره تلاش کن."
        },
        { status: 502 }
      );
    }

    const aiResponse = result.response;

    // Handle API errors.
    if (!aiResponse.ok) {
      const detail = await aiResponse.text();

      console.error(
        `Gemini API error (${result.model}):`,
        aiResponse.status,
        detail
      );

      if (aiResponse.status === 429) {
        return NextResponse.json(
          {
            error: "سهمیه یا محدودیت درخواست Gemini برای هر دو مدل فعال شده است. بعداً دوباره تلاش کن."
          },
          { status: 429 }
        );
      }

      if (aiResponse.status === 503) {
        return NextResponse.json(
          {
            error: "هر دو مدل Gemini در حال حاضر با مشکل ظرفیت مواجه هستند. چند دقیقه دیگر دوباره تلاش کن."
          },
          { status: 503 }
        );
      }

      if ([500, 502, 504].includes(aiResponse.status)) {
        return NextResponse.json(
          {
            error: "سرویس Gemini موقتاً در دسترس نیست. کمی بعد دوباره تلاش کن."
          },
          { status: 502 }
        );
      }

      if (
        aiResponse.status === 400 ||
        aiResponse.status === 404
      ) {
        return NextResponse.json(
          {
            error: "مدل یا ساختار درخواست Gemini معتبر نیست. نام مدل و تنظیمات API را بررسی کن."
          },
          { status: 502 }
        );
      }

      if (
        aiResponse.status === 401 ||
        aiResponse.status === 403
      ) {
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

    // Read Gemini response.
    const resultData = await aiResponse.json();

    const raw = resultData.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || "")
      .join("")
      .trim();

    if (!raw) {
      console.error(
        "Gemini returned an empty response:",
        JSON.stringify(resultData)
      );

      return NextResponse.json(
        {
          error: "پاسخ مدل خالی بود. دوباره تلاش کن."
        },
        { status: 502 }
      );
    }

    // Validate generated content.
    const content = extractJson(raw);

    console.log(
      `Content successfully generated using ${result.model}`
    );

    return NextResponse.json({
      mode: "ai",
      model: result.model,
      content
    });

  } catch (error) {
    console.error("Generate API error:", error);

    return NextResponse.json(
      {
        error: "در پردازش درخواست خطایی رخ داد. دوباره تلاش کن."
      },
      { status: 500 }
    );
  }
}

