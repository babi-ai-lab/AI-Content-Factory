"use client";

import { useMemo, useState } from "react";
import JalaliDateTimePicker from "@/components/jalali-date-time-picker";

type CalendarItem = {
  id: string;
  name: string;
  scheduledAt: string;
};

type Props = {
  items: CalendarItem[];
  onOpen: (id: string) => void;
  onReschedule: (id: string, value: string) => void;
};

type JalaliParts = { year: number; month: number; day: number };

const monthNames = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const weekdays = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

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

function shiftMonth(year: number, month: number, delta: number) {
  const index = year * 12 + month - 1 + delta;
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 + 1 };
}

function toPersianDigits(value: number | string) {
  return String(value).replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}

function dayKey(parts: JalaliParts) {
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "ساعت نامشخص"
    : new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

export default function MonthlyContentCalendar({ items, onOpen, onReschedule }: Props) {
  const today = getJalaliParts(new Date());
  const [visibleYear, setVisibleYear] = useState(today.year);
  const [visibleMonth, setVisibleMonth] = useState(today.month);
  const [selectedDay, setSelectedDay] = useState(today.day);

  const monthDays = useMemo(() => {
    const first = fromJalali(visibleYear, visibleMonth, 1);
    if (!first) return [];
    const offset = (first.getDay() + 1) % 7;
    const nextMonth = shiftMonth(visibleYear, visibleMonth, 1);
    const nextFirst = fromJalali(nextMonth.year, nextMonth.month, 1);
    if (!nextFirst) return [];
    const last = new Date(nextFirst);
    last.setDate(last.getDate() - 1);
    const count = last.getDate();
    return [
      ...Array.from({ length: offset }, () => null),
      ...Array.from({ length: count }, (_, index) => index + 1),
    ];
  }, [visibleYear, visibleMonth]);

  const monthItems = useMemo(() => items
    .filter((item) => {
      const date = new Date(item.scheduledAt);
      if (Number.isNaN(date.getTime())) return false;
      const parts = getJalaliParts(date);
      return parts.year === visibleYear && parts.month === visibleMonth;
    })
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
  [items, visibleYear, visibleMonth]);

  const selectedItems = monthItems.filter((item) => {
    const parts = getJalaliParts(new Date(item.scheduledAt));
    return parts.day === selectedDay;
  });

  function changeMonth(delta: number) {
    const next = shiftMonth(visibleYear, visibleMonth, delta);
    setVisibleYear(next.year);
    setVisibleMonth(next.month);
    setSelectedDay(1);
  }

  return (
    <div className="monthly-calendar" dir="rtl">
      <div className="monthly-calendar-toolbar">
        <div className="monthly-calendar-month">
          <strong>{monthNames[visibleMonth - 1]} {toPersianDigits(visibleYear)}</strong>
          <span>{toPersianDigits(monthItems.length)} برنامه در این ماه</span>
        </div>
        <div className="monthly-calendar-actions">
          <button type="button" onClick={() => changeMonth(1)} aria-label="ماه بعد">ماه بعد ←</button>
          <button type="button" onClick={() => {
            setVisibleYear(today.year);
            setVisibleMonth(today.month);
            setSelectedDay(today.day);
          }}>امروز</button>
          <button type="button" onClick={() => changeMonth(-1)} aria-label="ماه قبل">→ ماه قبل</button>
        </div>
      </div>

      <div className="monthly-calendar-grid">
        {weekdays.map((day) => <div className="monthly-calendar-weekday" key={day}>{day}</div>)}
        {monthDays.map((day, index) => {
          if (!day) return <div className="monthly-calendar-blank" key={`blank-${index}`} />;
          const dayItems = monthItems.filter((item) => getJalaliParts(new Date(item.scheduledAt)).day === day);
          const isToday = visibleYear === today.year && visibleMonth === today.month && day === today.day;
          return (
            <button
              type="button"
              key={day}
              className={`monthly-calendar-day${selectedDay === day ? " is-selected" : ""}${isToday ? " is-today" : ""}`}
              onClick={() => setSelectedDay(day)}
              aria-pressed={selectedDay === day}
            >
              <span className="monthly-calendar-day-number">{toPersianDigits(day)}</span>
              {dayItems.length > 0 && (
                <span className="monthly-calendar-day-events">
                  <span className="monthly-calendar-dots" aria-hidden="true">{dayItems.slice(0, 3).map((item) => <i key={item.id} />)}</span>
                  <small>{toPersianDigits(dayItems.length)} برنامه</small>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="monthly-calendar-agenda">
        <div className="monthly-calendar-agenda-head">
          <strong>برنامه‌های {toPersianDigits(selectedDay)} {monthNames[visibleMonth - 1]}</strong>
          <span>{toPersianDigits(selectedItems.length)} مورد</span>
        </div>
        {selectedItems.length === 0 ? (
          <p className="planner-empty-inline">برای این روز برنامه‌ای ثبت نشده است. از تاریخچه یک محتوا را زمان‌بندی کن.</p>
        ) : (
          <div className="monthly-calendar-agenda-list">
            {selectedItems.map((item) => (
              <article className="monthly-calendar-agenda-item" key={item.id}>
                <div className="monthly-calendar-agenda-info">
                  <b>{item.name || "محتوا بدون نام"}</b>
                  <small>{formatTime(item.scheduledAt)}</small>
                  <button type="button" className="history-open" onClick={() => onOpen(item.id)}>باز کردن محتوا</button>
                </div>
                <JalaliDateTimePicker
                  value={item.scheduledAt}
                  onChange={(value) => onReschedule(item.id, value)}
                  label="تغییر زمان انتشار"
                />
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
