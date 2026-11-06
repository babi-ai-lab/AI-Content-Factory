import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("campaign manager supports comparing up to four campaigns across key performance metrics", async () => {
  const source = await readFile(new URL("../components/campaign-manager.tsx", import.meta.url), "utf8");
  assert.match(source, /selectedComparisonIds/);
  assert.match(source, /حداکثر ۴ کمپین/);
  assert.match(source, /campaign-comparison-table/);
  assert.match(source, /calculateCampaignMetrics/);
  assert.match(source, /نرخ کلیک \(CTR\)/);
  assert.match(source, /هزینه هر سرنخ \(CPL\)/);
  assert.match(source, /بازده هزینه تبلیغ \(ROAS\)/);
});
