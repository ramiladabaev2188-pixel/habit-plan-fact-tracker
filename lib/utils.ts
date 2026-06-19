import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPercent(value: number, digits = 0) {
  if (!Number.isFinite(value)) {
    return "0%";
  }

  return `${(value * 100).toFixed(digits)}%`;
}

export function formatScore(value: number, digits = 1) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: digits,
    minimumFractionDigits: value % 1 === 0 ? 0 : Math.min(digits, 1)
  }).format(value);
}
