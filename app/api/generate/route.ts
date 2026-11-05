
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitGlobal = globalThis as typeof globalThis & {
  __aiContentRateLimit?: Map<string, RateLimitEntry>;
};

function checkRateLimit(userId: string): boolean {
  const now = Date.now();

  const store =
    rateLimitGlobal.__aiContentRateLimit ??
    (rateLimitGlobal.__aiContentRateLimit = new Map());

  store.forEach((value, key) => {
  if (value.resetAt <= now) {
    store.delete(key);
  }
});

  const entry = store.get(userId);

  if (!entry || entry.resetAt <= now) {
    store.set(userId, {
      count: 1,
      resetAt: now + 10 * 60 * 1000,
    });

    return true;
  }

  if (entry.count >= 8) {
    return false;
  }

  entry.count += 1;
  return true;
}
type BusinessType =
  | "retail"
  | "services"
  | "restaurant"
  | "real_estate"
  | "construction"
  | "education"
  | "fitness"
  | "personal_brand"
  | "other";

type BusinessInput = {
  businessType?: BusinessType | string;
  businessName?: string;
  name: string;
  price?: string;
  category?: string;
  fabric?: string;
  colors?: string;
  features: string;
  audience?: string;
  goal?: string;
  tone?: string;
  serviceArea?: string;
  offer?: string;
  differentiators?: string;
  additionalInfo?: string;
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

const businessLabels: Record<string, string> = {
  retail: "فروشگاه و خرده‌فروشی",
  services: "خدمات و کسب‌وکارهای خدماتی",
  restaurant: "رستوران، کافه و صنایع غذایی",
  real_estate: "املاک و مستغلات",
  construction: "ساختمان، معماری و بازسازی",
  education: "آموزش و آموزشگاه",
  fitness: "ورزش، باشگاه و تناسب اندام",
  personal_brand: "برند شخصی و فعالیت حرفه‌ای",
  other: "سایر کسب‌وکارها",
};

function getBusinessLabel(type?: string) {
  return businessLabels[type || "retail"] || businessLabels.other;
}

const MAX_BODY_BYTES = 16 * 1024;
const allowedBusinessTypes = new Set(Object.keys(businessLabels));
const fieldLimits: Record<string, number> = {
  businessName: 120,
  name: 120,
  price: 100,
  category: 120,
  fabric: 100,
  colors: 120,
  features: 1800,
  audience: 160,
  goal: 100,
  tone: 100,
  serviceArea: 160,
  offer: 180,
  differentiators: 220,
  additionalInfo: 1000,
};

async function readJsonBody(
  request: NextRequest
): Promise<{ value: unknown } | { error: "too_large" | "invalid" }> {
  const reader = request.body?.getReader();
  if (!reader) return { error: "invalid" };

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return { error: "too_large" };
      }

      chunks.push(value);
    }
  } catch {
    return { error: "invalid" };
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { value: JSON.parse(new TextDecoder().decode(body)) };
  } catch {
    return { error: "invalid" };
  }
}

function validateBusinessInput(value: unknown): BusinessInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const input = value as Record<string, unknown>;
  if (
    typeof input.name !== "string" ||
    typeof input.features !== "string" ||
    !input.name.trim() ||
    !input.features.trim()
  ) {
    return null;
  }

  const businessType =
    typeof input.businessType === "string" ? input.businessType : "retail";
  if (!allowedBusinessTypes.has(businessType)) return null;

  const sanitized: Record<string, string> = {};
  for (const [field, maxLength] of Object.entries(fieldLimits)) {
    const fieldValue = input[field];
    if (fieldValue === undefined || fieldValue === null) {
      sanitized[field] = "";
      continue;
    }
    if (typeof fieldValue !== "string") return null;

    const trimmed = fieldValue.trim();
    if (trimmed.length > maxLength) return null;
    sanitized[field] = trimmed;
  }

  if (sanitized.name.length < 2 || sanitized.features.length < 3) return null;

  return {
    businessType: businessType as BusinessType,
    businessName: sanitized.businessName,
    name: sanitized.name,
    price: sanitized.price,
    category: sanitized.category,
    fabric: sanitized.fabric,
    colors: sanitized.colors,
    features: sanitized.features,
    audience: sanitized.audience,
    goal: sanitized.goal,
    tone: sanitized.tone,
    serviceArea: sanitized.serviceArea,
    offer: sanitized.offer,
    differentiators: sanitized.differentiators,
    additionalInfo: sanitized.additionalInfo,
  };
}

