import type { CurrencyCode } from "../types";

export function formatCurrency(
  amount: number,
  currency: CurrencyCode = "INR"
): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(safeAmount);
  } catch {
    return `${currency} ${safeAmount.toFixed(2)}`;
  }
}

export function formatDate(date: string): string {
  if (!date) return "—";

  const parsed = new Date(`${date}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(parsed);
}

export function createId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function todayISO(): string {
  const now = new Date();
  const local = new Date(
    now.getTime() - now.getTimezoneOffset() * 60_000
  );

  return local.toISOString().slice(0, 10);
}
