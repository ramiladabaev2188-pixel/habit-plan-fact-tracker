import {
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameMonth,
  parseISO,
  startOfMonth
} from "date-fns";
import { ru } from "date-fns/locale";

export const weekDayOptions = [
  { value: 1, label: "Пн" },
  { value: 2, label: "Вт" },
  { value: 3, label: "Ср" },
  { value: 4, label: "Чт" },
  { value: 5, label: "Пт" },
  { value: 6, label: "Сб" },
  { value: 0, label: "Вс" }
];

export function toDateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function getMonthDates(year: number, month: number) {
  const date = new Date(year, month - 1, 1);
  return eachDayOfInterval({
    start: startOfMonth(date),
    end: endOfMonth(date)
  });
}

export function getMonthTitle(year: number, month: number) {
  const date = new Date(year, month - 1, 1);
  return format(date, "LLLL yyyy", { locale: ru });
}

export function formatDayShort(dateKey: string) {
  return format(parseISO(dateKey), "d MMM", { locale: ru });
}

export function formatDayFull(dateKey: string) {
  return format(parseISO(dateKey), "d MMMM, EEEE", { locale: ru });
}

export function isWeekday(date: Date) {
  const day = getDay(date);
  return day >= 1 && day <= 5;
}

export function isDateInsideMonth(dateKey: string, year: number, month: number) {
  return isSameMonth(parseISO(dateKey), new Date(year, month - 1, 1));
}

export function getTodayKey() {
  return toDateKey(new Date());
}
