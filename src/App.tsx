
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Download,
  FilePlus2,
  FileText,
  LayoutTemplate,
  Menu,
  MoreHorizontal,
  Printer,
  Settings as SettingsIcon,
  ShieldCheck,
  X,
  Copy,
  Trash2,
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
import Modal from "./components/Modal";
import Toast from "./components/Toast";

function createEmptyItem(): InvoiceItem {
  return {
    id: createId(),
    description: "",
    quantity: 1,
    rate: 0,
    taxRate: 0,
  };
}

function createEmptyInvoice(
  settings: AppSettings,
  template: InvoiceTemplate = "classic",
): Invoice {
  const now = todayISO();

  return {
    id: createId(),
    invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
    status: "draft",
    issueDate: now,
    dueDate: now,
    currency: settings.currency,
    template,
    business: {
      name: settings.businessName,
      email: settings.businessEmail,
      phone: settings.businessPhone,
      address: settings.businessAddress,
      taxId: settings.taxId,
      logo: settings.logo,
    },
    client: {
      name: "",
      email: "",
      phone: "",
      address: "",
      taxId: "",
    },
    items: [createEmptyItem()],
    notes: "",
    terms: "",
    discountType: "amount",
    discountValue: 0,
    taxRate: 0,
    amountPaid: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeInvoice(invoice: Invoice): Invoice {
  const now = new Date().toISOString();

  return {
    ...invoice,
    id: invoice.id || createId(),
    invoiceNumber: invoice.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
    items:
      Array.isArray(invoice.items) && invoice.items.length > 0
        ? invoice.items
        : [createEmptyItem()],
    createdAt: invoice.createdAt || now,
    updatedAt: now,
  };
}

function App() {
  const [storage, setStorage] = useState<StorageData>(() => readStorage());
  const [page, setPage] = useState<AppPage>("dashboard");
  const [currentInvoiceId, setCurrentInvoiceId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [modal, setModal] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  const settings = storage.settings ?? DEFAULT_SETTINGS;

  const currentInvoice =
    storage.invoices.find((invoice) => invoice.id === currentInvoiceId) ?? null;

  const notify = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  useEffect(() => {
    writeStorage(storage);
  }, [storage]);

  useEffect(() => {
    if (!toastMessage) return;

    const timeout = window.setTimeout(() => {
      setToastMessage("");
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  const updateInvoice = useCallback(
    (updatedInvoice: Invoice) => {
      setStorage((previous) => ({
        ...previous,
        invoices: previous.invoices.map((invoice) =>
          invoice.id === updatedInvoice.id
            ? {
                ...updatedInvoice,
                updatedAt: new Date().toISOString(),
              }
            : invoice,
        ),
      }));
    },
    [],
  );

  const updateSettings = useCallback((updatedSettings: AppSettings) => {
    setStorage((previous) => ({
      ...previous,
      settings: updatedSettings,
    }));
  }, []);

  const createInvoice = useCallback(
    (template: InvoiceTemplate = "classic") => {
      const invoice = createEmptyInvoice(settings, template);

      setStorage((previous) => ({
        ...previous,
        invoices: [invoice, ...previous.invoices],
      }));

      setCurrentInvoiceId(invoice.id);
      setPage("editor");
      notify("New invoice created.");
    },
    [settings, notify],
  );

  const openInvoice = useCallback((invoiceId: string) => {
    setCurrentInvoiceId(invoiceId);
    setPage("editor");
  }, []);

  const backToDashboard = useCallback(() => {
    setPage("dashboard");
    setCurrentInvoiceId(null);
  }, []);

  const duplicateInvoice = useCallback(
    (invoice: Invoice) => {
      const duplicate: Invoice = {
        ...invoice,
        id: createId(),
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
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
      }));

      setCurrentInvoiceId(duplicate.id);
      setPage("editor");
      notify("Invoice duplicated.");
    },
    [notify],
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
            invoices: previous.invoices.filter(
              (item) => item.id !== invoice.id,
            ),
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
        notify("Could not export the invoice.");
      }
    },
    [notify],
  );

  const handleDownloadPDF = useCallback(async () => {
    if (!currentInvoice) return;

    const errors = validateInvoice(currentInvoice);

    if (errors.length > 0) {
      setModal({
        title: "Invoice needs attention",
        message: errors.join("\n"),
        confirmLabel: "Got it",
        onConfirm: () => setModal(null),
      });
      return;
    }

    try {
      await exportInvoicePDF(currentInvoice);
      notify("PDF export started.");
    } catch {
      notify("Could not generate the PDF. Try printing instead.");
    }
  }, [currentInvoice, notify]);

  const handleImportData = useCallback((data: unknown) => {
    if (!data || typeof data !== "object") {
      notify("Invalid backup file.");
      return;
    }

    const imported = data as Partial<StorageData>;

    if (!Array.isArray(imported.invoices)) {
      notify("The backup does not contain a valid invoice list.");
      return;
    }

    const importedInvoices = imported.invoices.map((invoice) =>
      normalizeInvoice(invoice as Invoice),
    );

    setStorage((previous) => ({
      ...previous,
      invoices: importedInvoices,
      settings: {
        ...previous.settings,
        ...(imported.settings ?? {}),
      },
    }));

    setPage("dashboard");
    setCurrentInvoiceId(null);
    notify("Backup imported.");
  }, [notify]);

  const resetAllData = useCallback(() => {
    setModal({
      title: "Delete all local data?",
      message:
        "This permanently removes all saved invoices and settings from this browser. Export a backup first if you need it.",
      confirmLabel: "Delete everything",
      onConfirm: () => {
        clearStorage();
        setStorage({
          invoices: [],
          settings: DEFAULT_SETTINGS,
        });
        setPage("dashboard");
        setCurrentInvoiceId(null);
        setModal(null);
        notify("All local data has been deleted.");
      },
    });
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
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={backToDashboard}
            className="flex items-center gap-3 rounded-lg text-left"
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
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                page === "dashboard" || page === "editor"
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <FileText className="mr-2 inline" size={16} />
              Invoices
            </button>

            <button
              type="button"
              onClick={() => setPage("templates")}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                page === "templates"
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <LayoutTemplate className="mr-2 inline" size={16} />
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
              Settings
            </button>
          </nav>

          <div className="flex items-center gap-2">
            {page === "editor" && currentInvoice && (
              <>
                <span className="hidden items-center gap-1 text-xs text-emerald-700 sm:flex">
                  <Check size={14} />
                  Saved locally
                </span>

                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  <Download size={16} />
                  <span className="hidden sm:inline">Export PDF</span>
                  <span className="sm:hidden">PDF</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
              aria-label="Toggle navigation"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-slate-200 bg-white p-3 md:hidden">
            <button
              type="button"
              onClick={() => {
                backToDashboard();
                setMobileMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-sm hover:bg-slate-100"
            >
              <FileText size={16} />
              Invoices
            </button>

            <button
              type="button"
              onClick={() => {
                setPage("templates");
                setMobileMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-sm hover:bg-slate-100"
            >
              <LayoutTemplate size={16} />
              Templates
            </button>

            <button
              type="button"
              onClick={() => {
                setPage("settings");
                setMobileMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-sm hover:bg-slate-100"
            >
              <SettingsIcon size={16} />
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
              {page === "dashboard" &&
                "Create, manage, and export your invoices."}
              {page === "editor" &&
                "Edit invoice details and preview the final document."}
              {page === "templates" &&
                "Choose a clean design for your next invoice."}
              {page === "settings" &&
                "Manage your business details and local data."}
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
            onCreateInvoice={() => createInvoice()}
            onOpenInvoice={openInvoice}
            onDuplicateInvoice={duplicateInvoice}
            onDeleteInvoice={deleteInvoice}
            onExportInvoice={handleExportInvoice}
          />
        )}

        {page === "editor" && currentInvoice && (
          <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
            <div className="no-print min-w-0">
              <InvoiceEditor
                invoice={currentInvoice}
                settings={settings}
                onChange={updateInvoice}
                onSettingsChange={updateSettings}
              />

              <div className="mt-6 flex flex-wrap gap-3">
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
                  Print invoice
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

            <div className="min-w-0">
              <div className="no-print mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">
                  Live preview
                </h2>
                <span className="text-xs text-slate-400">
                  A4 document
                </span>
              </div>

              <InvoicePreview invoice={currentInvoice} settings={settings} />
            </div>
          </div>
        )}

        {page === "templates" && (
          <TemplatePicker
            onSelect={(template) => createInvoice(template)}
            onCancel={backToDashboard}
          />
        )}

        {page === "settings" && (
          <Settings
            settings={settings}
            invoices={storage.invoices}
            onChange={updateSettings}
            onImport={handleImportData}
            onReset={resetAllData}
            onExportAll={() => {
              try {
                const backup = {
                  version: 1,
                  exportedAt: new Date().toISOString(),
                  invoices: storage.invoices,
                  settings: storage.settings,
                };

                const blob = new Blob(
                  [JSON.stringify(backup, null, 2)],
                  { type: "application/json" },
                );

                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = "invoicelite-backup.json";
                anchor.click();
                URL.revokeObjectURL(url);
                notify("Backup exported.");
              } catch {
                notify("Could not export the backup.");
              }
            }}
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

      <Toast message={toastMessage} />
    </div>
  );
}

export default App;
