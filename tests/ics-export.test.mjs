import test from "node:test";
import assert from "node:assert/strict";
import { buildCalendarIcs } from "../lib/ics-export.mjs";

test("exports scheduled content as a standards-based UTC calendar", () => {
  const calendar = buildCalendarIcs([
    { id: "item-1", name: "کمپین, ویژه; پاییز", scheduledAt: "2026-11-07T12:30:00+03:30" },
  ], new Date("2026-11-06T10:00:00Z"));

  assert.match(calendar, /BEGIN:VCALENDAR/);
  assert.match(calendar, /VERSION:2\.0/);
  assert.match(calendar, /DTSTART:20261107T090000Z/);
  assert.match(calendar, /DTEND:20261107T093000Z/);
  const unfolded = calendar.replace(/\r\n[ \t]/g, "");
  assert.ok(unfolded.includes("SUMMARY:کمپین\\, ویژه\\; پاییز"));
  assert.match(calendar, /STATUS:CONFIRMED/);
  assert.match(calendar, /END:VCALENDAR/);
});

test("folds long UTF-8 lines and rejects invalid event dates", () => {
  const calendar = buildCalendarIcs([
    { id: "long", name: "محتوای بسیار طولانی ".repeat(12), scheduledAt: "2026-11-07T09:00:00Z" },
  ]);
  for (const line of calendar.split("\r\n")) {
    assert.ok(new TextEncoder().encode(line).byteLength <= 75);
  }
  assert.throws(
    () => buildCalendarIcs([{ id: "bad", name: "محتوا", scheduledAt: "not-a-date" }]),
    /invalid date/,
  );
});