function demoContent(p: BusinessInput): GeneratedContent {
  const businessType = p.businessType || "retail";
  const businessName = p.businessName?.trim() || p.name.trim();
  const name = p.name.trim();
  const features = p.features.trim();

  const price = p.price?.trim()
    ? `قیمت: ${p.price.trim()}`
    : "";

  const area = p.serviceArea?.trim()
    ? `محدوده فعالیت: ${p.serviceArea.trim()}`
    : "";

  const offer = p.offer?.trim()
    ? `پیشنهاد: ${p.offer.trim()}`
    : "";

  const differentiators = p.differentiators?.trim()
    ? `مزیت‌ها: ${p.differentiators.trim()}`
    : "";

  const commonDetails = [
    features,
    differentiators,
    area,
    offer,
    price,
  ]
    .filter(Boolean)
    .join("\n");

  const intro = `با ${businessName} بیشتر آشنا شوید.`;

  const caption = `${intro}

${name}

${commonDetails}

برای دریافت اطلاعات بیشتر و مشاوره، با ما در ارتباط باشید.

${p.audience?.trim() ? `مناسب برای: ${p.audience.trim()}` : ""}

#کسب_و_کار #معرفی #خدمات`;

  const reel = `سناریوی ریلز ۲۰ تا ۳۰ ثانیه‌ای

صحنه ۱ (۰ تا ۵ ثانیه):
نمای جذاب از ${name}.
نوشته روی تصویر: «به دنبال یک انتخاب مناسب هستید؟»

صحنه ۲ (۵ تا ۱۵ ثانیه):
معرفی فعالیت و ویژگی‌های واقعی:
${features}

صحنه ۳ (۱۵ تا ۲۳ ثانیه):
نمایش مزیت‌ها و جزئیات:
${differentiators || features}

صحنه ۴ (۲۳ تا ۳۰ ثانیه):
دعوت به اقدام:
«برای دریافت اطلاعات بیشتر با ما تماس بگیرید یا پیام بدهید.»

نکته: فقط خدمات و ویژگی‌های واقعی را نمایش بده.`;

  const stories = [
    `استوری ۱ — معرفی:
${intro}
${name}`,

    `استوری ۲ — نیاز مخاطب:
مخاطب شما به دنبال چه راه‌حلی است؟
${features}`,

    `استوری ۳ — مزیت‌ها:
${differentiators || features}`,

    `استوری ۴ — اطلاعات تکمیلی:
${[area, offer, price].filter(Boolean).join("\n") || "برای دریافت اطلاعات بیشتر پیام بدهید."}`,

    `استوری ۵ — دعوت به اقدام:
برای دریافت اطلاعات بیشتر همین حالا پیام بدهید.`,
  ];

  const ad = `${businessName}

${name}

${commonDetails}

اگر به دنبال گزینه‌ای مناسب برای نیاز خود هستید، با ما در ارتباط باشید.

برای دریافت اطلاعات و مشاوره پیام بدهید.`;

  if (businessType === "restaurant") {
    return {
      caption: `${intro}

${name}

${features}

${offer}

برای اطلاع از منو و سفارش، با ما در ارتباط باشید.`,
      reel,
      stories,
      ad,
    };
  }

  return { caption, reel, stories, ad };
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
    ad: parsed.ad,
  };
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(45000),
      });

      lastResponse = response;

      if (response.ok) {
        return {
          response,
          model,
        };
      }

      const retryableStatuses = [429, 500, 502, 503, 504];

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
    model,
  };
}

