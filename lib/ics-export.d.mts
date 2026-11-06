export type CalendarIcsItem = {
  id: string;
  name: string;
  scheduledAt: string;
};
export function buildCalendarIcs(items: readonly CalendarIcsItem[], now?: Date | string): string;
