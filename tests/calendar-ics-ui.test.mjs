import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Jalali monthly calendar exports only the visible month's scheduled items", async () => {
  const source = await readFile(new URL("../components/monthly-content-calendar.tsx", import.meta.url), "utf8");
  assert.match(source, /buildCalendarIcs\(monthItems\)/);
  assert.match(source, /text\/calendar;charset=utf-8/);
  assert.match(source, /content-calendar-\$\{visibleYear\}/);
  assert.match(source, /دریافت تقویم/);
  assert.match(source, /disabled=\{monthItems\.length === 0\}/);
});
