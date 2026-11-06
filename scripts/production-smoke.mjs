const targets = [
  { label: 'custom-domain', origin: 'https://app.eltbabak.ir' },
  { label: 'render-origin', origin: 'https://ai-content-factory-6m32.onrender.com' },
];

async function assertUnauthenticatedJson(origin, path) {
  const response = await fetch(`${origin}${path}`, {
    method: 'POST',
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'AI-Content-Factory-production-smoke/1.0',
    },
    body: '{}',
  });
  const responseText = await response.text();
  if (response.status !== 401) {
    throw new Error(`${path} should reject anonymous requests with HTTP 401, received ${response.status}`);
  }
  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch {
    throw new Error(`${path} returned a non-JSON authentication response`);
  }
  if (typeof payload.error !== 'string' || !payload.error.trim()) {
    throw new Error(`${path} did not return a useful authentication error`);
  }
  if (/Gemini|Google|گوگل|جمنای/i.test(responseText)) {
    throw new Error(`${path} exposed an external processor name in a public error response`);
  }
}

async function fetchWithRetry(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(45000),
        headers: { 'User-Agent': 'AI-Content-Factory-production-smoke/1.0' },
      });
      if (response.ok) return response;
      lastError = new Error(`${url} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 4000));
  }
  throw lastError;
}

for (const target of targets) {
  const healthResponse = await fetchWithRetry(`${target.origin}/api/health`);
  const health = await healthResponse.json();
  if (health.status !== 'ok') throw new Error(`${target.label}: health endpoint did not report ok`);

  await assertUnauthenticatedJson(target.origin, '/api/generate');
  await assertUnauthenticatedJson(target.origin, '/api/media/generate');

  const pageResponse = await fetchWithRetry(`${target.origin}/`);
  const html = await pageResponse.text();
  const hasProductName = html.includes('AI Content Factory');
  const hasSignupCta = html.includes('شروع رایگان');
  const hasAuthLoadingShell = html.includes('id="auth-loading-state"') && html.includes('auth-loading-watchdog');
  if (!hasProductName || (!hasSignupCta && !hasAuthLoadingShell)) {
    const preview = html.slice(0, 500).replace(/\\s+/g, ' ');
    throw new Error(`${target.label}: expected product shell, signup CTA, or current auth shell was not found (product=${hasProductName}, signup=${hasSignupCta}, authShell=${hasAuthLoadingShell}, staleAuth=${html.includes('در حال بررسی حساب کاربری...')}, preview=${preview})`);
  }
  if (html.includes('در حال بررسی حساب کاربری...')) {
    throw new Error(`${target.label}: stale authentication diagnostic text is present`);
  }

  const retiredIntegrationLabels = [
    'مدیریت انتشار اینستاگرام',
    'اتصال حساب حرفه‌ای اینستاگرام',
    'اتصال حساب اینستاگرام',
  ];
  const visibleRetiredLabel = retiredIntegrationLabels.find((label) => html.includes(label));
  if (visibleRetiredLabel) {
    throw new Error(`${target.label}: retired Instagram integration UI is visible (${visibleRetiredLabel})`);
  }

  const assets = [...html.matchAll(/(?:src|href)=["']([^"']*_next\/static\/[^"']+)["']/g)]
    .map((match) => new URL(match[1], target.origin).toString());
  const scripts = [...new Set(assets.filter((asset) => /\.js(?:\?|$)/.test(asset)))].slice(0, 3);
  if (scripts.length === 0) throw new Error(`${target.label}: no production JavaScript assets were found`);
  for (const asset of scripts) {
    const response = await fetchWithRetry(asset);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('javascript') && !contentType.includes('ecmascript')) {
      throw new Error(`${target.label}: JavaScript asset has unexpected content type (${contentType})`);
    }
  }

  console.log(`PASS ${target.label}: health, anonymous API rejection, vendor-neutral errors, page shell, signup CTA, retired integration hidden, and ${scripts.length} JavaScript asset(s)`);
}
