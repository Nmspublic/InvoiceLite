
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Download,
  FileText,
  LayoutTemplate,
  Printer,
  Settings as SettingsIcon,
  ShieldCheck,
} from "lucide-react";

import type {
  AppPage,
  AppSettings,
  Invoice,
  InvoiceTemplate,
  StorageData,
} from "./types";

import { DEFAULT_SETTINGS } from "./types";
import {
  createId,
  todayISO,
  formatCurrency,
} from "./utils/formatting";
import {
  clearStorage,
  readStorage,
  writeStorage,
} from "./utils/storage";
import {
  exportInvoiceJSON,
  exportInvoicePDF,
} from "./utils/export";
import { validateInvoice } from "./utils/validation";

import Dashboard from "./components/Dashboard";
import InvoiceEditor from "./components/InvoiceEditor";
import InvoicePreview from "./components/InvoicePreview";
import Settings from "./components/Settings";
import TemplatePicker from "./components/TemplatePicker";

function createEmptyInvoice(
  settings: AppSettings,
  template: InvoiceTemplate,
): Invoice {
  const today = todayISO();
  const invoiceNumber =
    `${settings.invoicePrefix}${settings.nextInvoiceNumber}`;

  return {
    id: createId(),
    version: 1,
    invoiceNumber,
    issueDate: today,
    dueDate: today,
    currency: settings.currency,
    paymentTerms: settings.paymentTerms,
    purchaseOrder: "",
    business: { ...settings.business },
    client: {
      name: "",
      email: "",
      address: "",
      taxId: "",
    },
    items: [
      {
        id: createId(),
        description: "",
        quantity: 1,
        unitPrice: 0,
        discount: 0,
      },
    ],
    discountType: "fixed",
    invoiceDiscount: 0,
    taxLabel: settings.taxLabel,
    taxRate: settings.taxRate,
    shipping: 0,
    amountPaid: 0,
    notes: "",
    paymentInstructions: "",
    footer: "",
    template,
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function App() {
  const [storage, setStorage] = useState<StorageData>(() =>
    readStorage(),
  );
  const [page, setPage] = useState<AppPage>("dashboard");
  const [currentInvoiceId, setCurrentInvoiceId] =
    useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] =
    useState<InvoiceTemplate>(
      storage.settings.defaultTemplate,
    );
  const [notice, setNotice] = useState("");

  const settings = storage.settings ?? DEFAULT_SETTINGS;

  const currentInvoice =
    storage.invoices.find(
      (invoice) => invoice.id === currentInvoiceId,
    ) ?? null;

  useEffect(() => {
    writeStorage(storage);
  }, [storage]);

  useEffect(() => {
    if (!notice) return;

    const timeout = window.setTimeout(() => {
      setNotice("");
    }, 3500);

    return () => window.clearTimeout(timeout);
  }, [notice]);

  const notify = useCallback((message: string) => {
    setNotice(message);
  }, []);

  const updateInvoice = useCallback((updated: Invoice) => {
    setStorage((previous) => ({
      ...previous,
      invoices: previous.invoices.map((invoice) =>
        invoice.id === updated.id
          ? {
              ...updated,
              updatedAt: new Date().toISOString(),
            }
          : invoice,
      ),
    }));
  }, []);

  const updateSettings = useCallback(
    (updatedSettings: AppSettings) => {
      setStorage((previous) => ({
        ...previous,
        settings: updatedSettings,
      }));
    },
    [],
  );

  const backToDashboard = useCallback(() => {
    setPage("dashboard");
    setCurrentInvoiceId(null);
  }, []);

  const createInvoice = useCallback(
    (template: InvoiceTemplate = settings.defaultTemplate) => {
      const invoice = createEmptyInvoice(settings, template);

      setStorage((previous) => ({
        ...previous,
        invoices: [invoice, ...previous.invoices],
        settings: {
          ...previous.settings,
          nextInvoiceNumber:
            previous.settings.nextInvoiceNumber + 1,
        },
      }));

      setCurrentInvoiceId(invoice.id);
      setPage("editor");
      notify("Invoice created.");
    },
    [settings, notify],
  );

  const openInvoice = useCallback((id: string) => {
    setCurrentInvoiceId(id);
    setPage("editor");
  }, []);

  const duplicateInvoice = useCallback(
    (invoice: Invoice) => {
      const duplicate: Invoice = {
        ...invoice,
        id: createId(),
        invoiceNumber:
          `${settings.invoicePrefix}${settings.nextInvoiceNumber}`,
        status: "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: invoice.items.map((item) => ({
          ...item,
          id: createId(),
        })),
      };

      setStorage((previous) => ({
        ...previous,
        invoices: [duplicate, ...previous.invoices],
        settings: {
          ...previous.settings,
          nextInvoiceNumber:
            previous.settings.nextInvoiceNumber + 1,
        },
      }));

      setCurrentInvoiceId(duplicate.id);
      setPage("editor");
      notify("Invoice duplicated.");
    },
    [settings.invoicePrefix, settings.nextInvoiceNumber, notify],
  );

  const deleteInvoice = useCallback(
    (invoice: Invoice) => {
      const confirmed = window.confirm(
        `Delete ${invoice.invoiceNumber}? This cannot be undone.`,
      );

      if (!confirmed) return;

      setStorage((previous) => ({
        ...previous,
        invoices: previous.invoices.filter(
          (item) => item.id !== invoice.id,
        ),
      }));

      if (currentInvoiceId === invoice.id) {
        setCurrentInvoiceId(null);
        setPage("dashboard");
      }

      notify("Invoice deleted.");
    },
    [currentInvoiceId, notify],
  );

  const handleExportInvoice = useCallback(
    (invoice: Invoice) => {
      try {
        exportInvoiceJSON(invoice);
        notify("Invoice JSON downloaded.");
      } catch {
        notify("Could not export this invoice.");
      }
    },
    [notify],
  );

  const handleDownloadPDF = useCallback(() => {
    if (!currentInvoice) return;

    const result = validateInvoice(currentInvoice);

    if (!result.valid) {
      window.alert(
        `Please correct these issues before exporting:\n\n${result.errors.join("\n")}`,
      );
      return;
    }

    try {
      exportInvoicePDF(currentInvoice);
      notify("PDF download started.");
    } catch {
      notify("PDF export failed. Please try printing instead.");
    }
  }, [currentInvoice, notify]);

  const handleImport = useCallback(
    (value: unknown) => {
      if (!value || typeof value !== "object") {
        notify("This backup file is invalid.");
        return;
      }

      const imported = value as Partial<StorageData>;

      if (
        imported.version !== 1 ||
        !Array.isArray(imported.invoices) ||
        !imported.settings ||
        typeof imported.settings !== "object"
      ) {
        notify("This is not a supported InvoiceLite backup.");
        return;
      }

      const incomingSettings = imported.settings as AppSettings;

      if (
        !incomingSettings.business ||
        typeof incomingSettings.currency !== "string" ||
        typeof incomingSettings.nextInvoiceNumber !== "number"
      ) {
        notify("The backup settings are incomplete.");
        return;
      }

      setStorage({
        version: 1,
        invoices: imported.invoices as Invoice[],
        settings: {
          ...DEFAULT_SETTINGS,
          ...incomingSettings,
          business: {
            ...DEFAULT_SETTINGS.business,
            ...incomingSettings.business,
          },
        },
      });

      setCurrentInvoiceId(null);
      setPage("dashboard");
      notify("Backup imported.");
    },
    [notify],
  );

  const handleClear = useCallback(() => {
    const confirmed = window.confirm(
      "Delete all invoices and settings stored in this browser? Export a backup first if you need to keep your data.",
    );

    if (!confirmed) return;

    clearStorage();

    setStorage({
      version: 1,
      invoices: [],
      settings: { ...DEFAULT_SETTINGS, business: { ...DEFAULT_SETTINGS.business } },
    });

    setCurrentInvoiceId(null);
    setPage("dashboard");
    notify("Local data cleared.");
  }, [notify]);

  const pageTitle =
    page === "dashboard"
      ? "Invoices"
      : page === "editor"
        ? currentInvoice?.invoiceNumber ?? "Invoice editor"
        : page === "templates"
          ? "Choose a template"
          : "Settings";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={backToDashboard}
            className="flex items-center gap-3 text-left"
            aria-label="InvoiceLite home"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
              <FileText size={19} />
            </span>
            <span>
              <span className="block text-base font-bold tracking-tight">
                InvoiceLite
              </span>
              <span className="hidden text-xs text-slate-500 sm:block">
                Simple invoicing, done right.
              </span>
            </span>
          </button>

          <nav className="flex items-center gap-1">
            <button
              type="button"
              onClick={backToDashboard}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                page === "dashboard" || page === "editor"
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Invoices
            </button>

            <button
              type="button"
              onClick={() => setPage("templates")}
              className={`hidden rounded-lg px-3 py-2 text-sm font-medium sm:inline-flex ${
                page === "templates"
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <LayoutTemplate className="mr-2" size={16} />
              Templates
            </button>

            <button
              type="button"
              onClick={() => setPage("settings")}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                page === "settings"
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <SettingsIcon className="mr-2 inline" size={16} />
              <span className="hidden sm:inline">Settings</span>
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            {page === "editor" && (
              <button
                type="button"
                onClick={backToDashboard}
                className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
              >
                <ArrowLeft size={15} />
                Back to invoices
              </button>
            )}

            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {pageTitle}
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {page === "dashboard" &&
                "Create, manage, and export your invoices."}
              {page === "editor" &&
                "Edit invoice details and preview your document."}
              {page === "templates" &&
                "Choose a design for your next invoice."}
              {page === "settings" &&
                "Manage your business defaults and local data."}
            </p>
          </div>

          {page === "editor" && currentInvoice && (
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
            >
              <Download size={16} />
              Export PDF
            </button>
          )}
        </div>

        {page === "dashboard" && (
          <Dashboard
            invoices={storage.invoices}
            settings={settings}
            onCreateInvoice={() => setPage("templates")}
            onOpenInvoice={openInvoice}
            onDuplicateInvoice={duplicateInvoice}
            onDeleteInvoice={deleteInvoice}
            onExportInvoice={handleExportInvoice}
          />
        )}

        {page === "templates" && (
          <section className="space-y-6">
            <TemplatePicker
              value={selectedTemplate}
              onChange={setSelectedTemplate}
            />

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => createInvoice(selectedTemplate)}
                className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Create invoice with this template
              </button>

              <button
                type="button"
                onClick={backToDashboard}
                className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </section>
        )}

        {page === "editor" && currentInvoice && (
          <div className="grid items-start gap-8 xl:grid-cols-2">
            <div className="no-print min-w-0 space-y-5">
              <InvoiceEditor
                invoice={currentInvoice}
                onChange={updateInvoice}
              />

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  <Download size={16} />
                  Export PDF
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Printer size={16} />
                  Print
                </button>

                <button
                  type="button"
                  onClick={() => handleExportInvoice(currentInvoice)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Download size={16} />
                  Export JSON
                </button>

                <button
                  type="button"
                  onClick={() => duplicateInvoice(currentInvoice)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Duplicate
                </button>

                <button
                  type="button"
                  onClick={() => deleteInvoice(currentInvoice)}
                  className="rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>

            <section className="min-w-0">
              <div className="no-print mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">
                  Live preview
                </h2>
                <span className="text-xs text-slate-400">
                  A4 document
                </span>
              </div>

              <InvoicePreview invoice={currentInvoice} />
            </section>
          </div>
        )}

        {page === "settings" && (
          <Settings
            settings={settings}
            data={storage}
            onChange={updateSettings}
            onImport={handleImport}
            onClear={handleClear}
          />
        )}
      </main>

      <footer className="no-print border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            © {new Date().getFullYear()} InvoiceLite. Open-source invoicing.
          </p>
          <p className="flex items-center gap-2">
            <ShieldCheck size={14} />
            Your data stays in this browser.
          </p>
        </div>
      </footer>

      {notice && (
        <div
          role="status"
          aria-live="polite"
          className="no-print fixed bottom-5 right-5 z-50 max-w-sm rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg"
        >
          {notice}
        </div>
      )}
    </div>
  );
}

export default App;
