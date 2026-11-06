const targets = [
  { label: 'custom-domain', origin: 'https://app.eltbabak.ir' },
  { label: 'render-origin', origin: 'https://ai-content-factory-6m32.onrender.com' },
];

async function assertUnauthenticatedJson(origin, path, method = 'POST') {
  const response = await fetch(`${origin}${path}`, {
    method,
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
    headers: {
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      'User-Agent': 'AI-Content-Factory-production-smoke/1.0',
    },
    ...(method === 'POST' ? { body: '{}' } : {}),
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
  if (path === '/api/account/export') {
    const cacheControl = response.headers.get('cache-control') || '';
    if (!/private/i.test(cacheControl) || !/no-store/i.test(cacheControl)) {
      throw new Error('Account export authentication response must be private and non-cacheable');
    }
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
  await assertUnauthenticatedJson(target.origin, '/api/account/export', 'GET');

  const pageResponse = await fetchWithRetry(`${target.origin}/`);
  const html = await pageResponse.text();
  const securityHeaderExpectations = [
    ['x-content-type-options', /^nosniff$/i],
    ['x-frame-options', /^DENY$/i],
    ['referrer-policy', /^strict-origin-when-cross-origin$/i],
    ['permissions-policy', /camera=\(\), microphone=\(\), geolocation=\(\)/i],
    ['strict-transport-security', /max-age=31536000/i],
  ];
  for (const [header, expected] of securityHeaderExpectations) {
    const value = pageResponse.headers.get(header) || '';
    if (!expected.test(value)) {
      throw new Error(`${target.label}: missing or unsafe ${header} response header (${value || 'missing'})`);
    }
  }
  const rootCacheControl = pageResponse.headers.get('cache-control') || '';
  if (!/no-store/i.test(rootCacheControl) || !/must-revalidate/i.test(rootCacheControl)) {
    throw new Error(`${target.label}: public app shell must not be cached (${rootCacheControl || 'missing'})`);
  }
  const hasProductName = html.includes('AI Content Factory');
  const hasSignupCta = html.includes('شروع رایگان');
  const hasAuthLoadingShell = html.includes('id="auth-loading-state"') && html.includes('auth-loading-watchdog');
  if (!hasProductName || (!hasSignupCta && !hasAuthLoadingShell)) {
    const preview = html.slice(0, 500).replace(/\s+/g, ' ');
    throw new Error(`${target.label}: expected product shell, signup CTA, or current auth shell was not found (product=${hasProductName}, signup=${hasSignupCta}, authShell=${hasAuthLoadingShell}, staleAuth=${html.includes('در حال بررسی حساب کاربری...')}, preview=${preview})`);
  }
  if (html.includes('در حال بررسی حساب کاربری...')) {
    throw new Error(`${target.label}: stale authentication diagnostic text is present`);
  }

  if (/Gemini|Google|گوگل|جمنای/i.test(html)) {
    throw new Error(`${target.label}: external processor branding is visible in the public product shell`);
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

  const manifestResponse = await fetchWithRetry(`${target.origin}/manifest.webmanifest`);
  const manifest = await manifestResponse.json();
  if (!manifest.name || !manifest.short_name || !manifest.start_url || manifest.display !== 'standalone' || manifest.prefer_related_applications !== false) {
    throw new Error(`${target.label}: PWA manifest is missing required app identity or standalone settings`);
  }
  for (const requiredSize of ['192x192', '512x512']) {
    const icon = (manifest.icons || []).find((entry) =>
      (entry.sizes || '').split(/\s+/).includes(requiredSize) &&
      (entry.purpose || 'any').split(/\s+/).includes('any')
    );
    if (!icon) throw new Error(`${target.label}: PWA manifest is missing the ${requiredSize} install icon`);
  }
  const maskableIcon = (manifest.icons || []).find((entry) => (entry.purpose || '').split(/\s+/).includes('maskable'));
  if (!maskableIcon) throw new Error(`${target.label}: PWA manifest is missing a maskable icon`);
  for (const icon of manifest.icons) {
    const iconResponse = await fetchWithRetry(new URL(icon.src, target.origin).toString());
    if (!iconResponse.headers.get('content-type')?.includes('image/')) {
      throw new Error(`${target.label}: PWA icon has an invalid content type`);
    }
  }
  const workerResponse = await fetchWithRetry(`${target.origin}/sw.js`);
  const workerSource = await workerResponse.text();
  if (!workerSource.includes('self.addEventListener("fetch"') || !workerSource.includes('Never cache authenticated HTML')) {
    throw new Error(`${target.label}: service worker is missing its safe navigation handler`);
  }
  const offlineResponse = await fetchWithRetry(`${target.origin}/offline`);
  const offlineHtml = await offlineResponse.text();
  if (!offlineHtml.includes('اتصال اینترنت برقرار نیست')) {
    throw new Error(`${target.label}: offline fallback page is missing`);
  }

  const assets = [...html.matchAll(/(?:src|href)=["']([^"']*_next\\/static\\/[^"']+)["']/g)]
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

  console.log(`PASS ${target.label}: health, anonymous API rejection including account export, vendor-neutral errors, page shell, signup CTA, retired integration hidden, security headers, no-store app shell, and ${scripts.length} JavaScript asset(s)`);
}
