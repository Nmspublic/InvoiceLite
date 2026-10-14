import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
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
  Trash2
} from "lucide-react";

import type {
  AppPage,
  AppSettings,
  Invoice,
  InvoiceItem,
  InvoiceTemplate,
  StorageData
} from "./types";
import { DEFAULT_SETTINGS } from "./types";

import Dashboard from "./components/Dashboard";
import InvoiceEditor from "./components/InvoiceEditor";
import InvoicePreview from "./components/InvoicePreview";
import Settings from "./components/Settings";
import TemplatePicker from "./components/TemplatePicker";
import Modal from "./components/Modal";
import Toast, { type ToastMessage } from "./components/Toast";

import { calculateTotals } from "./utils/calculations";
import { createId, todayISO } from "./utils/formatting";
import { clearStorage, readStorage, writeStorage } from "./utils/storage";
import { exportInvoiceJSON, exportInvoicePDF } from "./utils/export";
import { validateInvoice } from "./utils/validation";

const navigation: {
  id: AppPage;
  label: string;
  icon: typeof FileText;
}[] = [
  { id: "dashboard", label: "My invoices", icon: FileText },
  { id: "templates", label: "Templates", icon: LayoutTemplate },
  { id: "settings", label: "Settings", icon: SettingsIcon }
];

type Confirmation =
  | { kind: "delete"; invoice: Invoice }
  | { kind: "clear" }
  | null;

function createInvoice(settings: AppSettings): Invoice {
  const today = todayISO();

  const date = new Date(`${today}T12:00:00`);
  date.setDate(date.getDate() + 14);

  const localDue = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000
  )
    .toISOString()
    .slice(0, 10);

  const number = Math.max(1, settings.nextInvoiceNumber);

  return {
    id: createId(),
    version: 1,
    invoiceNumber: `${settings.invoicePrefix}${String(number).padStart(4, "0")}`,
    issueDate: today,
    dueDate: localDue,
    currency: settings.currency,
    paymentTerms: settings.paymentTerms,
    purchaseOrder: "",
    business: { ...settings.business },
    client: {
      name: "",
      email: "",
      address: "",
      taxId: ""
    },
    items: [
      {
        id: createId(),
        description: "",
        quantity: 1,
        unitPrice: 0,
        discount: 0
      }
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
    template: settings.defaultTemplate,
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function normalizeInvoice(value: unknown): Invoice | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<Invoice>;

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.invoiceNumber !== "string" ||
    typeof candidate.issueDate !== "string" ||
    typeof candidate.dueDate !== "string" ||
    !Array.isArray(candidate.items) ||
    !candidate.business ||
    !candidate.client
  ) {
    return null;
  }

  const business = candidate.business as Invoice["business"];
  const client = candidate.client as Invoice["client"];

  if (
    typeof business.name !== "string" ||
    typeof client.name !== "string"
  ) {
    return null;
  }

  const items: InvoiceItem[] = [];

  for (const raw of candidate.items) {
    if (!raw || typeof raw !== "object") return null;

    const item = raw as Partial<InvoiceItem>;

    if (
      typeof item.id !== "string" ||
      typeof item.description !== "string" ||
      typeof item.quantity !== "number" ||
      !Number.isFinite(item.quantity) ||
      typeof item.unitPrice !== "number" ||
      !Number.isFinite(item.unitPrice) ||
      typeof item.discount !== "number" ||
      !Number.isFinite(item.discount)
    ) {
      return null;
    }

    items.push({
      id: item.id,
      description: item.description.slice(0, 2000),
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount
    });
  }

  if (items.length > 100) return null;

  const currencies = [
    "INR", "USD", "EUR", "GBP", "CAD",
    "AUD", "AED", "SGD", "JPY"
  ];

  const templates: InvoiceTemplate[] = ["classic", "modern", "elegant"];

  return {
    ...candidate,
    version: 1,
    currency: currencies.includes(candidate.currency || "")
      ? candidate.currency!
      : "INR",
    business: {
      name: business.name.slice(0, 200),
      address: String(business.address || "").slice(0, 2000),
      email: String(business.email || "").slice(0, 200),
      phone: String(business.phone || "").slice(0, 100),
      website: String(business.website || "").slice(0, 300),
      logo: typeof business.logo === "string" &&
        business.logo.startsWith("data:image/") &&
        business.logo.length <= 1_500_000
        ? business.logo
        : ""
    },
    client: {
      name: client.name.slice(0, 200),
      email: String(client.email || "").slice(0, 200),
      address: String(client.address || "").slice(0, 2000),
      taxId: String(client.taxId || "").slice(0, 200)
    },
    items,
    discountType: candidate.discountType === "fixed" ? "fixed" : "percent",
    invoiceDiscount: Number(candidate.invoiceDiscount) || 0,
    taxLabel: String(candidate.taxLabel || "Tax").slice(0, 80),
    taxRate: Number(candidate.taxRate) || 0,
    shipping: Number(candidate.shipping) || 0,
    amountPaid: Number(candidate.amountPaid) || 0,
    paymentTerms: String(candidate.paymentTerms || "").slice(0, 200),
    purchaseOrder: String(candidate.purchaseOrder || "").slice(0, 200),
    notes: String(candidate.notes || "").slice(0, 5000),
    paymentInstructions: String(candidate.paymentInstructions || "").slice(0, 5000),
    footer: String(candidate.footer || "").slice(0, 2000),
    template: templates.includes(candidate.template as InvoiceTemplate)
      ? candidate.template!
      : "modern",
    status: candidate.status === "sent" || candidate.status === "paid"
      ? candidate.status
      : "draft",
    createdAt: String(candidate.createdAt || new Date().toISOString()),
    updatedAt: String(candidate.updatedAt || new Date().toISOString())
  } as Invoice;
}

