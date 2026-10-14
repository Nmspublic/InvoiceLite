
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  FilePlus2,
  FileText,
  LayoutTemplate,
  Menu,
  Printer,
  Settings as SettingsIcon,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

import type {
  AppPage,
  AppSettings,
  Invoice,
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
import Toast, { type ToastMessage } from "./components/Toast";

function createEmptyInvoice(
  settings: AppSettings,
  template: InvoiceTemplate,
): Invoice {
  const date = todayISO();
  const invoiceNumber = `${settings.invoicePrefix}${String(
    settings.nextInvoiceNumber,
  ).padStart(4, "0")}`;
  const now = new Date().toISOString();

  return {
    id: createId(),
    version: 1,
    invoiceNumber,
    issueDate: date,
    dueDate: date,
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
    discountType: "percent",
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
    createdAt: now,
    updatedAt: now,
  };
}

function App() {
  const [storage, setStorage] = useState<StorageData>(() => readStorage());
  const [page, setPage] = useState<AppPage>("dashboard");
  const [currentInvoiceId, setCurrentInvoiceId] = useState<string | null>(
    null,
  );
  const [selectedTemplate, setSelectedTemplate] =
    useState<InvoiceTemplate>(DEFAULT_SETTINGS.defaultTemplate);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [modal, setModal] = useState<{
    title: string;
    description: string;
    confirmLabel?: string;
    destructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const settings = storage.settings ?? DEFAULT_SETTINGS;
  const currentInvoice =
    storage.invoices.find((invoice) => invoice.id === currentInvoiceId) ??
    null;

  const notify = useCallback(
    (message: string, type: ToastMessage["type"] = "success") => {
      setToast({ id: createId(), message, type });
    },
    [],
  );

  useEffect(() => {
    writeStorage(storage);
  }, [storage]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const updateInvoice = useCallback((updatedInvoice: Invoice) => {
    setStorage((previous) => ({
      ...previous,
      invoices: previous.invoices.map((invoice) =>
        invoice.id === updatedInvoice.id
          ? { ...updatedInvoice, updatedAt: new Date().toISOString() }
          : invoice,
      ),
    }));
  }, []);

  const updateSettings = useCallback((updatedSettings: AppSettings) => {
    setStorage((previous) => ({
      ...previous,
      settings: updatedSettings,
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
      setMobileMenuOpen(false);
      notify("New invoice created.");
    },
    [settings, notify],
  );

  const openInvoice = useCallback((invoiceId: string) => {
    setCurrentInvoiceId(invoiceId);
    setPage("editor");
    setMobileMenuOpen(false);
  }, []);

  const backToDashboard = useCallback(() => {
    setPage("dashboard");
    setCurrentInvoiceId(null);
    setMobileMenuOpen(false);
  }, []);

  const duplicateInvoice = useCallback(
    (invoice: Invoice) => {
      const now = new Date().toISOString();
      const duplicate: Invoice = {
        ...invoice,
        id: createId(),
        invoiceNumber: `${settings.invoicePrefix}${String(
          settings.nextInvoiceNumber,
        ).padStart(4, "0")}`,
        status: "draft",
        createdAt: now,
        updatedAt: now,
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
        description: `Are you sure you want to delete ${invoice.invoiceNumber}? This action cannot be undone.`,
        confirmLabel: "Delete invoice",
        destructive: true,
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
        notify("Could not export the invoice.", "error");
      }
    },
    [notify],
  );

  const handleDownloadPDF = useCallback(() => {
    if (!currentInvoice) return;

    const result = validateInvoice(currentInvoice);
    if (!result.valid) {
      setModal({
        title: "Invoice needs attention",
        description: result.errors.join("\n"),
        confirmLabel: "Got it",
        onConfirm: () => setModal(null),
      });
      return;
    }

    try {
      exportInvoicePDF(currentInvoice);
      notify("Your PDF is ready.");
    } catch {
      notify("Could not generate the PDF. Please try printing.", "error");
    }
  }, [currentInvoice, notify]);

  const handleImportData = useCallback(
    (input: unknown) => {
      if (!input || typeof input !== "object") {
        notify("Invalid backup file.", "error");
        return;
      }

      const imported = input as Partial<StorageData>;

      if (imported.version !== 1 || !Array.isArray(imported.invoices)) {
        notify("This backup is not compatible with InvoiceLite.", "error");
        return;
      }

      const validInvoices = imported.invoices.every(
        (invoice) =>
          invoice &&
          typeof invoice.id === "string" &&
          invoice.version === 1 &&
          typeof invoice.invoiceNumber === "string" &&
          Array.isArray(invoice.items) &&
          invoice.business &&
          invoice.client,
      );

      if (!validInvoices) {
        notify("The backup contains invalid invoice data.", "error");
        return;
      }

      const importedSettings = imported.settings;
      if (
        !importedSettings ||
        typeof importedSettings !== "object" ||
        !importedSettings.business
      ) {
        notify("The backup is missing valid settings.", "error");
        return;
      }

      setStorage({
        version: 1,
        invoices: imported.invoices as Invoice[],
        settings: {
          ...DEFAULT_SETTINGS,
          ...importedSettings,
          business: {
            ...DEFAULT_SETTINGS.business,
            ...importedSettings.business,
          },
        },
      });

      setPage("dashboard");
      setCurrentInvoiceId(null);
      setModal(null);
      notify("Backup imported successfully.");
    },
    [notify],
  );

  const resetAllData = useCallback(() => {
    setModal({
      title: "Delete all local data?",
      description:
        "This permanently removes all invoices and settings saved in this browser. Export a backup first if you need one.",
      confirmLabel: "Delete everything",
      destructive: true,
      onConfirm: () => {
        clearStorage();
        setStorage({
          version: 1,
          invoices: [],
          settings: structuredClone(DEFAULT_SETTINGS),
        });
        setCurrentInvoiceId(null);
        setPage("dashboard");
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

  const navigate = (nextPage: AppPage) => {
    setPage(nextPage);
    setMobileMenuOpen(false);
    if (nextPage === "dashboard") setCurrentInvoiceId(null);
  };

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
            <NavButton
              active={page === "dashboard" || page === "editor"}
              onClick={() => navigate("dashboard")}
            >
              <FileText size={16} />
              Invoices
            </NavButton>
            <NavButton
              active={page === "templates"}
              onClick={() => navigate("templates")}
            >
              <LayoutTemplate size={16} />
              Templates
            </NavButton>
            <NavButton
              active={page === "settings"}
              onClick={() => navigate("settings")}
            >
              <SettingsIcon size={16} />
              Settings
            </NavButton>
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
            <MobileNavButton
              onClick={() => navigate("dashboard")}
              icon={<FileText size={16} />}
            >
              Invoices
            </MobileNavButton>
            <MobileNavButton
              onClick={() => navigate("templates")}
              icon={<LayoutTemplate size={16} />}
            >
              Templates
            </MobileNavButton>
            <MobileNavButton
              onClick={() => navigate("settings")}
              icon={<SettingsIcon size={16} />}
            >
              Settings
            </MobileNavButton>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {page !== "settings" && (
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
                  "Choose a clean design for your next invoice."}
              </p>
            </div>

            {page === "dashboard" && (
              <button
                type="button"
                onClick={() => navigate("templates")}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
              >
                <FilePlus2 size={17} />
                New invoice
              </button>
            )}
          </div>
        )}

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
                onChange={updateInvoice}
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
                <span className="text-xs text-slate-400">A4 document</span>
              </div>
              <InvoicePreview invoice={currentInvoice} />
            </div>
          </div>
        )}

        {page === "editor" && !currentInvoice && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <h2 className="text-lg font-semibold">Invoice not found</h2>
            <p className="mt-2 text-sm text-slate-500">
              It may have been deleted. Return to your invoices to continue.
            </p>
            <button
              type="button"
              onClick={backToDashboard}
              className="mt-5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Back to invoices
            </button>
          </div>
        )}

        {page === "templates" && (
          <div className="space-y-6">
            <TemplatePicker
              value={selectedTemplate}
              onChange={setSelectedTemplate}
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => createInvoice(selectedTemplate)}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
              >
                <FilePlus2 size={17} />
                Create with this template
              </button>
              <button
                type="button"
                onClick={backToDashboard}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {page === "settings" && (
          <Settings
            settings={settings}
            data={storage}
            onChange={updateSettings}
            onImport={handleImportData}
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
          open={true}
          title={modal.title}
          description={modal.description}
          confirmLabel={modal.confirmLabel}
          destructive={modal.destructive}
          onConfirm={modal.onConfirm}
          onCancel={() => setModal(null)}
        />
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function NavButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
        active
          ? "bg-slate-100 text-slate-900"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

function MobileNavButton({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-sm hover:bg-slate-100"
    >
      {icon}
      {children}
    </button>
  );
}

export default App;
