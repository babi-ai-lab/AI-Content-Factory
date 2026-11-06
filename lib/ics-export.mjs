const encoder = new TextEncoder();

function escapeIcsText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function toIcsUtcDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Calendar event has an invalid date.");
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function foldIcsLine(line) {
  const parts = [];
  let current = "";
  let byteLength = 0;
  for (const character of Array.from(line)) {
    const characterBytes = encoder.encode(character).byteLength;
    if (current && byteLength + characterBytes > 75) {
      parts.push(current);
      current = ` ${character}`;
      byteLength = 1 + characterBytes;
    } else {
      current += character;
      byteLength += characterBytes;
    }
  }
  if (current) parts.push(current);
  return parts.join("\r\n");
}

export function buildCalendarIcs(items, now = new Date()) {
  if (!Array.isArray(items)) throw new TypeError("Calendar items must be an array.");
  const stamp = toIcsUtcDate(now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ELTBabak//Content Calendar//FA",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText("تقویم محتوایی")}`,
  ];

  for (const item of items) {
    if (!item || typeof item.id !== "string" || !item.id.trim()) {
      throw new TypeError("Every calendar event requires an ID.");
    }
    const start = new Date(item.scheduledAt);
    if (Number.isNaN(start.getTime())) throw new TypeError("Calendar event has an invalid date.");
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${encodeURIComponent(item.id)}@eltbabak.ir`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toIcsUtcDate(start)}`,
      `DTEND:${toIcsUtcDate(end)}`,
      `SUMMARY:${escapeIcsText(item.name || "محتوای زمان‌بندی‌شده")}`,
      `DESCRIPTION:${escapeIcsText("برنامه انتشار محتوا در تقویم محتوایی.")}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}
