import { useRef, useState } from "react";
import {
  Building2,
  Download,
  ShieldCheck,
  Upload,
  Trash2,
  Settings2
} from "lucide-react";
import type { AppSettings, StorageData } from "../types";
import { CURRENCIES } from "../types";
import { exportAllDataJSON, importJSONFile } from "../utils/export";

interface SettingsProps {
  settings: AppSettings;
  data: StorageData;
  onChange: (settings: AppSettings) => void;
  onImport: (data: unknown) => void;
  onClear: () => void;
}

export default function Settings({
  settings,
  data,
  onChange,
  onImport,
  onClear
}: SettingsProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState("");

  function update<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) {
    onChange({ ...settings, [key]: value });
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setImportError("");

    try {
      const parsed = await importJSONFile(file);
      onImport(parsed);
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Could not import this file."
      );
    }

    event.target.value = "";
  }

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <header>
        <p className="text-sm font-medium text-indigo-600">PREFERENCES</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          Settings
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Set up your defaults and manage your local data.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-6 flex items-center gap-3">
          <span className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">
            <Building2 size={20} />
          </span>
          <div>
            <h2 className="font-semibold text-slate-900">Business defaults</h2>
            <p className="text-sm text-slate-500">
              Automatically populate new invoices.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["name", "Business name", "Your business name"],
              ["email", "Business email", "hello@example.com"],
              ["phone", "Phone number", "+91 00000 00000"],
              ["website", "Website", "https://example.com"]
            ] as const
          ).map(([key, label, placeholder]) => (
            <label key={key} className="block space-y-1.5 text-sm font-medium text-slate-700">
              {label}
              <input
                value={settings.business[key]}
                placeholder={placeholder}
                type={key === "email" ? "email" : "text"}
                onChange={(e) =>
                  update("business", {
                    ...settings.business,
                    [key]: e.target.value
                  })
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
              />
            </label>
          ))}

          <label className="block space-y-1.5 text-sm font-medium text-slate-700 sm:col-span-2">
            Business address
            <textarea
              value={settings.business.address}
              onChange={(e) =>
                update("business", {
                  ...settings.business,
                  address: e.target.value
                })
              }
              rows={3}
              placeholder="Street, city, postal code"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-6 flex items-center gap-3">
          <span className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">
            <Settings2 size={20} />
          </span>
          <div>
            <h2 className="font-semibold text-slate-900">Invoice defaults</h2>
            <p className="text-sm text-slate-500">
              Applied when creating new invoices.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5 text-sm font-medium text-slate-700">
            Default currency
            <select
              value={settings.currency}
              onChange={(e) =>
                update("currency", e.target.value as AppSettings["currency"])
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-indigo-500"
            >
              {CURRENCIES.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} — {currency.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5 text-sm font-medium text-slate-700">
            Default template
            <select
              value={settings.defaultTemplate}
              onChange={(e) =>
                update(
                  "defaultTemplate",
                  e.target.value as AppSettings["defaultTemplate"]
                )
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-indigo-500"
            >
              <option value="classic">Classic</option>
              <option value="modern">Modern</option>
              <option value="elegant">Elegant</option>
            </select>
          </label>

          <label className="block space-y-1.5 text-sm font-medium text-slate-700">
            Invoice number prefix
            <input
              value={settings.invoicePrefix}
              maxLength={20}
              onChange={(e) => update("invoicePrefix", e.target.value)}
              placeholder="INV-"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-indigo-500"
            />
          </label>

          <label className="block space-y-1.5 text-sm font-medium text-slate-700">
            Next invoice number
            <input
              type="number"
              min={1}
              max={999999999}
              step={1}
              value={settings.nextInvoiceNumber}
              onChange={(e) =>
                update(
                  "nextInvoiceNumber",
                  Math.max(1, Math.min(999999999, Math.floor(Number(e.target.value) || 1)))
                )
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-indigo-500"
            />
          </label>

          <label className="block space-y-1.5 text-sm font-medium text-slate-700">
            Default payment terms
            <input
              value={settings.paymentTerms}
              onChange={(e) => update("paymentTerms", e.target.value)}
              placeholder="Due within 14 days"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-indigo-500"
            />
          </label>

          <label className="block space-y-1.5 text-sm font-medium text-slate-700">
            Default tax label
            <input
              value={settings.taxLabel}
              onChange={(e) => update("taxLabel", e.target.value)}
              placeholder="Tax, VAT, GST..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-indigo-500"
            />
          </label>

          <label className="block space-y-1.5 text-sm font-medium text-slate-700 sm:col-span-2">
            Default tax rate (%)
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={settings.taxRate}
              onChange={(e) =>
                update("taxRate", Math.min(100, Math.max(0, Number(e.target.value) || 0)))
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-indigo-500"
            />
            <span className="block text-xs font-normal leading-5 text-slate-500">
              This is your own configurable default, not a tax recommendation.
              Verify applicable tax rules before issuing invoices.
            </span>
          </label>

          <label className="block space-y-1.5 text-sm font-medium text-slate-700 sm:col-span-2">
            Theme preference
            <select
              value={settings.theme}
              onChange={(e) =>
                update("theme", e.target.value as AppSettings["theme"])
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-indigo-500"
            >
              <option value="light">Light</option>
              <option value="dark">Dark (system interface support)</option>
              <option value="system">Follow system</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-5 flex items-center gap-3">
          <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
            <ShieldCheck size={20} />
          </span>
          <div>
            <h2 className="font-semibold text-slate-900">Your data and privacy</h2>
            <p className="text-sm text-slate-500">
              No account or cloud storage required.
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          <p>
            <strong className="text-slate-800">Stored locally:</strong>{" "}
            {data.invoices.length} invoice(s) and your preferences.
          </p>
          <p className="mt-2">
            Your information stays in this browser's local storage. It is not
            automatically synced to other devices. Clearing browser data or
            switching browsers may remove your invoices. Download a backup
            regularly.
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => exportAllDataJSON(data)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download size={17} />
            Export all data
          </button>

          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Upload size={17} />
            Import JSON backup
          </button>

          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            onChange={handleImport}
            className="hidden"
          />

          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            <Trash2 size={17} />
            Clear all local data
          </button>
        </div>

        {importError && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {importError}
          </p>
        )}
      </section>
    </div>
  );
}
