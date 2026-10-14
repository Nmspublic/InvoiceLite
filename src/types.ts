
export type CurrencyCode =
  | "INR"
  | "USD"
  | "EUR"
  | "GBP"
  | "CAD"
  | "AUD"
  | "AED"
  | "SGD"
  | "JPY";

export type InvoiceStatus = "draft" | "sent" | "paid";
export type InvoiceTemplate = "classic" | "modern" | "elegant";
export type AppPage = "dashboard" | "editor" | "templates" | "settings";

export interface BusinessDetails {
  name: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  logo: string;
}

export interface ClientDetails {
  name: string;
  email: string;
  address: string;
  taxId: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  /** Optional measurement unit, for example sq ft, kg, or hours. */
  unit?: string;
}

export interface Invoice {
  id: string;
  version: 1;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  /** Existing invoices show the due date unless explicitly turned off. */
  showDueDate?: boolean;
  currency: CurrencyCode;
  paymentTerms: string;
  purchaseOrder: string;
  business: BusinessDetails;
  client: ClientDetails;
  items: InvoiceItem[];
  discountType: "percent" | "fixed";
  invoiceDiscount: number;
  taxLabel: string;
  taxRate: number;
  shipping: number;
  amountPaid: number;
  notes: string;
  paymentInstructions: string;
  footer: string;
  template: InvoiceTemplate;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  business: BusinessDetails;
  currency: CurrencyCode;
  paymentTerms: string;
  taxLabel: string;
  taxRate: number;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  theme: "light" | "dark" | "system";
  defaultTemplate: InvoiceTemplate;
}

export interface StorageData {
  version: 1;
  invoices: Invoice[];
  settings: AppSettings;
}

export interface InvoiceTotals {
  subtotal: number;
  itemDiscount: number;
  invoiceDiscount: number;
  taxableAmount: number;
  tax: number;
  shipping: number;
  total: number;
  amountPaid: number;
  balance: number;
}

export const CURRENCIES: {
  code: CurrencyCode;
  name: string;
  symbol: string;
}[] = [
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "AED", name: "UAE Dirham", symbol: "AED" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" }
];

export const DEFAULT_BUSINESS: BusinessDetails = {
  name: "",
  address: "",
  email: "",
  phone: "",
  website: "",
  logo: ""
};

export const DEFAULT_SETTINGS: AppSettings = {
  business: { ...DEFAULT_BUSINESS },
  currency: "INR",
  paymentTerms: "Due within 14 days",
  taxLabel: "Tax",
  taxRate: 0,
  invoicePrefix: "INV-",
  nextInvoiceNumber: 1,
  theme: "light",
  defaultTemplate: "modern"
};