function buildSystemPrompt(businessType: string) {
  const businessLabel = getBusinessLabel(businessType);

  return `تو یک استراتژیست حرفه‌ای بازاریابی دیجیتال و متخصص تولید محتوای فارسی هستی.

حوزه فعالیت کسب‌وکار:
${businessLabel}

وظیفه تو تولید محتوای حرفه‌ای و متناسب با ماهیت همین کسب‌وکار است.

قوانین مهم:

۱. ابتدا نوع کسب‌وکار و اطلاعات ارائه‌شده را تحلیل کن.
۲. محتوا باید دقیقاً متناسب با همان صنعت باشد.
۳. برای رستوران از زبان و نیازهای حوزه غذا و پذیرایی استفاده کن.
۴. برای املاک روی معرفی ملک، ویژگی‌های واقعی، موقعیت و اعتمادسازی تمرکز کن.
۵. برای ساختمان و بازسازی روی فرایند اجرا، تخصص، کیفیت و اعتمادسازی تمرکز کن.
۶. برای آموزش روی ارزش آموزشی، مهارت‌آموزی و نتیجه قابل ارائه تمرکز کن.
۷. برای ورزش روی برنامه‌ها، خدمات و تجربه مخاطب تمرکز کن.
۸. برای خدمات روی مسئله مشتری، راه‌حل و مزیت واقعی تمرکز کن.
۹. برای برند شخصی روی تخصص، اعتبار، تجربه و شخصیت حرفه‌ای تمرکز کن.
۱۰. برای فروشگاه‌ها همچنان اصول معرفی محصول و فروش را رعایت کن.

قوانین صحت اطلاعات:

- فقط از اطلاعاتی استفاده کن که کاربر ارائه کرده است.
- قیمت، تخفیف، ضمانت، مجوز، سابقه، آمار، نتیجه یا ویژگی تأییدنشده نساز.
- درباره خدمات یا محصولاتی که معرفی نشده‌اند ادعا نکن.
- اگر اطلاعاتی وجود ندارد، آن را به‌صورت سؤال یا دعوت به تماس مطرح کن.
- از تکرار بی‌دلیل و متن‌های کلیشه‌ای خودداری کن.
- لحن درخواستی کاربر را رعایت کن.
- خروجی باید طبیعی، حرفه‌ای، کاربردی و قابل انتشار باشد.
- تمام محتوا باید به زبان فارسی باشد.

چهار خروجی زیر را تولید کن:

۱. caption:
یک کپشن کامل، جذاب و متناسب با کسب‌وکار، همراه با دعوت به اقدام مناسب.

۲. reel:
سناریوی ویدیوی کوتاه با زمان‌بندی، صحنه‌ها، متن روی تصویر و پیشنهاد گفتار.

۳. stories:
دقیقاً پنج استوری متوالی و مرتبط، با هدف معرفی، ایجاد علاقه، اعتمادسازی و دعوت به اقدام.

۴. ad:
یک متن تبلیغاتی حرفه‌ای و متقاعدکننده برای معرفی کسب‌وکار یا پیشنهاد آن.

فقط JSON معتبر برگردان.
هیچ توضیحی خارج از JSON ننویس.

ساختار دقیق پاسخ:

{
  "caption": "متن کپشن",
  "reel": "سناریوی ریلز",
  "stories": [
    "استوری اول",
    "استوری دوم",
    "استوری سوم",
    "استوری چهارم",
    "استوری پنجم"
  ],
  "ad": "متن تبلیغاتی"
}`;
}