function normalizeSettings(value: unknown): AppSettings {
  if (!value || typeof value !== "object") {
    return structuredClone(DEFAULT_SETTINGS);
  }

  const raw = value as Partial<AppSettings>;
  const validTemplates: InvoiceTemplate[] = ["classic", "modern", "elegant"];
  const validCurrencies = [
    "INR", "USD", "EUR", "GBP", "CAD",
    "AUD", "AED", "SGD", "JPY"
  ];

  const business = raw.business && typeof raw.business === "object"
    ? raw.business
    : DEFAULT_SETTINGS.business;

  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    business: {
      ...DEFAULT_SETTINGS.business,
      ...business,
      logo: ""
    },
    currency: validCurrencies.includes(raw.currency || "")
      ? raw.currency!
      : DEFAULT_SETTINGS.currency,
    defaultTemplate: validTemplates.includes(raw.defaultTemplate as InvoiceTemplate)
      ? raw.defaultTemplate!
      : DEFAULT_SETTINGS.defaultTemplate,
    invoicePrefix: String(raw.invoicePrefix || "INV-").slice(0, 20),
    nextInvoiceNumber: Math.max(
      1,
      Math.min(999999999, Math.floor(Number(raw.nextInvoiceNumber) || 1))
    ),
    taxRate: Math.min(100, Math.max(0, Number(raw.taxRate) || 0))
  };
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
        <FileText size={19} strokeWidth={2.2} />
      </span>
      <span className="text-lg font-bold tracking-tight text-slate-900">
        Invoice<span className="text-indigo-600">Lite</span>
      </span>
    </div>
  );
}

