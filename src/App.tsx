
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Download,
  FilePlus2,
  FileText,
  LayoutTemplate,
  Printer,
  Settings as SettingsIcon,
  ShieldCheck,
  Copy,
  Trash2,
  X,
} from "lucide-react";

import type {
  AppPage,
  AppSettings,
  Invoice,
  InvoiceItem,
  InvoiceTemplate,
  StorageData,
} from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { createId, todayISO } from "./utils/formatting";
import { clearStorage, readStorage, writeStorage } from "./utils/storage";
import { exportInvoiceJSON, exportInvoicePDF } from "./utils/export";
import { validateInvoice } from "./utils/validation";

import Dashboard from "./components/Dashboard";
import InvoiceEditor from "./components/InvoiceEditor";
import InvoicePreview from "./components/InvoicePreview";
import Settings from "./components/Settings";
import TemplatePicker from "./components/TemplatePicker";
import Modal from "./components/Modal";
import Toast, { type ToastMessage } from "./components/Toast";

function createEmptyItem(): InvoiceItem {
  return {
    id: createId(),
    description: "",
    quantity: 1,
    unitPrice: 0,
    discount: 0,
  };
}

function createEmptyInvoice(
  settings: AppSettings,
  template: InvoiceTemplate,
): Invoice {
  const today = todayISO();

  return {
    id: createId(),
    version: 1,
    invoiceNumber: `${settings.invoicePrefix}${settings.nextInvoiceNumber}`,
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
    items: [createEmptyItem()],
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
  const [storage, setStorage] = useState<StorageData>(() => readStorage());
  const [page, setPage] = useState<AppPage>("dashboard");
  const [currentInvoiceId, setCurrentInvoiceId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] =
    useState<InvoiceTemplate>(DEFAULT_SETTINGS.defaultTemplate);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [modal, setModal] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const settings = storage.settings ?? DEFAULT_SETTINGS;

  const currentInvoice =
    storage.invoices.find((invoice) => invoice.id === currentInvoiceId) ?? null;

  useEffect(() => {
    writeStorage(storage);
  }, [storage]);

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notify = useCallback(
    (message: string, type: ToastMessage["type"] = "success") => {
      setToast({ id: createId(), message, type });
    },
    [],
  );

  const backToDashboard = useCallback(() => {
    setPage("dashboard");
    setCurrentInvoiceId(null);
    setMobileMenuOpen(false);
  }, []);

  const updateInvoice = useCallback((updated: Invoice) => {
    setStorage((previous) => ({
      ...previous,
      invoices: previous.invoices.map((invoice) =>
        invoice.id === updated.id
          ? { ...updated, updatedAt: new Date().toISOString() }
          : invoice,
      ),
    }));
  }, []);

  const updateSettings = useCallback((updated: AppSettings) => {
    setStorage((previous) => ({
      ...previous,
      settings: updated,
    }));
  }, []);

  const createInvoice = useCallback(
    (template: InvoiceTemplate = settings.defaultTemplate) => {
      const invoice = createEmptyInvoice(settings, template);

      setStorage((previous) => ({
        ...previous,
        invoices: [invoice, ...previous.invoices],
        settings: {
          ...previous.settings,
          nextInvoiceNumber: previous.settings.nextInvoiceNumber + 1,
        },
      }));

      setCurrentInvoiceId(invoice.id);
      setPage("editor");
      notify("New invoice created.");
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
        invoiceNumber: `${settings.invoicePrefix}${settings.nextInvoiceNumber}`,
        status: "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: invoice.items.map((item) => ({ ...item, id: createId() })),
      };

      setStorage((previous) => ({
        ...previous,
        invoices: [duplicate, ...previous.invoices],
        settings: {
          ...previous.settings,
          nextInvoiceNumber: previous.settings.nextInvoiceNumber + 1,
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
      setModal({
        title: "Delete invoice?",
        message: `Are you sure you want to delete ${invoice.invoiceNumber}? This cannot be undone.`,
        confirmLabel: "Delete invoice",
        onConfirm: () => {
          setStorage((previous) => ({
            ...previous,
            invoices: previous.invoices.filter((item) => item.id !== invoice.id),
          }));

          if (currentInvoiceId === invoice.id) {
            setCurrentInvoiceId(null);
            setPage("dashboard");
          }

          setModal(null);
          notify("Invoice deleted.");
        },
      });
    },
    [currentInvoiceId, notify],
  );

  const handleExportInvoice = useCallback(
    (invoice: Invoice) => {
      try {
        exportInvoiceJSON(invoice);
        notify("Invoice JSON exported.");
      } catch {
        notify("Could not export the invoice.", "error");
      }
    },
    [notify],
  );

  const handleDownloadPDF = useCallback(async () => {
    if (!currentInvoice) return;

    const result = validateInvoice(currentInvoice);

    if (!result.valid) {
      setModal({
        title: "Invoice needs attention",
        message: result.errors.join("\n"),
        confirmLabel: "Got it",
        onConfirm: () => setModal(null),
      });
      return;
    }

    try {
      await exportInvoicePDF(currentInvoice);
      notify("PDF export started.");
    } catch {
      notify("PDF export failed. Try printing instead.", "error");
    }
  }, [currentInvoice, notify]);

  const handleImport = useCallback(
    (data: unknown) => {
      if (!data || typeof data !== "object") {
        notify("Invalid backup file.", "error");
        return;
      }

      const imported = data as Partial<StorageData>;

      if (!Array.isArray(imported.invoices)) {
        notify("The backup does not contain a valid invoice list.", "error");
        return;
      }

      const importedSettings = imported.settings;

      if (
        !importedSettings ||
        typeof importedSettings !== "object" ||
        !importedSettings.business
      ) {
        notify("The backup does not contain valid settings.", "error");
        return;
      }

      const invoices = imported.invoices as Invoice[];

      setStorage({
        version: 1,
        invoices: invoices.map((invoice) => ({
          ...invoice,
          id: invoice.id || createId(),
          version: 1,
          items:
            Array.isArray(invoice.items) && invoice.items.length
              ? invoice.items
              : [createEmptyItem()],
          createdAt: invoice.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
        settings: {
          ...DEFAULT_SETTINGS,
          ...importedSettings,
          business: {
            ...DEFAULT_SETTINGS.business,
            ...importedSettings.business,
          },
        },
      });

      setCurrentInvoiceId(null);
      setPage("dashboard");
      notify("Backup imported.");
    },
    [notify],
  );

  const resetAllData = useCallback(() => {
    setModal({
      title: "Delete all local data?",
      message:
        "This permanently removes all invoices and settings from this browser. Export a backup first if you need to keep your data.",
      confirmLabel: "Delete everything",
      onConfirm: () => {
        clearStorage();
        setStorage({
          version: 1,
          invoices: [],
          settings: {
            ...DEFAULT_SETTINGS,
            business: { ...DEFAULT_SETTINGS.business },
          },
        });
        setCurrentInvoiceId(null);
        setPage("dashboard");
        setModal(null);
        notify("All local data has been deleted.");
      },
    });
  }, [notify]);

  const exportAll = useCallback(() => {
    try {
      const backup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        invoices: storage.invoices,
        settings: storage.settings,
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "invoicelite-backup.json";
      anchor.click();
      URL.revokeObjectURL(url);
      notify("Backup exported.");
    } catch {
      notify("Could not export the backup.", "error");
    }
  }, [storage, notify]);

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

          <nav className="hidden items-center gap-1 md:flex">
            <button
              type="button"
              onClick={backToDashboard}
              className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-100"
            >
              <FileText className="mr-2 inline" size={16} />
              Invoices
            </button>
            <button
              type="button"
              onClick={() => setPage("templates")}
              className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-100"
            >
              <LayoutTemplate className="mr-2 inline" size={16} />
              Templates
            </button>
            <button
              type="button"
              onClick={() => setPage("settings")}
              className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-100"
            >
              <SettingsIcon className="mr-2 inline" size={16} />
              Settings
            </button>
          </nav>

          <div className="flex items-center gap-2">
            {page === "editor" && currentInvoice && (
              <button
                type="button"
                onClick={handleDownloadPDF}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              >
                <Download size={16} />
                <span className="hidden sm:inline">Export PDF</span>
                <span className="sm:hidden">PDF</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
              aria-label="Toggle navigation"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={20} /> : <LayoutTemplate size={20} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-slate-200 bg-white p-3 md:hidden">
            <button
              type="button"
              onClick={backToDashboard}
              className="block w-full rounded-lg px-3 py-3 text-left text-sm hover:bg-slate-100"
            >
              Invoices
            </button>
            <button
              type="button"
              onClick={() => {
                setPage("templates");
                setMobileMenuOpen(false);
              }}
              className="block w-full rounded-lg px-3 py-3 text-left text-sm hover:bg-slate-100"
            >
              Templates
            </button>
            <button
              type="button"
              onClick={() => {
                setPage("settings");
                setMobileMenuOpen(false);
              }}
              className="block w-full rounded-lg px-3 py-3 text-left text-sm hover:bg-slate-100"
            >
              Settings
            </button>
          </div>
        )}
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
              {page === "dashboard" && "Create, manage, and export invoices."}
              {page === "editor" && "Edit invoice details and preview your document."}
              {page === "templates" && "Choose a design for your next invoice."}
              {page === "settings" && "Manage your business defaults and local data."}
            </p>
          </div>

          {page === "dashboard" && (
            <button
              type="button"
              onClick={() => setPage("templates")}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
            >
              <FilePlus2 size={17} />
              New invoice
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
                Create invoice
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
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Copy size={16} />
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => deleteInvoice(currentInvoice)}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </div>

            <section className="min-w-0">
              <div className="no-print mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">
                  Live preview
                </h2>
                <span className="text-xs text-slate-400">A4 document</span>
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
            onClear={resetAllData}
          />
        )}
      </main>

      <footer className="no-print border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} InvoiceLite. Open-source invoicing.</p>
          <p className="flex items-center gap-2">
            <ShieldCheck size={14} />
            Your data stays in this browser.
          </p>
        </div>
      </footer>

      {modal && (
        <Modal
          title={modal.title}
          message={modal.message}
          confirmLabel={modal.confirmLabel}
          onConfirm={modal.onConfirm}
          onClose={() => setModal(null)}
        />
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export default App;
