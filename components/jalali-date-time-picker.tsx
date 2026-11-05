"use client";

import { useMemo, useState } from "react";

type JalaliParts = { year: number; month: number; day: number };

const monthNames = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const weekDays = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

function getJalaliParts(date: Date): JalaliParts {
  const parts = new Intl.DateTimeFormat("en-u-ca-persian", {
    year: "numeric", month: "numeric", day: "numeric",
  }).formatToParts(date);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  return { year: read("year"), month: read("month"), day: read("day") };
}

function fromJalali(year: number, month: number, day: number): Date | null {
  const start = new Date(year + 621, 2, 18);
  const end = new Date(year + 622, 3, 2);
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const parts = getJalaliParts(cursor);
    if (parts.year === year && parts.month === month && parts.day === day) {
      return new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
    }
  }
  return null;
}

function toPersianDigits(value: number | string) {
  return String(value).replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}

function monthLength(year: number, month: number) {
  for (let day = 31; day >= 29; day -= 1) {
    if (fromJalali(year, month, day)) return day;
  }
  return 29;
}

function shiftMonth(year: number, month: number, delta: number) {
  const index = year * 12 + month - 1 + delta;
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 + 1 };
}

function parseValue(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function JalaliDateTimePicker({
  value, onChange, label = "زمان انتشار",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const selected = parseValue(value);
  const today = new Date();
  const initial = getJalaliParts(selected || today);
  const [visibleYear, setVisibleYear] = useState(initial.year);
  const [visibleMonth, setVisibleMonth] = useState(initial.month);
  const [open, setOpen] = useState(false);

  const cells = useMemo(() => {
    const first = fromJalali(visibleYear, visibleMonth, 1);
    if (!first) return [];
    const offset = (first.getDay() + 1) % 7;
    const count = monthLength(visibleYear, visibleMonth);
    return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)];
  }, [visibleYear, visibleMonth]);

  const selectedParts = selected ? getJalaliParts(selected) : null;
  const dateLabel = selected
    ? new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "long", day: "numeric" }).format(selected)
    : "انتخاب تاریخ شمسی";

  function selectDay(day: number) {
    const date = fromJalali(visibleYear, visibleMonth, day);
    if (!date) return;
    const hours = selected ? selected.getHours() : 9;
    const minutes = selected ? selected.getMinutes() : 0;
    date.setHours(hours, minutes, 0, 0);
    onChange(date.toISOString());
    setOpen(false);
  }

  function changeTime(time: string) {
    if (!time) return;
    const [hours, minutes] = time.split(":").map(Number);
    const date = selected ? new Date(selected) : fromJalali(visibleYear, visibleMonth, 1);
    if (!date) return;
    date.setHours(hours, minutes, 0, 0);
    onChange(date.toISOString());
  }

  const timeValue = selected
    ? `${String(selected.getHours()).padStart(2, "0")}:${String(selected.getMinutes()).padStart(2, "0")}`
    : "09:00";

  return (
    <div className="schedule-control jalali-schedule" dir="rtl">
      <span>{label}</span>
      <button type="button" className="jalali-date-trigger" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        <span>{dateLabel}</span><span aria-hidden="true">▦</span>
      </button>
      {open && (
        <div className="jalali-calendar" role="dialog" aria-label="تقویم هجری شمسی">
          <div className="jalali-calendar-head">
            <button type="button" aria-label="ماه بعد" onClick={() => { const next = shiftMonth(visibleYear, visibleMonth, 1); setVisibleYear(next.year); setVisibleMonth(next.month); }}>‹</button>
            <strong>{monthNames[visibleMonth - 1]} {toPersianDigits(visibleYear)}</strong>
            <button type="button" aria-label="ماه قبل" onClick={() => { const previous = shiftMonth(visibleYear, visibleMonth, -1); setVisibleYear(previous.year); setVisibleMonth(previous.month); }}>›</button>
          </div>
          <div className="jalali-calendar-grid">
            {weekDays.map((day) => <span className="jalali-weekday" key={day}>{day.slice(0, 1)}</span>)}
            {cells.map((day, index) => day ? (
              <button
                type="button"
                key={`day-${day}`}
                className={selectedParts?.year === visibleYear && selectedParts.month === visibleMonth && selectedParts.day === day ? "selected" : ""}
                onClick={() => selectDay(day)}
              >{toPersianDigits(day)}</button>
            ) : <span key={`empty-${index}`} />)}
          </div>
          <div className="jalali-calendar-footer">
            <button type="button" onClick={() => {
              const now = new Date();
              const parts = getJalaliParts(now);
              setVisibleYear(parts.year);
              setVisibleMonth(parts.month);
              const date = fromJalali(parts.year, parts.month, parts.day);
              if (date) {
                date.setHours(now.getHours(), now.getMinutes(), 0, 0);
                onChange(date.toISOString());
              }
              setOpen(false);
            }}>امروز</button>
            <button type="button" onClick={() => setOpen(false)}>بستن</button>
          </div>
        </div>
      )}
      <label className="jalali-time-label">
        <span>ساعت انتشار</span>
        <input type="time" dir="ltr" value={timeValue} disabled={!selected} onChange={(event) => changeTime(event.target.value)} />
      </label>
      {value && <button type="button" className="jalali-clear" onClick={() => onChange("")}>پاک‌کردن زمان‌بندی</button>}
    </div>
  );
}
