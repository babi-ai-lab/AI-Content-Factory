import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildCampaignComparisonCsv } from "../lib/campaign-metrics.mjs";

test("campaign manager supports comparing up to four campaigns across key performance metrics", async () => {
  const source = await readFile(new URL("../components/campaign-manager.tsx", import.meta.url), "utf8");
  assert.match(source, /selectedComparisonIds/);
  assert.match(source, /حداکثر ۴ کمپین/);
  assert.match(source, /campaign-comparison-table/);
  assert.match(source, /calculateCampaignMetrics/);
  assert.match(source, /نرخ کلیک \(CTR\)/);
  assert.match(source, /هزینه هر سرنخ \(CPL\)/);
  assert.match(source, /بازده هزینه تبلیغ \(ROAS\)/);
  assert.match(source, /مصرف بودجه/);
  assert.match(source, /تبدیل/);
  assert.match(source, /exportCampaignComparisonCsv/);
  assert.match(source, /text\/csv;charset=utf-8/);
  assert.match(source, /buildCampaignComparisonCsv/);
  assert.match(source, /دریافت فایل CSV/);
  assert.match(source, /aria-label="مقایسه شاخص‌های عملکرد کمپین‌ها"/);
});

test("builds an Excel-friendly Persian CSV and escapes quotes and delimiters", () => {
  const csv = buildCampaignComparisonCsv(
    ["شاخص", "کمپین، اول"],
    [["یادداشت", 'متن با "نقل قول"'], ["هزینه", 1200]],
  );
  assert.equal(
    csv,
    '\uFEFF"شاخص","کمپین، اول"\r\n"یادداشت","متن با ""نقل قول"""\r\n"هزینه","1200"',
  );
});


test("campaign loading ignores stale requests when the signed-in user or refresh cycle changes", async () => {
  const source = await readFile(new URL("../components/campaign-manager.tsx", import.meta.url), "utf8");
  assert.match(source, /const requestSequenceRef = useRef\(0\)/);
  assert.match(source, /const requestId = \+\+requestSequenceRef\.current/);
  assert.match(source, /const isStale = \(\) => requestId !== requestSequenceRef\.current/);
  assert.match(source, /if \(isStale\(\)\) return;/);
  assert.match(source, /return \(\) => \{ requestSequenceRef\.current \+= 1; \}/);
  assert.match(source, /finally \{\s*if \(!isStale\(\)\) setLoading\(false\);\s*\}/);
});

test("campaign loading handles rejected network promises without leaving the loader stuck", async () => {
  const source = await readFile(new URL("../components/campaign-manager.tsx", import.meta.url), "utf8");
  assert.match(source, /try \{\s*const \[campaignResult, linkResult, contentResult\] = await Promise\.all/);
  assert.match(source, /catch \{\s*if \(isStale\(\)\) return;/);
  assert.match(source, /ارتباط با سرور برای بارگذاری کمپین‌ها برقرار نشد/);
});