export default function App() {
  const [initial] = useState<StorageData>(() => readStorage());

  const [invoices, setInvoices] = useState<Invoice[]>(initial.invoices);
  const [settings, setSettings] = useState<AppSettings>(initial.settings);
  const [page, setPage] = useState<AppPage>("dashboard");
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [lastSaved, setLastSaved] = useState("");
  const [saveError, setSaveError] = useState(false);

  const notify = useCallback((
    message: string,
    type: ToastMessage["type"] = "success"
  ) => {
    setToast({ id: createId(), message, type });
  }, []);

  // Debounced persistence for invoices and preferences.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = writeStorage({
        version: 1,
        invoices,
        settings
      });

      setSaveError(!saved);

      if (saved) {
        setLastSaved(new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit"
        }));
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [invoices, settings]);

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 4500);

    return () => window.clearTimeout(timer);
  }, [toast]);

  const data = useMemo<StorageData>(() => ({
    version: 1,
    invoices,
    settings
  }), [invoices, settings]);

  const currentStoredInvoice = currentInvoice
    ? invoices.find((invoice) => invoice.id === currentInvoice.id)
    : undefined;

  function createNewInvoice() {
    const invoice = createInvoice(settings);

    setSettings((previous) => ({
      ...previous,
      nextInvoiceNumber: Math.min(
        999999999,
        previous.nextInvoiceNumber + 1
      )
    }));

    setCurrentInvoice(invoice);
    setPage("editor");
    setMobilePreview(false);
    setMenuOpen(false);
  }

  function editInvoice(invoice: Invoice) {
    setCurrentInvoice({ ...invoice });
    setPage("editor");
    setMobilePreview(false);
    setMenuOpen(false);
  }

  function updateCurrentInvoice(updated: Invoice) {
    const next = {
      ...updated,
      updatedAt: new Date().toISOString()
    };

    setCurrentInvoice(next);

    setInvoices((previous) => {
      const exists = previous.some((item) => item.id === next.id);

      if (!exists) return [next, ...previous];

      return previous.map((item) => item.id === next.id ? next : item);
    });
  }

  function saveCurrentInvoice() {
    if (!currentInvoice) return;

    const result = validateInvoice(currentInvoice);

    if (!result.valid) {
      notify(result.errors[0], "error");
      return;
    }

    setInvoices((previous) => {
      const exists = previous.some((item) => item.id === currentInvoice.id);

      return exists
        ? previous.map((item) => item.id === currentInvoice.id
          ? currentInvoice
          : item)
        : [currentInvoice, ...previous];
    });

    notify("Invoice saved in this browser.");
  }

  function duplicateInvoice(invoice: Invoice) {
    const copy: Invoice = {
      ...invoice,
      id: createId(),
      invoiceNumber: `${settings.invoicePrefix}${String(
        settings.nextInvoiceNumber
      ).padStart(4, "0")}`,
      status: "draft",
      amountPaid: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: invoice.items.map((item) => ({
        ...item,
        id: createId()
      }))
    };

    setSettings((previous) => ({
      ...previous,
      nextInvoiceNumber: Math.min(
        999999999,
        previous.nextInvoiceNumber + 1
      )
    }));

    setInvoices((previous) => [copy, ...previous]);
    setCurrentInvoice(copy);
    setPage("editor");
    setMobilePreview(false);
    notify("Invoice duplicated as a new draft.");
  }

  function deleteInvoice(invoice: Invoice) {
    setConfirmation({ kind: "delete", invoice });
  }

  function confirmDestructiveAction() {
    if (!confirmation) return;

    if (confirmation.kind === "delete") {
      const deletedId = confirmation.invoice.id;

      setInvoices((previous) =>
        previous.filter((item) => item.id !== deletedId)
      );

      if (currentInvoice?.id === deletedId) {
        setCurrentInvoice(null);
        setPage("dashboard");
      }

      notify("Invoice deleted.");
    } else {
      setInvoices([]);
      setSettings(structuredClone(DEFAULT_SETTINGS));
      setCurrentInvoice(null);
      setPage("dashboard");
      clearStorage();
      notify("Local invoice data cleared.");
    }

    setConfirmation(null);
  }

  function changeSettings(updated: AppSettings) {
    setSettings(updated);
    notify("Preferences updated.");
  }

  function importData(value: unknown) {
    if (!value || typeof value !== "object") {
      notify("The selected file does not contain valid InvoiceLite data.", "error");
      return;
    }

    const candidate = value as Record<string, unknown>;

    if (
      candidate.version === 1 &&
      Array.isArray(candidate.invoices) &&
      candidate.settings &&
      typeof candidate.settings === "object"
    ) {
      const restored = candidate.invoices.map(normalizeInvoice);

      if (
        restored.some((invoice) => invoice === null) ||
        restored.length > 5000
      ) {
        notify("The backup contains invalid invoices or too many records.", "error");
        return;
      }

      const restoredSettings = normalizeSettings(candidate.settings);

      setInvoices(restored as Invoice[]);
      setSettings(restoredSettings);
      setCurrentInvoice(null);
      setPage("dashboard");
      notify("Backup imported successfully.");
      return;
    }

    const invoice = normalizeInvoice(value);

    if (invoice) {
      const validation = validateInvoice(invoice);

      if (!validation.valid) {
        notify(`Invoice needs attention: ${validation.errors[0]}`, "error");
        return;
      }

      setInvoices((previous) => [
        invoice,
        ...previous.filter((item) => item.id !== invoice.id)
      ]);

      notify("Invoice imported successfully.");
      return;
    }

    notify("Unsupported file format. Choose an InvoiceLite invoice or backup JSON.", "error");
  }

  function downloadCurrentJSON() {
    if (!currentInvoice) return;

    exportInvoiceJSON(currentInvoice);
    notify("Invoice JSON export started.");
  }

  function downloadPDF() {
    if (!currentInvoice) return;

    const result = validateInvoice(currentInvoice);

    if (!result.valid) {
      notify(result.errors[0], "error");
      return;
    }

    try {
      exportInvoicePDF(currentInvoice);
      notify("PDF generation requested.");
    } catch {
      notify("PDF export failed. Please try again.", "error");
    }
  }

  function printInvoice() {
    if (!currentInvoice) return;

    const result = validateInvoice(currentInvoice);

    if (!result.valid) {
      notify(result.errors[0], "error");
      return;
    }

    window.print();
  }

  const selectedPageLabel = navigation.find((item) => item.id === page)?.label;

  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-900">
      <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[68px] max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => {
              setPage("dashboard");
              setCurrentInvoice(null);
              setMenuOpen(false);
            }}
            aria-label="InvoiceLite home"
          >
            <Logo />
          </button>

          <nav className="hidden items-center gap-1 lg:flex">
            {navigation.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setPage(item.id);
                    setMenuOpen(false);
                  }}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                    page === item.id
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {page === "editor" && currentInvoice ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setPage("dashboard");
                    setCurrentInvoice(null);
                  }}
                  className="hidden items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 sm:inline-flex"
                >
                  <ArrowLeft size={16} />
                  Back
                </button>

                <button
                  type="button"
                  onClick={saveCurrentInvoice}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:px-4"
                >
                  <Check size={16} />
                  <span className="hidden sm:inline">Save invoice</span>
                  <span className="sm:hidden">Save</span>
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((value) => !value)}
                    aria-label="Invoice actions"
                    aria-expanded={menuOpen}
                    className="rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50"
                  >
                    <MoreHorizontal size={18} />
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                      <button
                        type="button"
                        onClick={() => {
                          downloadPDF();
                          setMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                      >
                        <Download size={16} /> Download PDF
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          printInvoice();
                          setMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                      >
                        <Printer size={16} /> Print invoice
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          downloadCurrentJSON();
                          setMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                      >
                        <FileText size={16} /> Export invoice JSON
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (currentInvoice) duplicateInvoice(currentInvoice);
                          setMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                      >
                        <Copy size={16} /> Duplicate invoice
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (currentInvoice) deleteInvoice(currentInvoice);
                          setMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={16} /> Delete invoice
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={createNewInvoice}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 sm:px-4"
              >
                <FilePlus2 size={17} />
                <span className="hidden sm:inline">New invoice</span>
                <span className="sm:hidden">New</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-label="Open navigation menu"
              className="rounded-xl p-2.5 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              {menuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>

        {menuOpen && page !== "editor" && (
          <nav className="border-t border-slate-100 bg-white p-3 lg:hidden">
            {navigation.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setPage(item.id);
                    setMenuOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${
                    page === item.id
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Icon size={17} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        )}
      </header>

      {saveError && (
        <div className="no-print mx-auto max-w-[1600px] px-4 pt-4 sm:px-6 lg:px-8">
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Browser storage is unavailable or full. Changes may not persist.
            Export a JSON backup before leaving this page.
          </div>
        </div>
      )}

      <main className="no-print mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {page === "dashboard" && (
          <Dashboard
            invoices={invoices}
            currency={settings.currency}
            onCreate={createNewInvoice}
            onEdit={editInvoice}
            onDuplicate={duplicateInvoice}
            onDelete={deleteInvoice}
          />
        )}

        {page === "templates" && (
          <div className="space-y-6">
            <header>
              <p className="text-sm font-medium text-indigo-600">DESIGN YOUR INVOICE</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
                Invoice templates
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Choose a visual style. Your business and client data remain unchanged.
              </p>
            </header>

            <TemplatePicker
              value={currentInvoice?.template || settings.defaultTemplate}
              onChange={(template) => {
                if (currentInvoice) {
                  updateCurrentInvoice({ ...currentInvoice, template });
                }

                setSettings((previous) => ({
                  ...previous,
                  defaultTemplate: template
                }));

                notify(`${template[0].toUpperCase()}${template.slice(1)} template selected.`);
              }}
            />

            {!currentInvoice && (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5 sm:flex sm:items-center sm:justify-between sm:gap-4">
                <div>
                  <h2 className="font-semibold text-slate-900">
                    Ready to create an invoice?
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    This selection becomes the default for new invoices.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={createNewInvoice}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 sm:mt-0"
                >
                  <FilePlus2 size={17} />
                  Create invoice
                </button>
              </div>
            )}
          </div>
        )}

        {page === "settings" && (
          <Settings
            settings={settings}
            data={data}
            onChange={changeSettings}
            onImport={importData}
            onClear={() => setConfirmation({ kind: "clear" })}
          />
        )}

        {page === "editor" && currentInvoice && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setPage("dashboard");
                    setCurrentInvoice(null);
                  }}
                  className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-700"
                >
                  <ArrowLeft size={15} />
                  Back to invoices
                </button>

                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  {currentStoredInvoice ? "Edit invoice" : "New invoice"}
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  {currentInvoice.invoiceNumber} ·{" "}
                  {saveError
                    ? "Not saved"
                    : lastSaved
                      ? `Saved locally at ${lastSaved}`
                      : "Autosaving…"}
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setMobilePreview(false)}
                  aria-pressed={!mobilePreview}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    !mobilePreview
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-500"
                  }`}
                >
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() => setMobilePreview(true)}
                  aria-pressed={mobilePreview}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    mobilePreview
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-500"
                  }`}
                >
                  Preview
                </button>
              </div>
            </div>

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <section className={mobilePreview ? "hidden xl:block" : "min-w-0"}>
                <InvoiceEditor
                  invoice={currentInvoice}
                  onChange={updateCurrentInvoice}
                />
              </section>

              <section className={mobilePreview ? "min-w-0" : "hidden min-w-0 xl:block"}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-slate-900">
                      Live preview
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {currentInvoice.template[0].toUpperCase() +
                        currentInvoice.template.slice(1)}{" "}
                      template · A4 layout
                    </p>
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <span className="text-slate-500">Template</span>
                    <select
                      value={currentInvoice.template}
                      onChange={(e) =>
                        updateCurrentInvoice({
                          ...currentInvoice,
                          template: e.target.value as InvoiceTemplate
                        })
                      }
                      className="rounded-lg border border-slate-200 bg-white px-2 py-2 outline-none focus:border-indigo-500"
                    >
                      <option value="classic">Classic</option>
                      <option value="modern">Modern</option>
                      <option value="elegant">Elegant</option>
                    </select>
                  </label>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-100 p-2 sm:p-4 xl:p-5">
                  <InvoicePreview invoice={currentInvoice} />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={downloadPDF}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    <Download size={17} />
                    Download PDF
                  </button>

                  <button
                    type="button"
                    onClick={printInvoice}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Printer size={17} />
                    Print invoice
                  </button>
                </div>
              </section>
            </div>

            <p className="flex items-start gap-2 text-xs leading-5 text-slate-400">
              <ShieldCheck size={15} className="mt-0.5 shrink-0" />
              Invoice data is stored locally in this browser. Export a JSON backup
              if you need to transfer your work or keep a separate copy.
            </p>
          </div>
        )}
      </main>

      <footer className="no-print mt-12 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} InvoiceLite. Free and open source.</p>
          <p className="flex items-center gap-2">
            <ShieldCheck size={14} />
            Your invoices stay in your browser.
          </p>
        </div>
      </footer>

      <div className="no-print">
        <Toast toast={toast} onClose={() => setToast(null)} />
      </div>

      <Modal
        open={confirmation !== null}
        title={
          confirmation?.kind === "clear"
            ? "Clear all local data?"
            : "Delete this invoice?"
        }
        description={
          confirmation?.kind === "clear"
            ? "This will permanently remove all saved invoices and reset your settings in this browser. Export a backup first if you need to keep your data."
            : `This will remove ${confirmation?.kind === "delete" ? confirmation.invoice.invoiceNumber : "this invoice"} from this browser. This action cannot be undone unless you have a backup.`
        }
        confirmLabel={
          confirmation?.kind === "clear"
            ? "Clear all data"
            : "Delete invoice"
        }
        destructive
        onCancel={() => setConfirmation(null)}
        onConfirm={confirmDestructiveAction}
      />
    </div>
  );
}
