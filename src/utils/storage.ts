import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type Invoice,
  type StorageData
} from "../types";

const STORAGE_KEY = "invoicelite.data.v1";

export function readStorage(): StorageData {
  const defaults: StorageData = {
    version: 1,
    invoices: [],
    settings: structuredClone(DEFAULT_SETTINGS)
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) return defaults;

    const parsed: unknown = JSON.parse(raw);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("version" in parsed) ||
      !("invoices" in parsed) ||
      !("settings" in parsed)
    ) {
      return defaults;
    }

    const candidate = parsed as Partial<StorageData>;

    if (candidate.version !== 1) {
      return defaults;
    }

    return {
      version: 1,
      invoices: Array.isArray(candidate.invoices)
        ? candidate.invoices.filter(isInvoice)
        : [],
      settings: {
        ...DEFAULT_SETTINGS,
        ...(isRecord(candidate.settings) ? candidate.settings : {}),
        business: {
          ...DEFAULT_SETTINGS.business,
          ...(isRecord(candidate.settings) &&
          isRecord(candidate.settings.business)
            ? candidate.settings.business
            : {})
        }
      } as AppSettings
    };
  } catch {
    return defaults;
  }
}

export function writeStorage(data: StorageData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearStorage(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInvoice(value: unknown): value is Invoice {
  if (!isRecord(value)) return false;

  return (
    value.version === 1 &&
    typeof value.id === "string" &&
    typeof value.invoiceNumber === "string" &&
    typeof value.issueDate === "string" &&
    typeof value.dueDate === "string" &&
    Array.isArray(value.items) &&
    isRecord(value.business) &&
    isRecord(value.client)
  );
}
