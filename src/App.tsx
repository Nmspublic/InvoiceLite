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