export async function POST(request: NextRequest) {
  try {
    // بررسی وجود توکن ورود
    const authorization = request.headers.get("authorization");

    const token =
      authorization?.startsWith("Bearer ")
        ? authorization.slice(7)
        : "";

    if (!token) {
      return NextResponse.json(
        { error: "برای تولید محتوا ابتدا وارد حساب کاربری شو." },
        { status: 401 }
      );
    }

    // بررسی تنظیمات Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Supabase server authentication is not configured.");

      return NextResponse.json(
        { error: "تنظیمات احراز هویت سرور کامل نیست." },
        { status: 500 }
      );
    }

    // اعتبارسنجی واقعی توکن در Supabase
    const supabaseServer = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const {
      data: { user: authenticatedUser },
      error: authError,
    } = await supabaseServer.auth.getUser(token);

    if (authError || !authenticatedUser) {
      return NextResponse.json(
        { error: "نشست کاربری معتبر نیست. دوباره وارد حساب شو." },
        { status: 401 }
      );
    }

    // محدودیت تعداد درخواست‌ها
    if (!checkRateLimit(authenticatedUser.id)) {
      return NextResponse.json(
        {
          error:
            "تعداد درخواست‌ها بیش از حد مجاز است. لطفاً ۱۰ دقیقه دیگر دوباره تلاش کن.",
        },
        { status: 429 }
      );
    }

    // محدودیت اندازه هدر برای رد سریع درخواست‌های بزرگ
    const contentLengthHeader = request.headers.get("content-length");
    const contentLength = contentLengthHeader ? Number(contentLengthHeader) : 0;

    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "حجم اطلاعات ارسالی بیش از حد مجاز است." },
        { status: 413 }
      );
    }

    // محدودسازی واقعی اندازه بدنه؛ حتی اگر Content-Length ارسال نشده باشد
    const parsedBody = await readJsonBody(request);
    if ("error" in parsedBody) {
      return NextResponse.json(
        {
          error:
            parsedBody.error === "too_large"
              ? "حجم اطلاعات ارسالی بیش از حد مجاز است."
              : "ساختار درخواست معتبر نیست. اطلاعات را بررسی و دوباره ارسال کن.",
        },
        { status: parsedBody.error === "too_large" ? 413 : 400 }
      );
    }

    const p = validateBusinessInput(parsedBody.value);
    if (!p) {
      return NextResponse.json(
        {
          error:
            "اطلاعات ورودی معتبر نیست. نام و توضیحات الزامی‌اند و طول فیلدها باید در محدوده مجاز باشد.",
        },
        { status: 400 }
      );
    }

    const businessType = p.businessType || "retail";

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        mode: "demo",
        content: demoContent({
          ...p,
          businessType,
        }),
      });
    }

    const primaryModel =
      process.env.GEMINI_MODEL || "gemini-3.8-flash";

    const fallbackModel =
      process.env.GEMINI_FALLBACK_MODEL ||
      "gemini-3.5-flash-lite";

    const systemPrompt = buildSystemPrompt(businessType);

    const requestBody = {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: JSON.stringify({
                ...p,
                businessType,
                businessTypeLabel: getBusinessLabel(businessType),
              }),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json",
      },
    };

    console.log(
      `Generating content for business type: ${businessType}`
    );

    let result = await callGeminiModel(
      primaryModel,
      apiKey,
      requestBody
    );

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

    if (!result.response) {
      console.error(
        "Both Gemini model attempts failed:",
        result.networkError
      );

      return NextResponse.json(
        {
          error:
            "ارتباط با مدل‌های Gemini برقرار نشد. لطفاً چند دقیقه دیگر دوباره تلاش کن.",
        },
        { status: 502 }
      );
    }

    const aiResponse = result.response;

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
            error:
              "سهمیه یا محدودیت درخواست Gemini برای هر دو مدل فعال شده است. بعداً دوباره تلاش کن.",
          },
          { status: 429 }
        );
      }

      if (aiResponse.status === 503) {
        return NextResponse.json(
          {
            error:
              "هر دو مدل Gemini در حال حاضر با مشکل ظرفیت مواجه هستند. چند دقیقه دیگر دوباره تلاش کن.",
          },
          { status: 503 }
        );
      }

      if ([500, 502, 504].includes(aiResponse.status)) {
        return NextResponse.json(
          {
            error:
              "سرویس Gemini موقتاً در دسترس نیست. کمی بعد دوباره تلاش کن.",
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
            error:
              "مدل یا ساختار درخواست Gemini معتبر نیست. نام مدل و تنظیمات API را بررسی کن.",
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
            error:
              "کلید Gemini معتبر نیست یا دسترسی API برای آن فعال نشده است.",
          },
          { status: 502 }
        );
      }

      return NextResponse.json(
        {
          error:
            "ارتباط با Gemini برقرار نشد. تنظیمات API را بررسی کن.",
        },
        { status: 502 }
      );
    }

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
          error: "پاسخ مدل خالی بود. دوباره تلاش کن.",
        },
        { status: 502 }
      );
    }

    const content = extractJson(raw);

    console.log(
      `Content successfully generated using ${result.model}`
    );

    return NextResponse.json({
      mode: "ai",
      model: result.model,
      content,
    });
  } catch (error) {
    console.error("Generate API error:", error);

    return NextResponse.json(
      {
        error:
          "در پردازش درخواست خطایی رخ داد. دوباره تلاش کن.",
      },
      { status: 500 }
    );
  }
}
