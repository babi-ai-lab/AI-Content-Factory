const targets = [
  { label: 'custom-domain', origin: 'https://app.eltbabak.ir' },
  { label: 'render-origin', origin: 'https://ai-content-factory-6m32.onrender.com' },
];

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

  const pageResponse = await fetchWithRetry(`${target.origin}/`);
  const html = await pageResponse.text();
  if (!html.includes('AI Content Factory') || !html.includes('شروع رایگان')) {
    throw new Error(`${target.label}: expected product shell or signup CTA was not found`);
  }
  if (html.includes('در حال بررسی حساب کاربری...')) {
    throw new Error(`${target.label}: stale authentication diagnostic text is present`);
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

  console.log(`PASS ${target.label}: health, page shell, signup CTA, and ${scripts.length} JavaScript asset(s)`);
}
